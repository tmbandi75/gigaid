CREATE TABLE IF NOT EXISTS "duplicate_phone_alerts" (
"phone_e164" text PRIMARY KEY NOT NULL,
"last_user_count" integer NOT NULL,
"last_user_ids" text NOT NULL,
"first_alerted_at" text NOT NULL,
"last_alerted_at" text NOT NULL,
"alert_count" integer DEFAULT 1 NOT NULL
);
