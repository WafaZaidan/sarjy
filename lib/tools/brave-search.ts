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

export async function braveSearch(query: string): Promise<string> {
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
