import { money } from '../common/money';
import type { OrderStatus, Prisma } from '../generated/prisma/client';
import { imageUrl } from '../uploads/image-processing';

const PERSON = { select: { id: true, username: true, displayName: true } } as const;

export const ORDER_LIST_SELECT = {
  id: true,
  code: true,
  number: true,
  status: true,
  customerName: true,
  total: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  confirmedAt: true,
  cancelledAt: true,
  branch: { select: { id: true, code: true, name: true, nameAr: true } },
  createdBy: PERSON,
  confirmedBy: PERSON,
  cancelledBy: PERSON,
  _count: { select: { items: true } },
} as const;

export const ORDER_DETAIL_SELECT = {
  ...ORDER_LIST_SELECT,
  items: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      productId: true,
      productName: true,
      unitPrice: true,
      quantity: true,
      lineTotal: true,
      product: { select: { imageKey: true, barcode: true } },
    },
  },
} as const;

type Person = { id: string; username: string; displayName: string } | null;

interface OrderRow {
  id: string;
  code: string;
  number: number;
  status: OrderStatus;
  customerName: string;
  total: Prisma.Decimal;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  branch: { id: string; code: string; name: string; nameAr: string };
  createdBy: NonNullable<Person>;
  confirmedBy: Person;
  cancelledBy: Person;
  _count: { items: number };
}

interface OrderDetailRow extends OrderRow {
  items: {
    id: string;
    productId: string;
    productName: string;
    unitPrice: Prisma.Decimal;
    quantity: number;
    lineTotal: Prisma.Decimal;
    product: { imageKey: string; barcode: string | null };
  }[];
}

export function orderSummary(o: OrderRow) {
  return {
    id: o.id,
    code: o.code,
    number: o.number,
    status: o.status,
    customerName: o.customerName,
    total: money(o.total),
    currency: o.currency,
    itemCount: o._count.items,
    branch: o.branch,
    createdBy: o.createdBy,
    confirmedBy: o.confirmedBy,
    confirmedAt: o.confirmedAt,
    cancelledBy: o.cancelledBy,
    cancelledAt: o.cancelledAt,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export function orderDetail(o: OrderDetailRow) {
  return {
    ...orderSummary(o),
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      barcode: i.product.barcode,
      thumbUrl: imageUrl(i.product.imageKey, 'sm'),
      unitPrice: money(i.unitPrice),
      quantity: i.quantity,
      lineTotal: money(i.lineTotal),
    })),
  };
}

export type OrderSummary = ReturnType<typeof orderSummary>;
export type OrderDetail = ReturnType<typeof orderDetail>;

/** What the audit log stores for an order (no personal data beyond the customer name). */
export function orderAuditView(o: OrderDetail) {
  return {
    code: o.code,
    status: o.status,
    customerName: o.customerName,
    total: o.total,
    items: o.items.map((i) => ({ productId: i.productId, productName: i.productName, unitPrice: i.unitPrice, quantity: i.quantity })),
  };
}
