"use client";

import {useEffect, useRef, useState} from "react";
import {Mic, MicOff, Volume2, Pause, Play, Plus, Trash2, Square} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {cn} from "@/lib/utils";
import {askLlm} from "@/lib/api/chat-client";
import {
    ConversationSummary,
    createConversation,
    deleteConversation,
    getMessages,
    getOrCreateConversation,
    getRecentUserMessages,
    listConversations,
    saveMessage,
    updateConversationTitle,
} from "@/lib/db/conversations";

function deriveTitle(message: string): string {
    const trimmed = message.trim();
    if (!trimmed) {
        return "New conversation";
    }
    return trimmed.length > 60 ? `${trimmed.slice(0, 60).trimEnd()}…` : trimmed;
}

type Status = "idle" | "listening" | "thinking" | "speaking" | "paused";

type ChatMessage = {
    role: "user" | "assistant";
    message: string;
};

export function SpeechRecognitionCycle() {
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const conversationScrollRef = useRef<HTMLDivElement | null>(null);
    const conversationIdRef = useRef<number | null>(null);
    const lastResponseIdRef = useRef<string | null>(null);
    // Full history across ALL of the user's conversations (not just the active one),
    // so facts mentioned in one chat are available when a new response chain starts
    // in a different chat.
    const allMessagesRef = useRef<ChatMessage[]>([]);
    // Set right before we programmatically cancel speech (new chat / switch / delete),
    // so the utterance's resulting "error" event doesn't auto-restart the mic.
    const suppressAutoListenRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
    const [status, setStatus] = useState<Status>("idle");
    const [supported, setSupported] = useState(true);

    async function ensureConversationId() {
        if (conversationIdRef.current) {
            return conversationIdRef.current;
        }
        const id = await getOrCreateConversation();
        if (id) {
            conversationIdRef.current = id;
            setActiveConversationId(id);
        }
        return id;
    }

    async function openConversation(id: number) {
        conversationIdRef.current = id;
        lastResponseIdRef.current = null;
        setActiveConversationId(id);
        const history = await getMessages(id);
        setMessages(history);
    }

    function cancelSpeechAndListening() {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            suppressAutoListenRef.current = true;
        }
        recognitionRef.current?.abort();
        window.speechSynthesis.cancel();
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
    }

    async function handleSelectConversation(id: number) {
        if (id === activeConversationId) {
            return;
        }
        cancelSpeechAndListening();
        setStatus("idle");
        await openConversation(id);
    }

    async function handleDeleteConversation(id: number) {
        if (!window.confirm("Delete this conversation? This can't be undone.")) {
            return;
        }
        await deleteConversation(id);
        const remaining = conversations.filter((c) => c.id !== id);
        setConversations(remaining);

        if (id === activeConversationId) {
            cancelSpeechAndListening();
            setStatus("idle");
            if (remaining.length > 0) {
                await openConversation(remaining[0].id);
            } else {
                await handleNewChat();
            }
        }
    }

    async function handleNewChat() {
        cancelSpeechAndListening();
        const id = await createConversation();
        conversationIdRef.current = id ?? null;
        lastResponseIdRef.current = null;
        setMessages([]);
        setStatus("idle");
        setActiveConversationId(id ?? null);
        if (id) {
            setConversations((prev) => [
                {id, title: "Sarjy Converstion", created_at: new Date().toISOString()},
                ...prev,
            ]);
        }
    }

    function resumeListening() {
        if (suppressAutoListenRef.current) {
            suppressAutoListenRef.current = false;
            setStatus("idle");
            return;
        }
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            setTimeout(resumeListening, 100);
            return;
        }
        setStatus("idle");
        try {
            recognitionRef.current?.start();
        } catch {
            // already listening or recognition unavailable — ignore
        }
    }

    function speak(text: string) {
        if (!('speechSynthesis' in window)) {
            console.log('error')
            resumeListening();
            return
        }

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = "en-GB";
        utterance.rate = 1
        utterance.pitch = 1
        utterance.volume = 1
        setStatus("speaking");
        utterance.onend = () => resumeListening();
        utterance.onerror = () => resumeListening();
        window.speechSynthesis.speak(utterance)

    }

    async function handleRecognisedSpeech(message: string) {
        try {
            const isFirstMessage = messages.length === 0;
            setStatus("thinking");
            setMessages((prev) => [...prev, {role: "user", message}]);

            allMessagesRef.current.push({role: "user", message});

            const conversationId = await ensureConversationId();
            if (conversationId) {
                await saveMessage(conversationId, "user", message);
                if (isFirstMessage) {
                    const title = deriveTitle(message);
                    await updateConversationTitle(conversationId, title);
                    setConversations((prev) =>
                        prev.map((c) => (c.id === conversationId ? {...c, title} : c)),
                    );
                }
            }

            const historyForRequest = lastResponseIdRef.current ? undefined : allMessagesRef.current;
            const controller = new AbortController();
            abortControllerRef.current = controller;
            const {message: httpResponse, responseId} = await askLlm(
                message,
                lastResponseIdRef.current,
                historyForRequest,
                controller.signal,
            )
            abortControllerRef.current = null;

            if (httpResponse) {
                lastResponseIdRef.current = responseId;
                allMessagesRef.current.push({role: "assistant", message: httpResponse});
                setMessages((prev) => [...prev, {role: "assistant", message: httpResponse}]);
                speak(httpResponse)
                if (conversationId) {
                    await saveMessage(conversationId, "assistant", httpResponse);
                }
            } else {
                setStatus("idle")
            }
        } catch (e) {
            abortControllerRef.current = null;
            if (e instanceof DOMException && e.name === "AbortError") {
                setStatus("idle");
                return;
            }
            console.log("Something went wrong", e);
            setStatus("idle");
        }
    }

    function handleStopThinking() {
        abortControllerRef.current?.abort();
        setStatus("idle");
    }

    useEffect(() => {
        conversationScrollRef.current?.scrollTo({top: conversationScrollRef.current.scrollHeight});
    }, [messages]);

    useEffect(() => {
        (async () => {
            const list = await listConversations();
            setConversations(list);

            const conversationId = await ensureConversationId();
            if (!conversationId) {
                return;
            }

            allMessagesRef.current = await getRecentUserMessages();

            const history = await getMessages(conversationId);
            if (history.length > 0) {
                setMessages(history);
            }
        })();
    }, []);

    useEffect(() => {
        const Recognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!Recognition) {
            setSupported(false);
            return;
        }
        const recognition = new Recognition();

        recognition.onresult = async (event: SpeechRecognitionEvent) => {
            const message = event.results[0][0].transcript
            await handleRecognisedSpeech(message)
        };
        recognition.onstart = () => setStatus("listening");
        recognition.onend = () => setStatus((s) => (s === "listening" ? "idle" : s));
        recognition.onerror = () => setStatus("idle");

        recognitionRef.current = recognition;

        return () => recognition.abort();
    }, []);

    const isListening = status === "listening";

    function toggleListening() {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            window.speechSynthesis.cancel();
            try {
                recognitionRef.current?.start();
            } catch {
                // recognition still winding down from a previous session — ignore
            }
        }
    }

    function togglePause() {
        if (status === "speaking") {
            window.speechSynthesis.pause();
            setStatus("paused");
        } else if (status === "paused") {
            window.speechSynthesis.resume();
            setStatus("speaking");
        }
    }

    if (!supported) {
        return (
            <Card className="w-full max-w-xl">
                <CardContent className="p-6 text-sm text-muted-foreground">
                    Speech recognition isn&apos;t supported in this browser. Try Chrome or
                    Edge.
                </CardContent>
            </Card>
        );
    }

    const statusLabel: Record<Status, string> = {
        idle: "Tap to speak",
        listening: "Listening…",
        thinking: "Thinking…",
        speaking: "Speaking…",
        paused: "Paused",
    };

    return (
        <div className="flex h-[640px] gap-4">
            <Card className="w-64 shrink-0">
                <CardContent className="flex h-full flex-col gap-2 overflow-hidden p-4">
                    <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Past chats
                    </p>
                    <div className="flex-1 overflow-y-auto">
                        {conversations.length === 0 ? (
                            <p className="px-2 text-sm text-muted-foreground">No conversations yet</p>
                        ) : (
                            <div className="flex flex-col gap-1">
                                {conversations.map((c) => (
                                    <div
                                        key={c.id}
                                        className={cn(
                                            "group flex items-center rounded-md hover:bg-muted",
                                            c.id === activeConversationId && "bg-muted",
                                        )}
                                    >
                                        <button
                                            onClick={() => handleSelectConversation(c.id)}
                                            className={cn(
                                                "flex-1 truncate px-2 py-2 text-left text-sm",
                                                c.id === activeConversationId && "font-medium",
                                            )}
                                        >
                                            {c.title || "Untitled conversation"}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteConversation(c.id)}
                                            className="mr-1 rounded-md p-1.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                                            aria-label="Delete conversation"
                                        >
                                            <Trash2 className="size-4"/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="w-[560px] shrink-0">
            <CardContent className="flex h-full flex-col items-center gap-6 p-6">
                <Button
                    onClick={handleNewChat}
                    disabled={status === "thinking" || status === "speaking"}
                    variant="outline"
                    size="sm"
                    className="self-end gap-2"
                >
                    <Plus className="size-4"/>
                    New chat
                </Button>

                <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={status === "thinking" ? handleStopThinking : toggleListening}
                            disabled={status === "speaking"}
                            size="icon"
                            variant={isListening || status === "thinking" ? "destructive" : "default"}
                            className={cn(
                                "h-16 w-16 rounded-full [&_svg]:size-6",
                                isListening && "animate-pulse",
                            )}
                            aria-label={
                                status === "thinking"
                                    ? "Stop"
                                    : status === "speaking"
                                        ? "Speaking"
                                        : isListening
                                            ? "Stop listening"
                                            : "Start listening"
                            }
                        >
                            {status === "thinking" ? (
                                <Square className="fill-current"/>
                            ) : status === "speaking" ? (
                                <Volume2/>
                            ) : isListening ? (
                                <MicOff/>
                            ) : (
                                <Mic/>
                            )}
                        </Button>
                        {(status === "speaking" || status === "paused") && (
                            <Button
                                onClick={togglePause}
                                size="icon"
                                variant="outline"
                                className="h-11 w-11 rounded-full [&_svg]:size-5"
                                aria-label={status === "paused" ? "Resume" : "Pause"}
                            >
                                {status === "paused" ? <Play/> : <Pause/>}
                            </Button>
                        )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                        {statusLabel[status]}
                    </span>
                </div>

                <div className="flex w-full flex-1 flex-col gap-1 overflow-hidden">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Conversation
                    </p>
                    <div ref={conversationScrollRef} className="flex-1 overflow-y-auto rounded-lg border bg-muted/30 p-3">
                        {messages.length === 0 ? (
                            <span className="text-sm text-muted-foreground">—</span>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {messages.map((m, i) => (
                                    <div key={i} className="flex flex-col gap-1">
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            {m.role === "user" ? "You" : "Sarjy"}
                                        </p>
                                        <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
            </Card>
        </div>
    );
}
