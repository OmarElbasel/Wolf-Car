-- A day may now hold two full PPF cars (the second is an exception), so the
-- one-per-day index goes; the API counts under a per-day lock instead.
DROP INDEX "ppf_bookings_one_full_per_day";

-- Sales may ask for a full PPF as well as a light job. Existing requests are light jobs.
ALTER TABLE "light_job_requests" ADD COLUMN "type" "PpfBookingType" NOT NULL DEFAULT 'LIGHT';
-- A full PPF request needs no description of the job.
ALTER TABLE "light_job_requests" ALTER COLUMN "note" DROP NOT NULL;
