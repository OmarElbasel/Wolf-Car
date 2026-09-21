-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'FINANCE', 'BRANCH_MANAGER', 'CASHIER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('GRANT', 'REVOKE');

-- CreateEnum
CREATE TYPE "SessionAudience" AS ENUM ('DASHBOARD', 'SHOWROOM');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "code" VARCHAR(4) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "name_ar" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order_seq" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(40) NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254),
    "role" "Role" NOT NULL,
    "branch_id" UUID,
    "password_hash" TEXT NOT NULL,
    "showroom_password_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(3),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "showroom_failed_count" INTEGER NOT NULL DEFAULT 0,
    "showroom_locked_until" TIMESTAMPTZ(3),
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret_enc" TEXT,
    "two_factor_pending_secret_enc" TEXT,
    "two_factor_last_step" INTEGER,
    "last_login_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "key" VARCHAR(64) NOT NULL,
    "group" VARCHAR(32) NOT NULL,
    "description" VARCHAR(255) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role" "Role" NOT NULL,
    "permission_key" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role","permission_key")
);

-- CreateTable
CREATE TABLE "user_permission_overrides" (
    "user_id" UUID NOT NULL,
    "permission_key" VARCHAR(64) NOT NULL,
    "effect" "PermissionEffect" NOT NULL,
    "granted_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("user_id","permission_key")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "audience" "SessionAudience" NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" VARCHAR(40),
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000),
    "barcode" VARCHAR(64),
    "image_key" UUID NOT NULL,
    "price" DECIMAL(12,2),
    "price_updated_at" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_products" (
    "branch_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "branch_products_pkey" PRIMARY KEY ("branch_id","product_id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "old_price" DECIMAL(12,2),
    "new_price" DECIMAL(12,2) NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "customer_name" VARCHAR(80) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "total" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'QAR',
    "created_by_id" UUID NOT NULL,
    "confirmed_by_id" UUID,
    "confirmed_at" TIMESTAMPTZ(3),
    "cancelled_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(3),
    "idempotency_key" VARCHAR(80),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name" VARCHAR(120) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" BIGSERIAL NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "actor_username" VARCHAR(40),
    "actor_role" "Role",
    "branch_id" UUID,
    "action" VARCHAR(64) NOT NULL,
    "entity_type" VARCHAR(32),
    "entity_id" VARCHAR(64),
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "outcome" "AuditOutcome" NOT NULL,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "request_id" VARCHAR(64),

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_branch_id_idx" ON "users"("branch_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- CreateIndex
CREATE INDEX "recovery_codes_user_id_idx" ON "recovery_codes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "branch_products_branch_id_position_key" ON "branch_products"("branch_id", "position");

