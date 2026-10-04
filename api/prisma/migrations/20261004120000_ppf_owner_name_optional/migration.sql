-- Bookings are often taken before the customer's name is known.
ALTER TABLE "ppf_bookings" ALTER COLUMN "owner_name" DROP NOT NULL;
