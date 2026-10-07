-- Odoo becomes the catalogue's source. Adds the link columns and a "hidden"
-- switch. Hides nothing by itself: the import command does that.
ALTER TABLE "products" ADD COLUMN "odoo_id" INTEGER;
ALTER TABLE "products" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "products_odoo_id_key" ON "products"("odoo_id");

ALTER TABLE "categories" ADD COLUMN "odoo_id" INTEGER;
CREATE UNIQUE INDEX "categories_odoo_id_key" ON "categories"("odoo_id");
