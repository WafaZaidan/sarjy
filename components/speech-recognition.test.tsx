import {act, render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {SpeechRecognitionCycle} from "./speech-recognition";
import {askLlm} from "@/lib/api/chat-client";

vi.mock("@/lib/db/conversations", () => ({
    getOrCreateConversation: vi.fn().mockResolvedValue(1),
    createConversation: vi.fn().mockResolvedValue(2),
    getMessages: vi.fn().mockResolvedValue([]),
    getRecentUserMessages: vi.fn().mockResolvedValue([]),
    listConversations: vi.fn().mockResolvedValue([]),
    saveMessage: vi.fn().mockResolvedValue(undefined),
    updateConversationTitle: vi.fn().mockResolvedValue(undefined),
    deleteConversation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api/chat-client", () => ({
    askLlm: vi.fn(),
}));

const mockedAskLlm = vi.mocked(askLlm);

/** Minimal fake of the browser SpeechRecognition API, mirroring real start/stop/abort semantics
 *  (start() throws InvalidStateError if already started; stop()/abort() end asynchronously). */
class FakeSpeechRecognition {
    static instances: FakeSpeechRecognition[] = [];
    onresult: ((event: {results: {0: {0: {transcript: string}}}[]}) => void) | null = null;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    started = false;

    constructor() {
        FakeSpeechRecognition.instances.push(this);
    }

    start = vi.fn(() => {
        if (this.started) {
            const err = new Error("already started");
            err.name = "InvalidStateError";
            throw err;
        }
        this.started = true;
        this.onstart?.();
    });

    stop = vi.fn(() => {
        if (!this.started) return;
        queueMicrotask(() => {
            this.started = false;
            this.onend?.();
        });
    });

    abort = vi.fn(() => {
        this.started = false;
        queueMicrotask(() => {
            this.onend?.();
        });
    });

    simulateResult(transcript: string) {
        this.onresult?.({results: [{0: {transcript}} as never]});
    }
}

/** Minimal fake of SpeechSynthesis: cancel() fires the current utterance's onerror while
 *  speaking, matching real browser behavior that the app's guardrail logic relies on. */
function makeFakeSpeechSynthesis() {
    let currentUtterance: FakeUtterance | null = null;
    return {
        speaking: false,
        pending: false,
        speak: vi.fn(function (this: unknown, utterance: FakeUtterance) {
            currentUtterance = utterance;
            fakeSpeechSynthesis.speaking = true;
        }),
        cancel: vi.fn(function (this: unknown) {
            const wasSpeaking = fakeSpeechSynthesis.speaking;
            fakeSpeechSynthesis.speaking = false;
            fakeSpeechSynthesis.pending = false;
            if (wasSpeaking) {
                currentUtterance?.onerror?.();
            }
            currentUtterance = null;
        }),
        pause: vi.fn(),
        resume: vi.fn(),
        get currentUtterance() {
            return currentUtterance;
        },
        finishSpeaking() {
            fakeSpeechSynthesis.speaking = false;
            const u = currentUtterance;
            currentUtterance = null;
            u?.onend?.();
        },
    };
}

class FakeUtterance {
    lang = "";
    rate = 1;
    pitch = 1;
    volume = 1;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
}

let fakeSpeechSynthesis: ReturnType<typeof makeFakeSpeechSynthesis>;

beforeEach(() => {
    FakeSpeechRecognition.instances = [];
    (window as unknown as {SpeechRecognition: unknown}).SpeechRecognition = FakeSpeechRecognition;
    (window as unknown as {webkitSpeechRecognition: unknown}).webkitSpeechRecognition = undefined;

    fakeSpeechSynthesis = makeFakeSpeechSynthesis();
    Object.defineProperty(window, "speechSynthesis", {
        writable: true,
        configurable: true,
        value: fakeSpeechSynthesis,
    });
    (window as unknown as {SpeechSynthesisUtterance: unknown}).SpeechSynthesisUtterance = FakeUtterance;

    Element.prototype.scrollTo = vi.fn();
    window.confirm = vi.fn(() => true);

    mockedAskLlm.mockReset();
});

afterEach(() => {
    vi.clearAllMocks();
});

async function renderAndWaitReady() {
    render(<SpeechRecognitionCycle/>);
    await waitFor(() => expect(screen.getByText(/tap to speak/i)).toBeInTheDocument());
    return FakeSpeechRecognition.instances[0];
}

describe("mic start/stop", () => {
    it("starts recognition when idle and stops it while listening", async () => {
        const user = userEvent.setup();
        const recognition = await renderAndWaitReady();

        await user.click(screen.getByRole("button", {name: /start listening/i}));
        expect(recognition.start).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.getByText(/listening/i)).toBeInTheDocument());

        await user.click(screen.getByRole("button", {name: /stop listening/i}));
        expect(recognition.stop).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.getByText(/tap to speak/i)).toBeInTheDocument());
    });
});

