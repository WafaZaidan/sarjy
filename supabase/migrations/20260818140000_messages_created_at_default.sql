UPDATE "public"."messages"
    SET "created_at" = "now"()
    WHERE "created_at" IS NULL;

ALTER TABLE "public"."messages"
    ALTER COLUMN "created_at" SET DEFAULT "now"(),
    ALTER COLUMN "created_at" SET NOT NULL;
