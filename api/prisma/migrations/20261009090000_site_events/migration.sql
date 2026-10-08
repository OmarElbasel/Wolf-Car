-- Anonymous visitor statistics for the public website: page views and presses
-- on the contact buttons. No cookie and no IP address is stored; "visitor" is
-- a hash that changes every day.
CREATE TABLE "site_events" (
    "id" BIGSERIAL NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "day" DATE NOT NULL,
    "type" VARCHAR(24) NOT NULL,
    "visitor" CHAR(32) NOT NULL,
    "path" VARCHAR(200) NOT NULL,
    "locale" VARCHAR(2) NOT NULL,
    "entry" BOOLEAN NOT NULL DEFAULT false,
    "source" VARCHAR(24),
    "referrer_host" VARCHAR(100),
    "device" VARCHAR(8) NOT NULL,
    "label" VARCHAR(160),
    "target_id" VARCHAR(64),

    CONSTRAINT "site_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "site_events_day_type_idx" ON "site_events"("day", "type");
CREATE INDEX "site_events_day_visitor_idx" ON "site_events"("day", "visitor");
