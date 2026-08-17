import {createClient} from "@/lib/supabase/client";

const supabase = createClient()

export type ConversationMessage = {
    id: number;
    created_at: string;
    conversation_id: number;
    role: "user" | "assistant";
    message: string;
};

export async function getOrCreateConversation(): Promise<Promise<number> | void> {
    const {
        data: {user},
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log('user isnt authenticated')
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

    const {data: newConversation, error: createError} = await supabase.from("conversations").insert({
        user_id: user.id,
        title: "Sarjy Converstion"
    }).select("id").single()
    if (createError) {
        throw new Error(createError.message);
    }
    if (!newConversation) {
        throw new Error("Conversation was not created");
    }
    return newConversation.id;

}
