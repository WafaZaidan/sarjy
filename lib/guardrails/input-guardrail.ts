// Code-level backstop for the raw user message, before it ever reaches the LLM.
// SAFETY_INSTRUCTIONS (lib/llm/instructions.ts) is the prompt-level policy covering
// the same ground, but a prompt alone can't guarantee it's always followed — this
// runs independently of the model and blocks deterministically.
import {findPii} from "./pii";
import {checkModeration} from "./moderation";

const JAILBREAK_PATTERNS: {name: string; pattern: RegExp}[] = [
    {name: "instruction override attempt", pattern: /ignore\s+(all\s+)?(the\s+)?(previous|prior|above|earlier)\s+instructions?/i},
    {name: "instruction override attempt", pattern: /disregard\s+(all\s+)?(the\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|prompt)/i},
    {name: "system prompt extraction attempt", pattern: /(reveal|show|print|repeat|what\s+(is|are))\s+(your|the)\s+(system\s+)?(prompt|instructions?)/i},
    {name: "persona override attempt", pattern: /you\s+are\s+(now\s+)?(DAN|no\s+longer\s+bound|free\s+from|not\s+bound)/i},
    {name: "persona override attempt", pattern: /pretend\s+(that\s+)?you\s+(have\s+no|don't\s+have\s+any)\s+(rules|restrictions|guidelines|limits)/i},
    {name: "persona override attempt", pattern: /act\s+as\s+if\s+you\s+(have\s+no|had\s+no|don't\s+have\s+any)\s+(rules|restrictions|guidelines|limits)/i},
];

function findJailbreakAttempt(text: string): string | null {
    for (const {name, pattern} of JAILBREAK_PATTERNS) {
        if (pattern.test(text)) {
            return name;
        }
    }
    return null;
}

export type InputGuardrailResult =
    | {blocked: false}
    | {blocked: true; reason: string};


export async function checkInput(message: string): Promise<InputGuardrailResult> {
    const piiFound = findPii(message);
    if (piiFound) {
        console.log(`[input_guardrail] blocked — message appears to contain a ${piiFound}`);
        return {blocked: true, reason: `your message appears to contain a ${piiFound}`};
    }

    const jailbreakFound = findJailbreakAttempt(message);
    if (jailbreakFound) {
        console.log(`[input_guardrail] blocked — message looks like a ${jailbreakFound}`);
        return {blocked: true, reason: "your message looks like an attempt to override my instructions"};
    }

    // Cheap pattern checks run first so the moderation call — a network round
    // trip — is only paid for once the free checks above have already passed.
    const moderation = await checkModeration(message);
    if (moderation.flagged) {
        console.log(`[input_guardrail] blocked — message flagged by moderation: ${moderation.categories.join(", ")}`);
        return {blocked: true, reason: "your message was flagged as potentially harmful"};
    }

    return {blocked: false};
}
