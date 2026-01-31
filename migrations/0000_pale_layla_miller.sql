CREATE TABLE "action_queue_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"source_type" text NOT NULL,
	"source_id" varchar,
	"action_type" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"explain_text" text DEFAULT '' NOT NULL,
	"cta_primary_label" text NOT NULL,
	"cta_primary_action" text DEFAULT '{}' NOT NULL,
	"cta_secondary_label" text,
	"cta_secondary_action" text,
	"priority_score" integer NOT NULL,
	"due_at" text,
	"status" text DEFAULT 'open' NOT NULL,
	"snoozed_until" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"dedupe_key" text NOT NULL,
	CONSTRAINT "action_queue_items_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "admin_action_audit" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" text NOT NULL,
	"actor_user_id" varchar NOT NULL,
	"actor_email" text,
	"target_user_id" varchar,
	"action_key" text NOT NULL,
	"reason" text NOT NULL,
	"payload" text,
	"source" text DEFAULT 'admin_ui' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text,
	"role" text DEFAULT 'read_only' NOT NULL,
	"enabled" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"created_at" text NOT NULL,
	"created_by" varchar,
	"last_login_at" text,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "ai_interventions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"intervention_type" text NOT NULL,
	"entity_type" text,
	"entity_id" varchar,
	"message" text,
	"is_silent" boolean DEFAULT false,
	"displayed_at" text,
	"dismissed_at" text,
	"action_taken" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_nudge_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nudge_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"event_at" text NOT NULL,
	"metadata" text DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "ai_nudges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"nudge_type" text NOT NULL,
	"priority" integer DEFAULT 50 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text,
	"last_shown_at" text,
	"snoozed_until" text,
	"action_payload" text DEFAULT '{}',
	"explain_text" text DEFAULT '' NOT NULL,
	"dedupe_key" text NOT NULL,
	"confidence" double precision,
	CONSTRAINT "ai_nudges_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "ai_overrides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"override_type" text NOT NULL,
	"original_action" text,
	"original_amount" double precision,
	"original_timing" text,
	"user_action" text,
	"user_amount" double precision,
	"delay_seconds" double precision,
	"confidence_score" double precision,
	"intent_signals" text[],
	"time_of_day" text,
	"job_type" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attribution_daily" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_date" text NOT NULL,
	"channel" text NOT NULL,
	"signups" integer DEFAULT 0 NOT NULL,
	"activations" integer DEFAULT 0 NOT NULL,
	"activation_rate" double precision,
	"notes" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "auto_execution_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"next_action_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"action_type" text NOT NULL,
	"message_content" text,
	"delivery_channel" text,
	"executed_at" text NOT NULL,
	"success" boolean DEFAULT true,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"metadata" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_protections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"client_id" varchar,
	"is_first_time_client" boolean DEFAULT false,
	"booking_lead_time_hours" integer,
	"booking_price" integer,
	"client_cancellation_count" integer DEFAULT 0,
	"is_protected" boolean DEFAULT false,
	"deposit_required" boolean DEFAULT false,
	"deposit_amount_cents" integer,
	"deposit_paid_at" text,
	"stripe_payment_intent_id" text,
	"cancellation_policy_acknowledged_at" text,
	"phone_verified_at" text,
	"created_at" text NOT NULL,
	CONSTRAINT "booking_protections_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "booking_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_name" text NOT NULL,
	"client_phone" text,
	"client_email" text,
	"service_type" text NOT NULL,
	"preferred_date" text,
	"preferred_time" text,
	"description" text,
	"location" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" text NOT NULL,
	"deposit_amount_cents" integer,
	"deposit_currency" text DEFAULT 'usd',
	"deposit_status" text DEFAULT 'none',
	"completion_status" text DEFAULT 'scheduled',
	"job_start_at" text,
	"job_end_at" text,
	"auto_release_at" text,
	"last_reschedule_at" text,
	"late_reschedule_count" integer DEFAULT 0,
	"waive_reschedule_fee" boolean DEFAULT false,
	"retained_amount_cents" integer DEFAULT 0,
	"rolled_amount_cents" integer DEFAULT 0,
	"stripe_payment_intent_id" text,
	"stripe_charge_id" text,
	"stripe_transfer_id" text,
	"confirmation_token" text,
	"customer_lat" double precision,
	"customer_lng" double precision,
	"total_amount_cents" integer,
	"remainder_payment_status" text DEFAULT 'pending',
	"remainder_payment_method" text,
	"remainder_paid_at" text,
	"remainder_notes" text,
	"policy_acknowledged" boolean DEFAULT false,
	"policy_acknowledged_at" text
);
--> statement-breakpoint
CREATE TABLE "campaign_suggestions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"service_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"detected_signal" text NOT NULL,
	"suggested_message" text,
	"estimated_eligible_clients" integer DEFAULT 0,
	"status" text DEFAULT 'pending',
	"dismissed_at" text,
	"converted_to_campaign_id" varchar,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capability_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"capability" text NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"window_start" text,
	"last_used_at" text,
	"created_at" text NOT NULL,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "client_notification_campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"service_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"event_reason" text NOT NULL,
	"channel" text NOT NULL,
	"booking_link" text NOT NULL,
	"message_content" text NOT NULL,
	"recipient_count" integer DEFAULT 0,
	"sent_at" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_name" text NOT NULL,
	"client_phone" text,
	"client_email" text,
	"is_first_time" boolean DEFAULT true,
	"cancellation_count" integer DEFAULT 0,
	"no_show_count" integer DEFAULT 0,
	"total_bookings" integer DEFAULT 0,
	"last_booking_at" text,
	"opted_out_of_notifications" boolean DEFAULT false,
	"deposit_override_percent" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copilot_recommendations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" text NOT NULL,
	"rec_key" text NOT NULL,
	"health_state" text NOT NULL,
	"primary_bottleneck" text NOT NULL,
	"biggest_funnel_leak" text,
	"recommendation_text" text NOT NULL,
	"rationale" text,
	"urgency_score" integer DEFAULT 50 NOT NULL,
	"impact_estimate" text,
	"expires_at" text,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copilot_signals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" text NOT NULL,
	"signal_type" text NOT NULL,
	"signal_key" text NOT NULL,
	"window_start" text,
	"window_end" text,
	"severity" integer DEFAULT 50 NOT NULL,
	"summary" text NOT NULL,
	"explanation" text,
	"status" text DEFAULT 'active' NOT NULL,
	"resolved_at" text,
	"links" text
);
--> statement-breakpoint
CREATE TABLE "crew_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"crew_member_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"token" text NOT NULL,
	"token_hash" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"delivered_via" text,
	"delivered_at" text,
	"viewed_at" text,
	"confirmed_at" text,
	"declined_at" text,
	"revoked_at" text,
	"expires_at" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "crew_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "crew_job_photos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"crew_member_id" varchar NOT NULL,
	"crew_invite_id" varchar,
	"photo_url" text NOT NULL,
	"caption" text,
	"uploaded_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crew_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"member_user_id" text,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"role" text DEFAULT 'helper' NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"invited_at" text NOT NULL,
	"joined_at" text
);
--> statement-breakpoint
CREATE TABLE "crew_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"crew_member_id" varchar NOT NULL,
	"crew_invite_id" varchar,
	"message" text NOT NULL,
	"is_from_crew" boolean DEFAULT true,
	"read_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estimation_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" varchar NOT NULL,
	"category_id" text NOT NULL,
	"service_type" text,
	"client_name" text NOT NULL,
	"client_phone" text,
	"client_email" text,
	"description" text,
	"photos" text[],
	"measurement_area" double precision,
	"measurement_linear" double precision,
	"measurement_unit" text,
	"location" text,
	"ai_estimate_low" integer,
	"ai_estimate_high" integer,
	"ai_confidence" text,
	"provider_estimate_low" integer,
	"provider_estimate_high" integer,
	"provider_notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_at" text,
	"sent_at" text,
	"confirm_token" text,
	"confirmed_at" text,
	"converted_to_job_id" varchar,
	"created_at" text NOT NULL,
	"expires_at" text
);
--> statement-breakpoint
CREATE TABLE "events_canonical" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" text NOT NULL,
	"user_id" varchar,
	"org_id" varchar,
	"event_name" text NOT NULL,
	"context" text,
	"source" text DEFAULT 'system' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"description" text,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "intent_signals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"signal_type" text NOT NULL,
	"trigger_text" text,
	"confidence" double precision DEFAULT 0.8,
	"detected_at" text NOT NULL,
	"processed_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"lead_id" varchar,
	"client_name" text NOT NULL,
	"client_email" text,
	"client_phone" text,
	"service_description" text NOT NULL,
	"amount" integer NOT NULL,
	"tax" integer DEFAULT 0,
	"discount" integer DEFAULT 0,
	"status" text DEFAULT 'draft' NOT NULL,
	"payment_method" text,
	"share_link" text,
	"offline_draft" boolean DEFAULT false,
	"created_at" text NOT NULL,
	"sent_at" text,
	"paid_at" text,
	"public_token" text,
	"email_sent_at" text,
	"sms_sent_at" text,
	"source_ready_action_id" varchar,
	"booking_link" text,
	"intent_follow_up_sent" boolean DEFAULT false,
	"intent_follow_up_sent_at" text
);
--> statement-breakpoint
CREATE TABLE "job_drafts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"source_text" text NOT NULL,
	"parsed_fields" text DEFAULT '{}' NOT NULL,
	"confidence" text DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"booking_link_url" text,
	"booking_link_token" text,
	"payment_config" text DEFAULT '{}',
	"job_id" varchar,
	"created_at" text NOT NULL,
	"updated_at" text,
	"expires_at" text
);
--> statement-breakpoint
CREATE TABLE "job_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar,
	"job_id" varchar,
	"user_id" varchar NOT NULL,
	"client_name" text,
	"client_email" text,
	"amount" integer NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"proof_url" text,
	"notes" text,
	"paid_at" text,
	"confirmed_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_resolutions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"resolution_type" text NOT NULL,
	"payment_method" text,
	"waiver_reason" text,
	"resolved_at" text NOT NULL,
	"resolved_by_user_id" varchar NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "job_resolutions_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"service_type" text NOT NULL,
	"location" text,
	"scheduled_date" text NOT NULL,
	"scheduled_time" text NOT NULL,
	"duration" integer DEFAULT 60,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"price" integer,
	"photos" text[],
	"voice_note" text,
	"voice_note_transcript" text,
	"voice_note_summary" text,
	"client_name" text,
	"client_phone" text,
	"client_email" text,
	"assigned_crew_id" text,
	"materials" text,
	"notes" text,
	"client_confirm_status" text DEFAULT 'pending',
	"client_confirm_token" text,
	"client_confirmed_at" text,
	"confirmation_sent_at" text,
	"payment_status" text DEFAULT 'unpaid',
	"payment_method" text,
	"paid_at" text,
	"reminder_24h_sent" boolean DEFAULT false,
	"reminder_2h_sent" boolean DEFAULT false,
	"customer_lat" double precision,
	"customer_lng" double precision,
	"provider_lat" double precision,
	"provider_lng" double precision,
	"provider_location_updated_at" text,
	"review_token" text,
	"review_requested_at" text,
	"created_at" text NOT NULL,
	"completed_at" text
);
--> statement-breakpoint
CREATE TABLE "lead_emails" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"direction" text NOT NULL,
	"from_email" text NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"body_text" text NOT NULL,
	"body_html" text,
	"tracking_id" text,
	"in_reply_to_tracking_id" text,
	"sendgrid_message_id" text,
	"sent_at" text,
	"received_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_name" text NOT NULL,
	"client_phone" text,
	"client_email" text,
	"service_type" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'new' NOT NULL,
	"source" text DEFAULT 'manual',
	"score" integer DEFAULT 0,
	"notes" text,
	"created_at" text NOT NULL,
	"last_contacted_at" text,
	"converted_at" text,
	"converted_job_id" text,
	"response_copied_at" text,
	"follow_up_status" text DEFAULT 'none',
	"follow_up_snoozed_until" text,
	"source_type" text,
	"source_url" text,
	"respond_tap_count" integer DEFAULT 0,
	"last_respond_tap_at" text
);
--> statement-breakpoint
CREATE TABLE "messaging_suppression" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"suppressed_at" text NOT NULL,
	"suppressed_by" varchar NOT NULL,
	"suppress_until" text NOT NULL,
	"reason" text NOT NULL,
	"unsuppressed_at" text,
	"unsuppressed_by" varchar
);
--> statement-breakpoint
CREATE TABLE "metrics_daily" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_date" text NOT NULL,
	"total_users" integer DEFAULT 0 NOT NULL,
	"new_users_today" integer DEFAULT 0 NOT NULL,
	"active_users_7d" integer DEFAULT 0 NOT NULL,
	"active_users_30d" integer DEFAULT 0 NOT NULL,
	"paying_customers" integer DEFAULT 0 NOT NULL,
	"mrr" integer DEFAULT 0 NOT NULL,
	"net_churn_pct" double precision DEFAULT 0 NOT NULL,
	"first_booking_rate" double precision,
	"median_time_to_first_booking" double precision,
	"failed_payments_24h" integer DEFAULT 0 NOT NULL,
	"failed_payments_7d" integer DEFAULT 0 NOT NULL,
	"revenue_at_risk" integer DEFAULT 0 NOT NULL,
	"chargebacks_30d" integer DEFAULT 0 NOT NULL,
	"paying_users_inactive_7d" integer DEFAULT 0 NOT NULL,
	"churned_users_7d" integer DEFAULT 0 NOT NULL,
	"churned_users_30d" integer DEFAULT 0 NOT NULL,
	"bookings_per_active_user" double precision,
	"total_leads" integer DEFAULT 0 NOT NULL,
	"leads_converted" integer DEFAULT 0 NOT NULL,
	"total_jobs" integer DEFAULT 0 NOT NULL,
	"jobs_completed" integer DEFAULT 0 NOT NULL,
	"total_invoices" integer DEFAULT 0 NOT NULL,
	"invoices_paid" integer DEFAULT 0 NOT NULL,
	"created_at" text,
	CONSTRAINT "metrics_daily_metric_date_unique" UNIQUE("metric_date")
);
--> statement-breakpoint
CREATE TABLE "next_actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"stall_detection_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"recommended_action" text NOT NULL,
	"reason" text NOT NULL,
	"auto_executable" boolean DEFAULT false,
	"expires_at" text NOT NULL,
	"acted_at" text,
	"dismissed_at" text,
	"auto_executed_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"expires_at" text NOT NULL,
	"verified" boolean DEFAULT false,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"client_id" varchar,
	"channel" text NOT NULL,
	"to_address" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"scheduled_for" text NOT NULL,
	"sent_at" text,
	"canceled_at" text,
	"failure_reason" text,
	"template_rendered" text,
	"metadata" text,
	"created_at" text NOT NULL,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "outcome_metrics_daily" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"metric_date" text NOT NULL,
	"invoices_paid_count" integer DEFAULT 0 NOT NULL,
	"invoices_paid_amount" integer DEFAULT 0 NOT NULL,
	"avg_days_to_paid" double precision,
	"reminders_sent_count" integer DEFAULT 0 NOT NULL,
	"nudges_acted_count" integer DEFAULT 0 NOT NULL,
	"leads_converted_count" integer DEFAULT 0 NOT NULL,
	"estimated_days_saved" double precision DEFAULT 0 NOT NULL,
	"estimated_cash_accelerated" integer DEFAULT 0 NOT NULL,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "photo_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" varchar,
	"workspace_user_id" varchar NOT NULL,
	"source_type" text NOT NULL,
	"source_id" varchar NOT NULL,
	"storage_bucket" text NOT NULL,
	"storage_path" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_confirmations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"service_type" text,
	"agreed_price" integer NOT NULL,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"confirmation_token" text NOT NULL,
	"sent_at" text,
	"viewed_at" text,
	"confirmed_at" text,
	"converted_job_id" text,
	"created_at" text NOT NULL,
	"updated_at" text,
	CONSTRAINT "price_confirmations_confirmation_token_unique" UNIQUE("confirmation_token")
);
--> statement-breakpoint
CREATE TABLE "provider_services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"licensed" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ready_actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"intent_signal_id" varchar,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"action_type" text NOT NULL,
	"headline" text NOT NULL,
	"subtext" text NOT NULL,
	"cta_label" text DEFAULT 'Send & Get Paid' NOT NULL,
	"prefilled_amount" double precision,
	"prefilled_client_name" text,
	"prefilled_client_email" text,
	"prefilled_client_phone" text,
	"prefilled_due_date" text,
	"prefilled_service_type" text,
	"prefilled_description" text,
	"expires_at" text NOT NULL,
	"acted_at" text,
	"dismissed_at" text,
	"auto_follow_up_sent" boolean DEFAULT false,
	"auto_follow_up_sent_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" varchar NOT NULL,
	"referred_email" text,
	"referred_phone" text,
	"referred_user_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reward_amount" integer DEFAULT 0,
	"created_at" text NOT NULL,
	"converted_at" text,
	"redeemed_at" text
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"client_name" text NOT NULL,
	"client_phone" text,
	"client_email" text,
	"message" text NOT NULL,
	"channel" text DEFAULT 'sms' NOT NULL,
	"scheduled_at" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"acknowledged_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"invoice_id" varchar,
	"client_name" text NOT NULL,
	"client_email" text,
	"client_phone" text,
	"rating" integer NOT NULL,
	"comment" text,
	"provider_response" text,
	"responded_at" text,
	"is_public" boolean DEFAULT true,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" text NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_phone" text NOT NULL,
	"client_name" text,
	"direction" text NOT NULL,
	"body" text NOT NULL,
	"twilio_sid" text,
	"related_job_id" varchar,
	"related_lead_id" varchar,
	"is_read" boolean DEFAULT false,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stall_detections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"stall_type" text NOT NULL,
	"money_at_risk" integer DEFAULT 0,
	"confidence" double precision DEFAULT 0.5,
	"detected_at" text NOT NULL,
	"resolved_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_disputes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_dispute_id" text NOT NULL,
	"charge_id" text,
	"payment_intent_id" text,
	"connected_account_id" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"reason" text,
	"status" text NOT NULL,
	"evidence_due_by" text,
	"evidence_submitted_at" text,
	"last_event_id" text,
	"last_event_type" text,
	"last_updated_at" text NOT NULL,
	"metadata" text,
	"job_id" varchar,
	"invoice_id" varchar,
	"booking_id" varchar,
	"created_at" text DEFAULT now() NOT NULL,
	"resolved_at" text,
	"resolution" text,
	CONSTRAINT "stripe_disputes_stripe_dispute_id_unique" UNIQUE("stripe_dispute_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_idempotency_locks" (
	"key" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_payment_state" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_intent_id" text NOT NULL,
	"charge_id" text,
	"customer_id" text,
	"connected_account_id" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text NOT NULL,
	"last_event_id" text,
	"last_event_type" text,
	"last_updated_at" text NOT NULL,
	"metadata" text,
	"job_id" varchar,
	"invoice_id" varchar,
	CONSTRAINT "stripe_payment_state_payment_intent_id_unique" UNIQUE("payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" text NOT NULL,
	"type" text NOT NULL,
	"api_version" text,
	"livemode" boolean DEFAULT false NOT NULL,
	"account" text,
	"created" text,
	"payload" text NOT NULL,
	"received_at" text NOT NULL,
	"processed_at" text,
	"status" text DEFAULT 'received' NOT NULL,
	"error" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" text,
	CONSTRAINT "stripe_webhook_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "user_admin_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text,
	"actor_user_id" varchar NOT NULL,
	"target_user_id" varchar NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_automation_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"post_job_followup_enabled" boolean DEFAULT true,
	"followup_delay_hours" integer DEFAULT 24,
	"followup_template" text DEFAULT 'Hi {{client_first_name}} — thanks again for choosing me. If you need anything else, just reply here.',
	"payment_reminder_enabled" boolean DEFAULT true,
	"payment_reminder_delay_hours" integer DEFAULT 24,
	"payment_reminder_template" text DEFAULT 'Hi {{client_first_name}} — quick note: the invoice for {{job_title}} is still open. No rush—sharing here in case it got buried: {{invoice_link}}',
	"review_link_url" text,
	"auto_confirm_enabled" boolean DEFAULT true,
	"confirmation_template" text DEFAULT 'Hi {{client_first_name}} — just confirming we''re set for {{job_date}} at {{job_time}}. Reply YES to confirm, or let me know if anything changes.',
	"created_at" text NOT NULL,
	"updated_at" text,
	CONSTRAINT "user_automation_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_flags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"flagged_at" text NOT NULL,
	"flagged_by" varchar NOT NULL,
	"reason" text NOT NULL,
	"unflagged_at" text,
	"unflagged_by" varchar
);
--> statement-breakpoint
CREATE TABLE "user_payment_methods" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"label" text,
	"instructions" text,
	"is_enabled" boolean DEFAULT true,
	"created_at" text NOT NULL,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"name" text,
	"phone" text,
	"country_code" text,
	"email" text,
	"photo" text,
	"business_name" text,
	"services" text[],
	"bio" text,
	"service_area" text,
	"availability" text,
	"slot_duration" integer DEFAULT 60,
	"onboarding_completed" boolean DEFAULT false,
	"onboarding_step" integer DEFAULT 0,
	"onboarding_state" text DEFAULT 'not_started',
	"default_service_type" text,
	"default_price" integer,
	"default_price_min" integer,
	"default_price_max" integer,
	"pricing_type" text DEFAULT 'fixed',
	"deposit_policy_set" boolean DEFAULT false,
	"ai_expectation_shown" boolean DEFAULT false,
	"is_pro" boolean DEFAULT false,
	"pro_expires_at" text,
	"notify_by_sms" boolean DEFAULT true,
	"notify_by_email" boolean DEFAULT true,
	"last_active_at" text,
	"public_profile_enabled" boolean DEFAULT true,
	"public_profile_slug" text,
	"show_reviews_on_booking" boolean DEFAULT true,
	"referral_code" text,
	"referred_by" text,
	"created_at" text,
	"stripe_connect_account_id" text,
	"stripe_connect_status" text DEFAULT 'not_connected',
	"stripe_connect_onboarded_at" text,
	"deposit_enabled" boolean DEFAULT false,
	"deposit_type" text DEFAULT 'percent',
	"deposit_value" integer DEFAULT 50,
	"late_reschedule_window_hours" integer DEFAULT 24,
	"late_reschedule_retain_pct_first" integer DEFAULT 40,
	"late_reschedule_retain_pct_second" integer DEFAULT 60,
	"late_reschedule_retain_pct_cap" integer DEFAULT 75,
	"public_estimation_enabled" boolean DEFAULT true,
	"no_show_protection_enabled" boolean DEFAULT true,
	"no_show_protection_deposit_percent" integer DEFAULT 25,
	"no_show_protection_price_threshold" integer DEFAULT 10000,
	"email_signature_text" text,
	"email_signature_logo_url" text,
	"email_signature_include_logo" boolean DEFAULT true,
	"booking_link_created_at" text,
	"booking_link_shared_at" text,
	"first_paid_booking_at" text,
	"first_payment_received_at" text,
	"required_support_for_payment" boolean DEFAULT false,
	"plan" text DEFAULT 'free',
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_credit" integer DEFAULT 0,
	"firebase_uid" text,
	"email_normalized" text,
	"phone_e164" text,
	"auth_provider" text,
	"updated_at" text,
	"deleted_at" text,
	"comp_access_granted_at" text,
	"comp_access_expires_at" text,
	"comp_access_granted_by" varchar,
	"comp_access_revoked_at" text,
	"comp_access_revoked_by" varchar,
	"is_disabled" boolean DEFAULT false,
	"disabled_at" text,
	"disabled_by" varchar,
	"disabled_reason" text,
	"enabled_at" text,
	"enabled_by" varchar,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid")
);
--> statement-breakpoint
CREATE TABLE "voice_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"audio_url" text,
	"transcript" text,
	"summary" text,
	"key_points" text[],
	"type" text DEFAULT 'other',
	"duration" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_action_audit_target_user_idx" ON "admin_action_audit" USING btree ("target_user_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_action_audit_action_key_idx" ON "admin_action_audit" USING btree ("action_key","created_at");--> statement-breakpoint
CREATE INDEX "admins_user_id_idx" ON "admins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "admins_email_idx" ON "admins" USING btree ("email");--> statement-breakpoint
CREATE INDEX "ai_interventions_user_idx" ON "ai_interventions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_interventions_date_idx" ON "ai_interventions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_overrides_user_idx" ON "ai_overrides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_overrides_entity_idx" ON "ai_overrides" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ai_overrides_type_idx" ON "ai_overrides" USING btree ("override_type");--> statement-breakpoint
CREATE INDEX "auto_execution_log_user_idx" ON "auto_execution_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auto_execution_log_entity_idx" ON "auto_execution_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "booking_protections_job_idx" ON "booking_protections" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "booking_protections_user_idx" ON "booking_protections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "campaign_suggestions_user_idx" ON "campaign_suggestions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "campaign_suggestions_status_idx" ON "campaign_suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "capability_usage_user_capability_idx" ON "capability_usage" USING btree ("user_id","capability");--> statement-breakpoint
CREATE INDEX "campaigns_user_idx" ON "client_notification_campaigns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "campaigns_service_idx" ON "client_notification_campaigns" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "campaigns_sent_idx" ON "client_notification_campaigns" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "clients_user_idx" ON "clients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clients_phone_idx" ON "clients" USING btree ("client_phone");--> statement-breakpoint
CREATE INDEX "clients_email_idx" ON "clients" USING btree ("client_email");--> statement-breakpoint
CREATE INDEX "intent_signals_user_idx" ON "intent_signals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "intent_signals_entity_idx" ON "intent_signals" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "messaging_suppression_user_idx" ON "messaging_suppression" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "next_actions_user_idx" ON "next_actions" USING btree ("user_id","entity_type");--> statement-breakpoint
CREATE INDEX "next_actions_entity_idx" ON "next_actions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "outbound_messages_status_scheduled_idx" ON "outbound_messages" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "outbound_messages_job_type_idx" ON "outbound_messages" USING btree ("job_id","type");--> statement-breakpoint
CREATE INDEX "outbound_messages_user_status_idx" ON "outbound_messages" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "provider_services_user_idx" ON "provider_services" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "provider_services_category_idx" ON "provider_services" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ready_actions_user_idx" ON "ready_actions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ready_actions_entity_idx" ON "ready_actions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "stall_detections_user_idx" ON "stall_detections" USING btree ("user_id","entity_type");--> statement-breakpoint
CREATE INDEX "stall_detections_entity_idx" ON "stall_detections" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "stripe_disputes_dispute_id_idx" ON "stripe_disputes" USING btree ("stripe_dispute_id");--> statement-breakpoint
CREATE INDEX "stripe_disputes_status_idx" ON "stripe_disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stripe_disputes_job_idx" ON "stripe_disputes" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "stripe_disputes_invoice_idx" ON "stripe_disputes" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "stripe_disputes_booking_idx" ON "stripe_disputes" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "stripe_payment_state_job_idx" ON "stripe_payment_state" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "stripe_payment_state_invoice_idx" ON "stripe_payment_state" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "stripe_payment_state_status_idx" ON "stripe_payment_state" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stripe_webhook_events_status_next_attempt_idx" ON "stripe_webhook_events" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "stripe_webhook_events_type_idx" ON "stripe_webhook_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "user_admin_notes_target_user_idx" ON "user_admin_notes" USING btree ("target_user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_automation_settings_user_idx" ON "user_automation_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_flags_user_idx" ON "user_flags" USING btree ("user_id");