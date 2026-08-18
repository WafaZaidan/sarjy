import OpenAI from "openai";

import {NextResponse} from "next/server";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})


export async function POST(request: Request) {
    try {
        const messageJson = await request.json()
        const message = messageJson.message
        const previousResponseId = messageJson.previousResponseId
        const history = messageJson.history

        if (typeof message !== 'string' || !message.trim()) {
            return NextResponse.json({
                error: "Invalid Message",
                status: "400"
            })
        }

        const hasPreviousResponseId = typeof previousResponseId === 'string' && previousResponseId;
        const hasHistory = !hasPreviousResponseId && Array.isArray(history) && history.length > 0;

        const input: string | { role: "user" | "assistant"; content: string }[] = hasHistory
            ? [
                ...history.map((m: { role: "user" | "assistant"; message: string }) => ({
                    role: m.role,
                    content: m.message,
                })),
                {role: "user" as const, content: message},
            ]
            : message;

        const response = await client.responses.create({
            model: "gpt-5-nano",
            instructions: " You are Sarjy an AI voice assistant, give precise and concise answers",
            input,
            previous_response_id: hasPreviousResponseId ? previousResponseId : undefined,
        })
        return NextResponse.json({
            message: response.output_text,
            responseId: response.id,
        })

    } catch (error) {
        console.log('Oh no something went wrong', error)
    }

}
