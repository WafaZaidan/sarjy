// Deterministic check for one narrow slice of "hallucinating data when using
// external tools" (from the SAFETY_INSTRUCTIONS factual-grounding rule): does the
// reply cite a URL that wasn't actually in the search results it was given? This
// only catches fabricated sources, not misstated facts from a real source — that
// case still relies on the prompt policy alone.
const URL_PATTERN = /https?:\/\/[^\s)]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?)]+$/;

function extractUrls(text: string): Set<string> {
    const matches = text.match(URL_PATTERN) ?? [];
    return new Set(matches.map((url) => url.replace(TRAILING_PUNCTUATION, "")));
}

export type GroundingResult =
    | {blocked: false}
    | {blocked: true; reason: string};

export function checkGrounding(reply: string, toolResults: string[]): GroundingResult {
    if (toolResults.length === 0) {
        return {blocked: false};
    }

    const availableUrls = new Set(toolResults.flatMap((result) => [...extractUrls(result)]));

    for (const url of extractUrls(reply)) {
        if (!availableUrls.has(url)) {
            console.log(`[hallucination_guardrail] blocked — reply cites a URL not present in search results: ${url}`);
            return {blocked: true, reason: "the reply referenced a source that wasn't in the search results"};
        }
    }

    return {blocked: false};
}