describe("pause/resume", () => {
    it("pauses and resumes speech synthesis", async () => {
        const user = userEvent.setup();
        mockedAskLlm.mockResolvedValue({message: "Hello there", responseId: "r1"});
        const recognition = await renderAndWaitReady();

        await act(async () => {
            recognition.simulateResult("hi");
        });
        await waitFor(() => expect(screen.getByText(/speaking/i)).toBeInTheDocument());

        await user.click(screen.getByRole("button", {name: /pause/i}));
        expect(fakeSpeechSynthesis.pause).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.getByText(/^paused$/i)).toBeInTheDocument());

        await user.click(screen.getByRole("button", {name: /resume/i}));
        expect(fakeSpeechSynthesis.resume).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.getByText(/speaking/i)).toBeInTheDocument());
    });
});

describe("stop thinking", () => {
    it("aborts the in-flight request and returns the mic to idle", async () => {
        const user = userEvent.setup();
        let capturedSignal: AbortSignal | undefined;
        mockedAskLlm.mockImplementation(
            (_message, _prev, _history, signal) =>
                new Promise((_resolve, reject) => {
                    capturedSignal = signal;
                    signal?.addEventListener("abort", () => {
                        reject(new DOMException("The operation was aborted.", "AbortError"));
                    });
                }),
        );
        const recognition = await renderAndWaitReady();

        await act(async () => {
            recognition.simulateResult("hi");
        });
        await waitFor(() => expect(screen.getByRole("button", {name: /^stop$/i})).toBeInTheDocument());

        await user.click(screen.getByRole("button", {name: /^stop$/i}));

        expect(capturedSignal?.aborted).toBe(true);
        await waitFor(() => expect(screen.getByText(/tap to speak/i)).toBeInTheDocument());
    });
});

describe("new chat while auto-listening (regression)", () => {
    it("does not leave the mic unable to start after New Chat while the mic auto-resumed", async () => {
        // "New chat" is disabled while status is "speaking", so the only UI-reachable
        // moment to trigger this race is right after TTS finishes and the mic
        // auto-resumes to "listening" (still enabled). This is the exact sequence that
        // used to leave the native recognizer running while the UI showed "idle",
        // permanently breaking the mic button until a page refresh.
        const user = userEvent.setup();
        mockedAskLlm.mockResolvedValue({message: "Hello there", responseId: "r1"});
        const recognition = await renderAndWaitReady();

        await act(async () => {
            recognition.simulateResult("hi");
        });
        await waitFor(() => expect(screen.getByText(/speaking/i)).toBeInTheDocument());

        // TTS finishes naturally -> resumeListening() -> mic auto-resumes.
        await act(async () => {
            fakeSpeechSynthesis.finishSpeaking();
        });
        await waitFor(() => expect(screen.getByText(/^listening/i)).toBeInTheDocument());

        const startCallsBefore = recognition.start.mock.calls.length;

        await user.click(screen.getByRole("button", {name: /new chat/i}));

        await waitFor(() => expect(screen.getByText(/tap to speak/i)).toBeInTheDocument());
        // New Chat must not have silently left the recognizer in a stuck "started" state.
        expect(recognition.start.mock.calls.length).toBe(startCallsBefore);

        // The mic button must still be genuinely clickable afterward.
        await user.click(screen.getByRole("button", {name: /start listening/i}));
        expect(recognition.start).toHaveBeenCalledTimes(startCallsBefore + 1);
        await waitFor(() => expect(screen.getByText(/^listening/i)).toBeInTheDocument());
    });
});
