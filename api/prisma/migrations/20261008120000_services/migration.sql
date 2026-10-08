-- Services and packages (PPF, tint, polish, paint) are kept here, not in Odoo,
-- and edited in the dashboard. Each price of a service is a hidden product row,
-- so orders and receipts treat it like any other line.
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "section" VARCHAR(20) NOT NULL,
    "name_ar" VARCHAR(80) NOT NULL,
    "name_en" VARCHAR(80) NOT NULL,
    "note_ar" VARCHAR(200),
    "note_en" VARCHAR(200),
    "tier_set" VARCHAR(20),
    "body_split" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "services_position_idx" ON "services"("position");

CREATE TABLE "service_tiers" (
    "id" UUID NOT NULL,
    "set" VARCHAR(20) NOT NULL,
    "name_ar" VARCHAR(40) NOT NULL,
    "name_en" VARCHAR(40) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_tiers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "service_tiers_set_position_idx" ON "service_tiers"("set", "position");

ALTER TABLE "products" ADD COLUMN "service_id" UUID;
ALTER TABLE "products" ADD COLUMN "service_tier_id" UUID;
ALTER TABLE "products" ADD COLUMN "service_body" VARCHAR(10);
CREATE INDEX "products_service_id_idx" ON "products"("service_id");
ALTER TABLE "products" ADD CONSTRAINT "products_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_service_tier_id_fkey"
  FOREIGN KEY ("service_tier_id") REFERENCES "service_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
