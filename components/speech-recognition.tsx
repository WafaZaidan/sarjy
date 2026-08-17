"use client";

import { useEffect, useRef, useState } from "react";

export function SpeechRecognitionCycle() {
    const recognitionRef = useRef<any>(null);
    const [transcript, setTranscript] = useState("");

    useEffect(() => {
        const Recognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!Recognition) return;

        const recognition = new Recognition();

        recognition.onresult = (event: any) => {
            setTranscript(event.results[0][0].transcript);
        };

        recognitionRef.current = recognition;

        return () => recognition.abort();
    }, []);

    return (
        <div>
            <button style={{color:"pink"}} onClick={() => recognitionRef.current?.start()}>
                Say something
            </button>

            <button  style={{color:"blue"}} onClick={() => recognitionRef.current?.stop()}>
                Stop
            </button>

            <textarea value={transcript} readOnly />
        </div>
    );
}
