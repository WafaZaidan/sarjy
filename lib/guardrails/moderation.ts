// Classifier-based backstop, complementary to the pattern-matched checks in
// input-guardrail.ts: OpenAI's Moderation API catches harmful-content categories
// (violence, self-harm, hate, sexual, harassment, etc.) that regex was never going
// to generalize to. Used on both the incoming user message and the model's
// generated reply, since either side can carry flagged content.
import {client} from "@/lib/llm/client";

const MODERATION_TIMEOUT_MS = 8_000;

export type ModerationResult =
    | {flagged: false}
    | {flagged: true; categories: string[]};

export async function checkModeration(text: string): Promise<ModerationResult> {
    const response = await client.moderations.create({
        model: "omni-moderation-latest",
        input: text,
    }, {timeout: MODERATION_TIMEOUT_MS});

    const result = response.results[0];
    if (!result?.flagged) {
        return {flagged: false};
    }

    const categories = Object.entries(result.categories)
        .filter(([, flagged]) => flagged)
        .map(([category]) => category);

    return {flagged: true, categories};
}
