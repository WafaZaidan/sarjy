import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {braveSearch} from "./brave-search";

// These tests call braveSearch() directly, bypassing the LLM entirely — that's the point.
// If we instead tested this through the chat endpoint, the prompt-level policy might refuse
// to call the tool at all for an obvious PII query, and we'd never find out whether the
// code-level regex check would ALSO have blocked it. Calling the function directly proves
// the code-level guardrail works on its own, independent of the model's behavior.

describe("braveSearch PII guard", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        process.env.BRAVE_API_KEY = "test-key";
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("blocks a query containing an email address without calling fetch", async () => {
        const result = await braveSearch("contact test.user@example.com about the invoice");

        expect(global.fetch).not.toHaveBeenCalled();
        expect(result).toMatch(/blocked/i);
        expect(result).toMatch(/email/i);
    });

    it("blocks a query containing a US phone number without calling fetch", async () => {
        const result = await braveSearch("call 555-123-4567 for details");

        expect(global.fetch).not.toHaveBeenCalled();
        expect(result).toMatch(/blocked/i);
    });

    it("allows an ordinary name query and does call fetch", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            json: async () => ({web: {results: []}}),
        });

        const result = await braveSearch("Ada Lovelace");

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(result).not.toMatch(/blocked/i);
    });
});
