"use client";

import {useEffect, useRef, useState} from "react";

export function SpeechRecognitionCycle() {
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const [transcript, setTranscript] = useState("");
    const [assistantReply, setAssistantReply] = useState<string>("");

    async function askLlm(message: string) {
        try {
            const httpResponse = await fetch("/api/chat", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({message}),
            })
            const data: { message?: string; error?: string } =
                await httpResponse.json();
            if (!httpResponse.ok) {
                throw new Error(data.error || "Request failed");
            }
            if (data.message) {
                setAssistantReply(data.message)
                await speak(data.message)
            }

        } catch (e) {
            console.log("Something went wrong", e);
        }

    }

    async function speak(text: string) {
        if (!('speechSynthesis' in window)) {
            console.log('error')
            return
        }

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = "en-GB";
        utterance.rate = 1
        utterance.pitch = 1
        utterance.volume = 1
        window.speechSynthesis.speak(utterance)

    }

    useEffect(() => {
        const Recognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!Recognition) return;
        const recognition = new Recognition();
        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const message = event.results[0][0].transcript

            setTranscript(message);
            askLlm(message)
        };

        recognitionRef.current = recognition;

        return () => recognition.abort();
    }, []);

    return (
        <div>
            <button style={{color: "pink"}} onClick={() => recognitionRef.current?.start()}>
                Say something
            </button>

            <button style={{color: "blue"}} onClick={() => recognitionRef.current?.stop()}>
                Stop
            </button>

            <textarea value={transcript} readOnly/>
            <textarea
                value={assistantReply}
                readOnly
                rows={6}
                className="w-full resize-none rounded-lg border p-3"
            />
        </div>
    );
}
