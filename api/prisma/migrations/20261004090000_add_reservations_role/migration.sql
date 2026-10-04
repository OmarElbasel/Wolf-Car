-- The call-center role that manages PPF bookings and general reservations.
-- It has no branch: users_role_branch_check already requires branch_id IS NULL
-- for every role other than BRANCH_MANAGER and CASHIER.
ALTER TYPE "Role" ADD VALUE 'RESERVATIONS';
