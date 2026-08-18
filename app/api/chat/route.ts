import OpenAI from "openai";
import type {ResponseInputItem} from "openai/resources/responses/responses";

import {NextResponse} from "next/server";
import {braveSearch} from "@/lib/tools/brave-search";
import {INSTRUCTIONS, tools} from "@/lib/llm/instructions";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

const MAX_TOOL_ROUNDS = 3;

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

        const input: string | ResponseInputItem[] = hasHistory
            ? [
                ...history.map((m: { role: "user" | "assistant"; message: string }) => ({
                    role: m.role,
                    content: m.message,
                })),
                {role: "user" as const, content: message},
            ]
            : message;

        let response = await client.responses.create({
            model: "gpt-5-nano",
            instructions: INSTRUCTIONS,
            input,
            tools,
            previous_response_id: hasPreviousResponseId ? previousResponseId : undefined,
        })

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const functionCalls = response.output.filter(
                (item) => item.type === "function_call",
            );

            if (functionCalls.length === 0) {
                break;
            }

            const toolOutputs: ResponseInputItem[] = [];
            for (const call of functionCalls) {
                let query = "";
                try {
                    query = JSON.parse(call.arguments).query;
                } catch {
                    query = "";
                }
                const result = query ? await braveSearch(query) : "Missing search query.";
                toolOutputs.push({
                    type: "function_call_output",
                    call_id: call.call_id,
                    output: result,
                });
            }

            response = await client.responses.create({
                model: "gpt-5-nano",
                instructions: INSTRUCTIONS,
                input: toolOutputs,
                tools,
                previous_response_id: response.id,
            })
        }

        return NextResponse.json({
            message: response.output_text,
            responseId: response.id,
        })

    } catch (error) {
        console.log('Oh no something went wrong', error)
    }

}
