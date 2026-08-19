import type {ResponseFunctionToolCall, ResponseInputItem} from "openai/resources/responses/responses";

import {NextResponse} from "next/server";
import {braveSearch} from "@/lib/tools/brave-search";
import {INSTRUCTIONS, tools} from "@/lib/llm/instructions";
import {checkInput} from "@/lib/guardrails/input-guardrail";
import {checkOutput} from "@/lib/guardrails/output-guardrail";
import {checkGrounding} from "@/lib/guardrails/hallucination-guardrail";
import {client} from "@/lib/llm/client";

const MAX_TOOL_ROUNDS = 3;
const LLM_TIMEOUT_MS = 15_000;

function parseSearchQuery(call: ResponseFunctionToolCall): string {
    try {
        return JSON.parse(call.arguments).query ?? "";
    } catch {
        return "";
    }
}

async function executeFunctionCalls(
    functionCalls: ResponseFunctionToolCall[],
): Promise<{toolOutputs: ResponseInputItem[]; searchResults: string[]}> {
    const toolOutputs: ResponseInputItem[] = [];
    const searchResults: string[] = [];

    for (const call of functionCalls) {
        const query = parseSearchQuery(call);
        const result = query ? await braveSearch(query) : "Missing search query.";
        searchResults.push(result);
        toolOutputs.push({type: "function_call_output", call_id: call.call_id, output: result});
    }

    return {toolOutputs, searchResults};
}

function isLastToolRound(round: number): boolean {
    return round === MAX_TOOL_ROUNDS - 1;
}

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

        const guardrailResult = await checkInput(message);
        if (guardrailResult.blocked) {
            return NextResponse.json({
                message: `I can't respond to that — ${guardrailResult.reason}.`,
                responseId: previousResponseId ?? null,
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
        }, {timeout: LLM_TIMEOUT_MS})

        const searchResults: string[] = [];

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const functionCalls = response.output.filter(
                (item) => item.type === "function_call",
            );

            if (functionCalls.length === 0) {
                break;
            }

            const {toolOutputs, searchResults: roundResults} = await executeFunctionCalls(functionCalls);
            searchResults.push(...roundResults);

            // Omitting `tools` here forces a final text answer instead of another
            // unresolved function call once rounds run out — the model still sees
            // every tool output collected so far.
            response = await client.responses.create({
                model: "gpt-5-nano",
                instructions: INSTRUCTIONS,
                input: toolOutputs,
                tools: isLastToolRound(round) ? undefined : tools,
                previous_response_id: response.id,
            }, {timeout: LLM_TIMEOUT_MS})
        }

        const groundingResult = checkGrounding(response.output_text, searchResults);
        if (groundingResult.blocked) {
            return NextResponse.json({
                message: "I can't share that response — it referenced a source I didn't actually find.",
                responseId: response.id,
            })
        }

        const outputGuardrailResult = await checkOutput(response.output_text);
        if (outputGuardrailResult.blocked) {
            return NextResponse.json({
                message: "I can't share that response — it was flagged as potentially harmful.",
                responseId: response.id,
            })
        }

        return NextResponse.json({
            message: response.output_text.trim() || "I searched but couldn't find a clear answer to that.",
            responseId: response.id,
        })

    } catch (error) {
        console.error('[chat] request failed', error)
        return NextResponse.json({
            error: "Something went wrong. Please try again.",
        }, {status: 500})
    }

}
