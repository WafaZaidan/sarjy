export async function askLlm(
    message: string,
    previousResponseId: string | null,
    history?: { role: "user" | "assistant"; message: string }[],
    signal?: AbortSignal,
) {
    const httpResponse = await fetch("/api/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message, previousResponseId, history}),
        signal,
    })
    const data: { message?: string; responseId?: string; error?: string } =
        await httpResponse.json();
    if (!httpResponse.ok) {
        throw new Error(data.error || "Request failed");
    }
    if (!data.message) {
        throw new Error("Sarjy returned no message");
    }
    return {message: data.message, responseId: data.responseId ?? null};
}
