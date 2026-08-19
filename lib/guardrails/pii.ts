// Deterministic PII detection shared by every guardrail that needs it — the
// input guardrail (raw user messages) and the tool-call guardrail (search
// queries) both check the same shapes of PII, so the patterns live in one place.
// Phone pattern is US-only (NANP 3-3-4) for now — other formats aren't caught yet.
export const PII_PATTERNS: {name: string; pattern: RegExp}[] = [
    {name: "email address", pattern: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i},
    {name: "phone number", pattern: /(?:\+?\d{1,3}[-.\s])?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/},
];

export function findPii(text: string): string | null {
    for (const {name, pattern} of PII_PATTERNS) {
        if (pattern.test(text)) {
            return name;
        }
    }
    return null;
}
