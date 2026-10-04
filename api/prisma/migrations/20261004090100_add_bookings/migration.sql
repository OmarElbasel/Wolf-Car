CREATE TYPE "PpfBookingType" AS ENUM ('FULL', 'LIGHT');
CREATE TYPE "BookingStatus" AS ENUM ('BOOKED', 'CANCELLED');
CREATE TYPE "LightJobRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "ppf_bookings" (
    "id" UUID NOT NULL,
    "type" "PpfBookingType" NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'BOOKED',
    "car" VARCHAR(80) NOT NULL,
    "owner_name" VARCHAR(80) NOT NULL,
    "phone" VARCHAR(20),
    "service" VARCHAR(200),
    "receive_date" DATE NOT NULL,
    "delivery_date" DATE,
    "note" VARCHAR(1000),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "cancelled_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "ppf_bookings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ppf_closed_days" (
    "date" DATE NOT NULL,
    "reason" VARCHAR(200),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ppf_closed_days_pkey" PRIMARY KEY ("date")
);

CREATE TABLE "light_job_requests" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "sales_name" VARCHAR(80) NOT NULL,
    "car" VARCHAR(80) NOT NULL,
    "owner_name" VARCHAR(80) NOT NULL,
    "phone" VARCHAR(20),
    "note" VARCHAR(1000) NOT NULL,
    "status" "LightJobRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "decision_note" VARCHAR(500),
    "booking_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "light_job_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "general_reservations" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "time" VARCHAR(5),
    "service" VARCHAR(200) NOT NULL,
    "owner_name" VARCHAR(80),
    "phone" VARCHAR(20),
    "car" VARCHAR(80),
    "note" VARCHAR(1000),
    "status" "BookingStatus" NOT NULL DEFAULT 'BOOKED',
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "cancelled_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "general_reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_access" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "pin_hash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "sales_access_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ppf_bookings_receive_date_idx" ON "ppf_bookings"("receive_date");
CREATE UNIQUE INDEX "light_job_requests_booking_id_key" ON "light_job_requests"("booking_id");
CREATE INDEX "light_job_requests_status_created_at_idx" ON "light_job_requests"("status", "created_at");
CREATE INDEX "general_reservations_date_idx" ON "general_reservations"("date");

ALTER TABLE "ppf_bookings" ADD CONSTRAINT "ppf_bookings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ppf_bookings" ADD CONSTRAINT "ppf_bookings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ppf_bookings" ADD CONSTRAINT "ppf_bookings_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ppf_closed_days" ADD CONSTRAINT "ppf_closed_days_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "light_job_requests" ADD CONSTRAINT "light_job_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "light_job_requests" ADD CONSTRAINT "light_job_requests_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "ppf_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "general_reservations" ADD CONSTRAINT "general_reservations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "general_reservations" ADD CONSTRAINT "general_reservations_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "general_reservations" ADD CONSTRAINT "general_reservations_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_access" ADD CONSTRAINT "sales_access_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written constraints (not expressible in the Prisma schema).
-- ---------------------------------------------------------------------------

-- One active full PPF per day. Light jobs and cancelled bookings don't count.
CREATE UNIQUE INDEX "ppf_bookings_one_full_per_day" ON "ppf_bookings" ("receive_date")
  WHERE type = 'FULL' AND status = 'BOOKED';

ALTER TABLE "ppf_bookings" ADD CONSTRAINT "ppf_bookings_delivery_check"
  CHECK (delivery_date IS NULL OR delivery_date >= receive_date);
ALTER TABLE "ppf_bookings" ADD CONSTRAINT "ppf_bookings_cancelled_check"
  CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL));
ALTER TABLE "general_reservations" ADD CONSTRAINT "general_reservations_cancelled_check"
  CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL));
ALTER TABLE "sales_access" ADD CONSTRAINT "sales_access_single_row_check" CHECK (id = 1);
