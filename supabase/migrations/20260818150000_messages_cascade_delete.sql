ALTER TABLE "public"."messages"
    DROP CONSTRAINT "messages_conversation_id_fkey";

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id")
        REFERENCES "public"."conversations"("id") ON DELETE CASCADE;
