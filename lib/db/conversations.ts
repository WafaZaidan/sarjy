import {createClient} from "@/lib/supabase/client";

const supabase = createClient()

export type ConversationMessage = {
    id: number;
    created_at: string;
    conversation_id: number;
    role: "user" | "assistant";
    message: string;
};

export type ConversationSummary = {
    id: number;
    title: string | null;
    created_at: string;
};

async function insertConversation(userId: string): Promise<number> {
    const {data: newConversation, error: createError} = await supabase.from("conversations").insert({
        user_id: userId,
        title: "Sarjy Converstion",
        created_at: new Date()
    }).select("id").single()
    if (createError) {
        throw new Error(createError.message);
    }
    if (!newConversation) {
        throw new Error("Conversation was not created");
    }
    return newConversation.id;
}

export async function getOrCreateConversation(): Promise<number | undefined> {
    const {
        data: {user},
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        console.log('Skipping conversation persistence: user is not signed in')
        return
    }

    const {data: existingConversation, error: findError} = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", {ascending: false})
        .limit(1)
        .maybeSingle();

    if (findError) {
        throw new Error(findError.message);
    }
    if (existingConversation) {
        return existingConversation.id;
    }

    return insertConversation(user.id);
}

export async function createConversation(): Promise<number | undefined> {
    const {
        data: {user},
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        console.log('Skipping conversation persistence: user is not signed in')
        return
    }

    return insertConversation(user.id);
}

export async function updateConversationTitle(conversationId: number, title: string): Promise<void> {
    const {error} = await supabase
        .from("conversations")
        .update({title})
        .eq("id", conversationId);

    if (error) {
        throw new Error(error.message);
    }
}

export async function deleteConversation(conversationId: number): Promise<void> {
    const {error} = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId);

    if (error) {
        throw new Error(error.message);
    }
}

export async function listConversations(): Promise<ConversationSummary[]> {
    const {
        data: {user},
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return [];
    }

    const {data, error} = await supabase
        .from("conversations")
        .select("id, title, created_at")
        .eq("user_id", user.id)
        .order("created_at", {ascending: false});

    if (error) {
        throw new Error(error.message);
    }
    return data ?? [];
}

export async function getMessages(
    conversationId: number,
): Promise<Pick<ConversationMessage, "role" | "message">[]> {
    const {data, error} = await supabase
        .from("messages")
        .select("role, message")
        .eq("conversation_id", conversationId)
        .order("created_at", {ascending: true});

    if (error) {
        throw new Error(error.message);
    }
    return data ?? [];
}

export async function saveMessage(
    conversationId: number,
    role: "user" | "assistant",
    message: string,
): Promise<void> {
    const {error} = await supabase.from("messages").insert({
        conversation_id: conversationId,
        role,
        message,
    });

    if (error) {
        throw new Error(error.message);
    }
}
