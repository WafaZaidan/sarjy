import {beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("@/lib/llm/client", () => ({
    client: {
        moderations: {
            create: vi.fn(),
        },
    },
}));

import {client} from "@/lib/llm/client";
import {checkOutput} from "./output-guardrail";

describe("checkOutput", () => {
    const create = client.moderations.create as ReturnType<typeof vi.fn>;

    beforeEach(() => {
        create.mockReset();
    });

    it("allows an ordinary reply", async () => {
        create.mockResolvedValue({results: [{flagged: false, categories: {}}]});

        const result = await checkOutput("Here's the weather forecast for today.");

        expect(result.blocked).toBe(false);
    });

    it("blocks a reply flagged by moderation", async () => {
        create.mockResolvedValue({
            results: [{flagged: true, categories: {hate: true}}],
        });

        const result = await checkOutput("something harmful");

        expect(result.blocked).toBe(true);
    });

    it("skips the moderation call for an empty reply", async () => {
        const result = await checkOutput("   ");

        expect(result.blocked).toBe(false);
        expect(create).not.toHaveBeenCalled();
    });
});
