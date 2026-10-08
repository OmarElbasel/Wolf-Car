-- A service may have one of the shop's posters shown with it ("front-full",
-- "front-quarter"). The complete packages have a poster per package instead.
ALTER TABLE "services" ADD COLUMN "poster" VARCHAR(40);

-- databases that already hold the starting services
UPDATE "services" SET "poster" = 'front-full' WHERE "section" = 'ppfPartial' AND "name_en" LIKE 'Full front protection%';
UPDATE "services" SET "poster" = 'front-quarter' WHERE "section" = 'ppfPartial' AND "name_en" LIKE 'Quarter front protection%';
