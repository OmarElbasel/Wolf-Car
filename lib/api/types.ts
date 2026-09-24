import type { OrderStatusName, PermissionKey, RoleName } from "@/shared/permissions";

export type { OrderStatusName, PermissionKey, RoleName };

export interface BranchSummary {
  id: string;
  code: string;
  name: string;
  nameAr: string;
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

export interface ShowroomProduct {
  id: string;
  name: string;
  description: string | null;
  barcode: string | null;
  categoryId: string | null;
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
  group: "product" | "order" | "admin" | "account";
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

export interface PublicProduct {
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
