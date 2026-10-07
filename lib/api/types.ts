import type { VariantInfo } from "@/lib/variants";
import type { OrderStatusName, PermissionGroup, PermissionKey, RoleName } from "@/shared/permissions";

export type { OrderStatusName, PermissionKey, RoleName };

export interface BranchSummary {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  /** the cashier scans barcodes off the showroom screen (sent by the showroom catalogue only) */
  scanFromScreen?: boolean;
}

export interface Profile {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: RoleName;
  branch: BranchSummary | null;
  twoFactorEnabled: boolean;
  hasShowroomPassword: boolean;
  permissions: PermissionKey[];
}

export interface AuthResult {
  accessToken: string;
  expiresIn: number;
  user: Profile;
}

export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challengeToken: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PersonRef {
  id: string;
  username: string;
  displayName: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  barcode: string | null;
  /** "125.50" (QAR) or null until Finance sets it */
  price: string | null;
  priceUpdatedAt: string | null;
  /** name, barcode, photo and price come from Odoo and are not edited here */
  fromOdoo?: boolean;
  imageUrl: string;
  thumbUrl: string;
  createdBy: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  /** position in the branch showroom order (when listed for a branch) */
  position?: number;
}

export interface PriceChange {
  id: string;
  oldPrice: string | null;
  newPrice: string;
  changedAt: string;
  changedBy: PersonRef & { role: RoleName };
}

export interface ShowroomProduct extends VariantInfo {
  id: string;
  name: string;
  description: string | null;
  barcode: string | null;
  categoryId: string | null;
  /** its own category plus, for a product common to a brand, each of that brand's models */
  categoryIds?: string[];
  price: string;
  imageUrl: string;
  thumbUrl: string;
}

/** A showroom tab: usually a car model, sometimes an accessory line. */
export interface ShowroomCategory {
  id: string;
  name: string;
  carModel: string | null;
  imageUrl: string | null;
  thumbUrl: string | null;
  /** how many priced products this branch has in the category */
  count: number;
}

export interface OrderSummary {
  id: string;
  code: string;
  number: number;
  status: OrderStatusName;
  customerName: string;
  total: string;
  currency: string;
  itemCount: number;
  branch: BranchSummary;
  createdBy: PersonRef;
  confirmedBy: PersonRef | null;
  confirmedAt: string | null;
  cancelledBy: PersonRef | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  barcode: string | null;
  thumbUrl: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
}

export interface UserView {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: RoleName;
  branch: BranchSummary | null;
  isActive: boolean;
  twoFactorEnabled: boolean;
  hasShowroomPassword: boolean;
  locked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Plaintext credentials returned exactly once by the API. */
export interface IssuedCredentials {
  userId: string;
  username: string;
  displayName: string;
  role: RoleName;
  branchCode: string | null;
  password?: string;
  showroomPassword?: string;
}

export interface StaffRef {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  isActive: boolean;
}

export interface BranchView {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  isActive: boolean;
  createdAt: string;
  manager: StaffRef | null;
  cashier: StaffRef | null;
}

export interface PermissionInfo {
  key: PermissionKey;
  group: PermissionGroup;
  description: string;
}

export interface RoleMatrix {
  roles: Record<RoleName, PermissionKey[]>;
  locked: RoleName[];
}

export interface UserPermissions {
  userId: string;
  role: RoleName;
  locked: boolean;
  rolePermissions: PermissionKey[];
  overrides: { permission: PermissionKey; effect: "GRANT" | "REVOKE" }[];
  effective: PermissionKey[];
}

export interface ActivityEntry {
  id: string;
  occurredAt: string;
  action: string;
  outcome: "SUCCESS" | "FAILURE";
  actor: { id: string | null; username: string | null; role: RoleName | null } | null;
  branch: BranchSummary | null;
  entityType: string | null;
  entityId: string | null;
  before: unknown;
  after: unknown;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export interface PublicProduct extends VariantInfo {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  /** "1800.00" (QAR), or null while the product has no price yet */
  price: string | null;
  imageUrl: string;
  thumbUrl: string;
}

/** A car-model category on the public site. */
export interface PublicCategory {
  id: string;
  /** Arabic name, as the branches use it */
  name: string;
  /** English name for /en; null means show `name` */
  nameEn: string | null;
  carModel: string | null;
  imageUrl: string | null;
  thumbUrl: string | null;
  /** how many products the category holds */
  count: number;
}

export interface BranchOption {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  isActive: boolean;
}
// ---- PPF bookings, general reservations, sales slots ----

export type PpfBookingType = "FULL" | "LIGHT";
export type BookingStatus = "BOOKED" | "CANCELLED";
export type DayState = "OPEN" | "FULL" | "CLOSED";
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

/** One day of the PPF calendar. Days are "YYYY-MM-DD" (Qatar). */
export interface DayInfo {
  date: string;
  state: DayState;
  reason: string | null;
  /** full PPF cars on the day: 1 closes it, 2 means the exception is used too */
  fullCount: number;
  lightCount: number;
}

export interface PpfBooking {
  id: string;
  type: PpfBookingType;
  status: BookingStatus;
  car: string;
  ownerName: string | null;
  phone: string | null;
  service: string | null;
  receiveDate: string;
  deliveryDate: string | null;
  note: string | null;
  /** the salesperson whose approved request created this booking */
  requestedBy: string | null;
  createdBy: { id: string; displayName: string };
  createdAt: string;
  cancelledAt: string | null;
}

export interface PpfCalendar {
  today: string;
  days: DayInfo[];
  bookings: PpfBooking[];
}

/** A salesperson's request for a booking: a full PPF or a light job. */
export interface LightJobRequest {
  id: string;
  date: string;
  type: PpfBookingType;
  salesName: string;
  car: string;
  ownerName: string;
  phone: string | null;
  note: string | null;
  status: RequestStatus;
  decisionNote: string | null;
  decidedAt: string | null;
  bookingId: string | null;
  createdAt: string;
}

export interface SalesAccessStatus {
  pinSet: boolean;
  updatedAt: string | null;
}

export interface GeneralReservation {
  id: string;
  date: string;
  /** "HH:mm" or null */
  time: string | null;
  service: string;
  ownerName: string | null;
  phone: string | null;
  car: string | null;
  note: string | null;
  status: BookingStatus;
  createdBy: { id: string; displayName: string };
  createdAt: string;
  cancelledAt: string | null;
}

export interface SalesBooking {
  id: string;
  type: PpfBookingType;
  car: string;
  ownerName: string | null;
  phone: string | null;
  receiveDate: string;
  deliveryDate: string | null;
}

export interface SalesRequest {
  id: string;
  date: string;
  type: PpfBookingType;
  salesName: string;
  car: string;
  status: RequestStatus;
  decisionNote: string | null;
  createdAt: string;
}

export interface SlotsView {
  today: string;
  days: DayInfo[];
  bookings: SalesBooking[];
  requests: SalesRequest[];
}
