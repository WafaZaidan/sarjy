"use client";

import {useEffect, useRef, useState} from "react";
import {Mic, MicOff, Loader2, Volume2, Pause, Play} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {cn} from "@/lib/utils";
import {askLlm} from "@/lib/api/chat";

type Status = "idle" | "listening" | "thinking" | "speaking" | "paused";

export function SpeechRecognitionCycle() {
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const [transcript, setTranscript] = useState("");
    const [assistantReply, setAssistantReply] = useState<string>("");
    const [status, setStatus] = useState<Status>("idle");
    const [supported, setSupported] = useState(true);



    async function speak(text: string) {
        if (!('speechSynthesis' in window)) {
            console.log('error')
            setStatus("idle");
            return
        }

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = "en-GB";
        utterance.rate = 1
        utterance.pitch = 1
        utterance.volume = 1
        setStatus("speaking");
        utterance.onend = () => setStatus("idle");
        utterance.onerror = () => setStatus("idle");
        window.speechSynthesis.speak(utterance)

    }
    async function handleRecognisedSpeech(message:string){
        try{
            setStatus("thinking");

           const httpResponse =  await askLlm(message)

            if (httpResponse){
                setAssistantReply(httpResponse)
                await speak(httpResponse)
            }else {
                setStatus("idle")
            }
        }
        catch(e){
            console.log("Something went wrong", e);
            setStatus("idle");        }
    }

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

            setTranscript(message);
            await handleRecognisedSpeech(message)
        };
        recognition.onstart = () => setStatus("listening");
        recognition.onend = () => setStatus((s) => (s === "listening" ? "idle" : s));
        recognition.onerror = () => setStatus("idle");

        recognitionRef.current = recognition;

        return () => recognition.abort();
    });

    const isListening = status === "listening";

    function toggleListening() {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            window.speechSynthesis.cancel();
            setTranscript("");
            setAssistantReply("");
            recognitionRef.current?.start();
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
        <Card className="h-[640px] w-[560px] shrink-0">
            <CardContent className="flex h-full flex-col items-center gap-6 p-6">
                <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={toggleListening}
                            disabled={status === "thinking" || status === "speaking" || status === "paused"}
                            size="icon"
                            variant={isListening ? "destructive" : "default"}
                            className={cn(
                                "h-16 w-16 rounded-full [&_svg]:size-6",
                                isListening && "animate-pulse",
                            )}
                        >
                            {status === "thinking" ? (
                                <Loader2 className="animate-spin"/>
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
                            >
                                {status === "paused" ? <Play/> : <Pause/>}
                            </Button>
                        )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                        {statusLabel[status]}
                    </span>
                </div>

                <div className="flex w-full flex-1 flex-col gap-3 overflow-hidden">
                    <div className="flex h-20 flex-col gap-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            You said
                        </p>
                        <div className="flex-1 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-sm">
                            {transcript || (
                                <span className="text-muted-foreground">—</span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Sarjy
                        </p>
                        <div className="flex-1 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                            {assistantReply || (
                                <span className="text-muted-foreground">—</span>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
