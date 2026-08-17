export async function askLlm(message: string) {
    const httpResponse = await fetch("/api/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message}),
    })
    const data: { message?: string; error?: string } =
        await httpResponse.json();
    if (!httpResponse.ok) {
        throw new Error(data.error || "Request failed");
    }
    if (!data.message) {
        throw new Error("Sarjy returned no message");
    }
    return data.message;


}
