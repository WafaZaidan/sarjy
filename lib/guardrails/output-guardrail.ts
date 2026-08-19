// Checks what the model actually said before it reaches the user. The prompt
// policy (SAFETY_INSTRUCTIONS) and the input guardrail both act before generation —
// neither guarantees the model's own output stays within bounds, so this is an
// independent check on the other side of the call.
import {checkModeration} from "./moderation";

export type OutputGuardrailResult =
    | {blocked: false}
    | {blocked: true; reason: string};

export async function checkOutput(reply: string): Promise<OutputGuardrailResult> {
    if (!reply.trim()) {
        return {blocked: false};
    }

    const moderation = await checkModeration(reply);
    if (moderation.flagged) {
        console.log(`[output_guardrail] blocked — reply flagged by moderation: ${moderation.categories.join(", ")}`);
        return {blocked: true, reason: "the generated reply was flagged as potentially harmful"};
    }

    return {blocked: false};
}
