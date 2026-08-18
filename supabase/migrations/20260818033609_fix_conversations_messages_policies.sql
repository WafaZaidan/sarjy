-- messages_conversation_id_key wrongly limited each conversation to a single message
ALTER TABLE "public"."messages" DROP CONSTRAINT IF EXISTS "messages_conversation_id_key";

-- conversations policies were unscoped (USING (true) / WITH CHECK (true)), leaking all users' data
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."conversations";
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."conversations";

CREATE POLICY "Users can insert their own conversations" ON "public"."conversations"
    FOR INSERT TO "authenticated"
    WITH CHECK ("auth"."uid"() = "user_id");

CREATE POLICY "Users can view their own conversations" ON "public"."conversations"
    FOR SELECT TO "authenticated"
    USING ("auth"."uid"() = "user_id");

CREATE POLICY "Users can update their own conversations" ON "public"."conversations"
    FOR UPDATE TO "authenticated"
    USING ("auth"."uid"() = "user_id")
    WITH CHECK ("auth"."uid"() = "user_id");

CREATE POLICY "Users can delete their own conversations" ON "public"."conversations"
    FOR DELETE TO "authenticated"
    USING ("auth"."uid"() = "user_id");

-- messages had RLS enabled with no policies at all, so all access was denied
CREATE POLICY "Users can view messages in their own conversations" ON "public"."messages"
    FOR SELECT TO "authenticated"
    USING (
        EXISTS (
            SELECT 1 FROM "public"."conversations"
            WHERE "conversations"."id" = "messages"."conversation_id"
            AND "conversations"."user_id" = "auth"."uid"()
        )
    );

CREATE POLICY "Users can insert messages in their own conversations" ON "public"."messages"
    FOR INSERT TO "authenticated"
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "public"."conversations"
            WHERE "conversations"."id" = "messages"."conversation_id"
            AND "conversations"."user_id" = "auth"."uid"()
        )
    );
