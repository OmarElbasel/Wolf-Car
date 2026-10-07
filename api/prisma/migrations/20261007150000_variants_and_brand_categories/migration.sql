-- Colour/size variants of one Odoo product are shown as one card, and a
-- brand's products are listed inside each of its car models.
ALTER TABLE "products" ADD COLUMN "odoo_template_id" INTEGER;
ALTER TABLE "products" ADD COLUMN "variant_label" VARCHAR(60);
ALTER TABLE "products" ADD COLUMN "variant_color" VARCHAR(7);
CREATE INDEX "products_odoo_template_id_idx" ON "products"("odoo_template_id");

ALTER TABLE "categories" ADD COLUMN "parent_id" UUID;
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
