type BraveSearchResult = {
    title: string;
    url: string;
    description: string;
};

type BraveSearchResponse = {
    web?: {
        results?: BraveSearchResult[];
    };
};

// Deterministic backstop: even if the model's prompt-based policy fails to catch it,
// never let a query containing this shape of PII actually reach an external API.
const PII_PATTERNS: {name: string; pattern: RegExp}[] = [
    {name: "email address", pattern: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i},
    {name: "phone number", pattern: /(?:\+?\d{1,3}[-.\s])?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/},
];

function findPii(query: string): string | null {
    for (const {name, pattern} of PII_PATTERNS) {
        if (pattern.test(query)) {
            return name;
        }
    }
    return null;
}

export async function braveSearch(query: string): Promise<string> {
    const piiFound = findPii(query);
    if (piiFound) {
        console.log(`[brave_search] blocked — query appears to contain a ${piiFound}: "${query}"`);
        return `Search blocked: the query appears to contain a ${piiFound}, which must not be sent to an external search API.`;
    }

    console.log(`[brave_search] called with query: "${query}"`);

    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
        return "Web search is not configured.";
    }

    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", "5");

    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            "X-Subscription-Token": apiKey,
        },
    });

    if (!response.ok) {
        return `Web search failed with status ${response.status}.`;
    }

    const data: BraveSearchResponse = await response.json();
    const results = data.web?.results ?? [];

    if (results.length === 0) {
        return "No web search results found.";
    }

    return results
        .map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.description}`)
        .join("\n\n");
}
