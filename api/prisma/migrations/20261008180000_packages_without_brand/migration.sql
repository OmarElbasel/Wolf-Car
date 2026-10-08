-- The film brand behind each PPF package changes from time to time, so the
-- packages are named "Package 1/2/3" only. Renames just the names the system
-- wrote itself: a package already renamed in the dashboard is left alone.
-- Order lines of past orders keep the name they were placed with.
UPDATE "products" p
   SET "name" = replace(replace(p."name", ' · ' || t."name_ar", ' · ' || split_part(t."name_ar", ' · ', 1)), '  ', ' ')
  FROM "service_tiers" t
 WHERE p."service_tier_id" = t."id"
   AND t."set" = 'ppf'
   AND t."name_en" IN ('Package 1 · Xpel', 'Package 2 · Onyx', 'Package 3 · Ultra Guard');

UPDATE "service_tiers"
   SET "name_ar" = split_part("name_ar", ' · ', 1),
       "name_en" = split_part("name_en", ' · ', 1)
 WHERE "set" = 'ppf'
   AND "name_en" IN ('Package 1 · Xpel', 'Package 2 · Onyx', 'Package 3 · Ultra Guard');
