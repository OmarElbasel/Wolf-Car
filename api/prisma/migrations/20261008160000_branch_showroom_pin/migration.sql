-- The showroom screen signs in with its branch and a 6-digit PIN instead of a
-- staff username and password. Wrong PINs are counted on the branch.
ALTER TABLE "branches" ADD COLUMN "showroom_pin_hash" TEXT;
ALTER TABLE "branches" ADD COLUMN "showroom_pin_failed_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "branches" ADD COLUMN "showroom_pin_locked_until" TIMESTAMPTZ(3);
