-- Bin Omran's cashier works in Odoo and scans product barcodes off the
-- showroom screen. Other branches keep the showroom as it was.
ALTER TABLE "branches" ADD COLUMN "scan_from_screen" BOOLEAN NOT NULL DEFAULT false;
UPDATE "branches" SET "scan_from_screen" = true WHERE "code" = 'BO';
