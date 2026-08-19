import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("@/lib/llm/client", () => ({
    client: {
        moderations: {
            create: vi.fn(),
        },
    },
}));

import {client} from "@/lib/llm/client";
import {checkModeration} from "./moderation";

describe("checkModeration", () => {
    const create = client.moderations.create as ReturnType<typeof vi.fn>;

    beforeEach(() => {
        create.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns not flagged when the API reports nothing flagged", async () => {
        create.mockResolvedValue({
            results: [{flagged: false, categories: {}}],
        });

        const result = await checkModeration("what's the weather today?");

        expect(result.flagged).toBe(false);
    });

    it("returns flagged with the matching categories when the API flags content", async () => {
        create.mockResolvedValue({
            results: [
                {
                    flagged: true,
                    categories: {violence: true, harassment: false, hate: true},
                },
            ],
        });

        const result = await checkModeration("something harmful");

        expect(result.flagged).toBe(true);
        if (result.flagged) {
            expect(result.categories).toEqual(["violence", "hate"]);
        }
    });
});
