import {describe, expect, it} from "vitest";
import {checkGrounding} from "./hallucination-guardrail";

describe("checkGrounding", () => {
    it("allows a reply with no cited URLs when tools were used", () => {
        const result = checkGrounding(
            "The weather in London is currently 15°C and cloudy.",
            ["1. Met Office\nhttps://metoffice.gov.uk/weather\nLondon forecast."],
        );

        expect(result.blocked).toBe(false);
    });

    it("allows a reply that cites a URL present in the search results", () => {
        const result = checkGrounding(
            "According to https://metoffice.gov.uk/weather, it's 15°C in London.",
            ["1. Met Office\nhttps://metoffice.gov.uk/weather\nLondon forecast."],
        );

        expect(result.blocked).toBe(false);
    });

    it("blocks a reply that cites a URL not present in the search results", () => {
        const result = checkGrounding(
            "According to https://not-a-real-source.example/weather, it's 15°C in London.",
            ["1. Met Office\nhttps://metoffice.gov.uk/weather\nLondon forecast."],
        );

        expect(result.blocked).toBe(true);
    });

    it("allows any reply when no tools were used this turn", () => {
        const result = checkGrounding(
            "According to https://not-a-real-source.example/weather, it's 15°C in London.",
            [],
        );

        expect(result.blocked).toBe(false);
    });
});
