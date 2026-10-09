-- Products listed under the website's "Quick service" tab as well as under their own car.
ALTER TABLE "products" ADD COLUMN "is_quick_service" BOOLEAN NOT NULL DEFAULT false;

-- First pass, reviewed afterwards in the dashboard: filters, oils, brake pads
-- and coolant by name. Gaskets ("جوان") mention the oil but are not a service part.
UPDATE "products"
   SET "is_quick_service" = true
 WHERE "service_id" IS NULL
   AND "name" ~* '(فلتر|فلاتر|زيت|فحمات|ماء تبريد|\moil\M|\mfilters?\M|brake pads?)'
   AND "name" !~ 'جوان';

-- the colours or sizes of one product share a card, so they go together
UPDATE "products" p
   SET "is_quick_service" = true
 WHERE p."variant_label" IS NOT NULL
   AND p."odoo_template_id" IN (
     SELECT q."odoo_template_id" FROM "products" q
      WHERE q."is_quick_service" AND q."odoo_template_id" IS NOT NULL AND q."variant_label" IS NOT NULL
   );
