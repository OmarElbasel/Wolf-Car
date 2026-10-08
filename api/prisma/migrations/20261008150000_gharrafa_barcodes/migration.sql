-- Al Gharrafa's cashier now scans barcodes off the showroom screen too. Its
-- till is not Odoo: it knows a multi-colour product by one code, so its
-- screens show the colours' shared barcode, without Odoo's colour digit.
ALTER TABLE "branches" ADD COLUMN "barcode_without_colour" BOOLEAN NOT NULL DEFAULT false;
UPDATE "branches" SET "scan_from_screen" = true, "barcode_without_colour" = true WHERE "code" = 'GH';
