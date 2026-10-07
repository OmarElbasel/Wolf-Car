import { money } from '../common/money';
import type { Prisma } from '../generated/prisma/client';
import { imageUrl } from '../uploads/image-processing';

export const PRODUCT_SELECT = {
  id: true,
  name: true,
  description: true,
  barcode: true,
  isActive: true,
  odooId: true,
  imageKey: true,
  price: true,
  priceUpdatedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, displayName: true } },
} as const;

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  barcode: string | null;
  isActive: boolean;
  odooId: number | null;
  imageKey: string;
  price: Prisma.Decimal | null;
  priceUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; displayName: string };
};

/** Internal (staff) view: includes price and barcode. */
export function productView(p: ProductRow, position?: number) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    barcode: p.barcode,
    isActive: p.isActive,
    /** its name, barcode, photo and price are kept up to date from Odoo and cannot be edited here */
    fromOdoo: p.odooId !== null,
    price: money(p.price),
    priceUpdatedAt: p.priceUpdatedAt,
    imageUrl: imageUrl(p.imageKey),
    thumbUrl: imageUrl(p.imageKey, 'sm'),
    createdBy: p.createdBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    ...(position !== undefined ? { position } : {}),
  };
}

export type ProductView = ReturnType<typeof productView>;