-- CreateIndex
CREATE INDEX "price_history_product_id_changed_at_idx" ON "price_history"("product_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_code_key" ON "orders"("code");

-- CreateIndex
CREATE INDEX "orders_branch_id_status_created_at_idx" ON "orders"("branch_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_branch_id_number_key" ON "orders"("branch_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_created_by_id_idempotency_key_key" ON "orders"("created_by_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_product_id_key" ON "order_items"("order_id", "product_id");

-- CreateIndex
CREATE INDEX "activity_logs_occurred_at_idx" ON "activity_logs"("occurred_at");

-- CreateIndex
CREATE INDEX "activity_logs_actor_id_occurred_at_idx" ON "activity_logs"("actor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "activity_logs_branch_id_occurred_at_idx" ON "activity_logs"("branch_id", "occurred_at");

-- CreateIndex
CREATE INDEX "activity_logs_action_occurred_at_idx" ON "activity_logs"("action", "occurred_at");

-- CreateIndex
CREATE INDEX "activity_logs_entity_type_entity_id_idx" ON "activity_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "permissions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "permissions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Hand-written constraints (not expressible in schema.prisma).
-- Keep them when generating future migrations: Prisma does not model partial
-- indexes, CHECKs or triggers, so review generated SQL for stray DROPs.
-- ============================================================================

-- Reorder rewrites every position of a branch in one UPDATE. A DEFERRABLE
-- unique constraint is checked at commit instead of row by row, so positions
-- can be swapped. Same name as the Prisma-declared index, so no schema drift.
DROP INDEX "branch_products_branch_id_position_key";
ALTER TABLE "branch_products"
  ADD CONSTRAINT "branch_products_branch_id_position_key"
  UNIQUE ("branch_id", "position") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_position_check" CHECK ("position" >= 0);

-- Users: branch roles must have a branch; SUPER_ADMIN and FINANCE must not.
ALTER TABLE "users" ADD CONSTRAINT "users_role_branch_check"
  CHECK ((role IN ('BRANCH_MANAGER', 'CASHIER')) = (branch_id IS NOT NULL));
ALTER TABLE "users" ADD CONSTRAINT "users_username_format_check"
  CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,39}$');
ALTER TABLE "users" ADD CONSTRAINT "users_showroom_password_check"
  CHECK (showroom_password_hash IS NULL OR branch_id IS NOT NULL);

-- Each branch has at most one (non-deleted) manager and one cashier...
CREATE UNIQUE INDEX "users_one_manager_per_branch" ON "users" ("branch_id")
  WHERE role = 'BRANCH_MANAGER' AND deleted_at IS NULL;
CREATE UNIQUE INDEX "users_one_cashier_per_branch" ON "users" ("branch_id")
  WHERE role = 'CASHIER' AND deleted_at IS NULL;

-- ...and at least one of each. Checked at COMMIT, so a branch and its two users
-- are created (or a user is replaced) inside a single transaction.
CREATE FUNCTION assert_branch_staffed(p_branch_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  managers int;
  cashiers int;
BEGIN
  IF p_branch_id IS NULL OR NOT EXISTS (SELECT 1 FROM branches WHERE id = p_branch_id) THEN
    RETURN;
  END IF;
  SELECT count(*) FILTER (WHERE role = 'BRANCH_MANAGER'),
         count(*) FILTER (WHERE role = 'CASHIER')
    INTO managers, cashiers
    FROM users
   WHERE branch_id = p_branch_id AND deleted_at IS NULL;
  IF managers <> 1 OR cashiers <> 1 THEN
    RAISE EXCEPTION 'branch % must have exactly one manager and one cashier (has % and %)',
      p_branch_id, managers, cashiers
      USING ERRCODE = 'check_violation', CONSTRAINT = 'branch_staffing';
  END IF;
END $$;

CREATE FUNCTION check_branch_staffing() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'branches' THEN
    PERFORM assert_branch_staffed(NEW.id);
  ELSE
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      PERFORM assert_branch_staffed(OLD.branch_id);
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      PERFORM assert_branch_staffed(NEW.branch_id);
    END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "branches_staffing"
  AFTER INSERT ON "branches"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_branch_staffing();

CREATE CONSTRAINT TRIGGER "users_branch_staffing"
  AFTER INSERT OR UPDATE OF role, branch_id, deleted_at OR DELETE ON "users"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_branch_staffing();

-- Money and order sanity.
ALTER TABLE "products" ADD CONSTRAINT "products_price_check" CHECK (price IS NULL OR price >= 0);
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_new_price_check" CHECK (new_price >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_check" CHECK (total >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_number_check" CHECK (number > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_timestamps_check"
  CHECK ((status <> 'CONFIRMED' OR confirmed_at IS NOT NULL)
     AND (status <> 'CANCELLED' OR cancelled_at IS NOT NULL));
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_check" CHECK (quantity BETWEEN 1 AND 99);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_amounts_check"
  CHECK (unit_price >= 0 AND line_total = unit_price * quantity);

-- The activity log is append-only.
CREATE FUNCTION activity_logs_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'activity_logs is append-only' USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER "activity_logs_append_only"
  BEFORE UPDATE OR DELETE ON "activity_logs"
  FOR EACH ROW EXECUTE FUNCTION activity_logs_append_only();
