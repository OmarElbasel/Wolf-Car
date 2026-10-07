-- The Odoo catalogue sync runs by itself: remember what each product looked
-- like in Odoo at its last sync, and keep a record of the runs.
ALTER TABLE "products" ADD COLUMN "odoo_stamp" VARCHAR(80);

CREATE TABLE "odoo_sync_runs" (
    "id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "trigger" VARCHAR(40) NOT NULL,
    "ok" BOOLEAN,
    "summary" JSONB,
    "error" VARCHAR(600),

    CONSTRAINT "odoo_sync_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "odoo_sync_runs_started_at_idx" ON "odoo_sync_runs"("started_at");
