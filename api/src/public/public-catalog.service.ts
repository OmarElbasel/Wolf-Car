import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { imageUrl } from '../uploads/image-processing';

/**
 * The only product fields that may ever leave the API unauthenticated. The
 * price is public (the website shows it and builds the WhatsApp order from
 * it); the barcode and every audit field are not.
 */
export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  /** "1800.00" (QAR), or null while Finance has not priced it */
  price: string | null;
  imageUrl: string;
  thumbUrl: string;
}

/** A car-model grouping as shown publicly, with how many products it holds. */
export interface PublicCategory {
  id: string;
  name: string;
  /** English name for the /en pages; null means show `name` */
  nameEn: string | null;
  carModel: string | null;
  imageUrl: string | null;
  thumbUrl: string | null;
  count: number;
}

@Injectable()
export class PublicCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(categoryId?: string): Promise<PublicProduct[]> {
    // explicit select: the barcode is never read, so it cannot leak
    const rows = await this.prisma.product.findMany({
      where: categoryId ? { categoryId, category: { isActive: true } } : undefined,
      select: { id: true, name: true, description: true, categoryId: true, price: true, imageKey: true },
      orderBy: { name: 'asc' },
      take: 5000,
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      categoryId: p.categoryId,
      price: p.price ? p.price.toFixed(2) : null,
      imageUrl: imageUrl(p.imageKey),
      thumbUrl: imageUrl(p.imageKey, 'sm'),
    }));
  }

  /** Active categories that hold at least one product, largest first. */
  async categories(): Promise<PublicCategory[]> {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true, products: { some: {} } },
      select: {
        id: true,
        name: true,
        nameEn: true,
        carModel: true,
        imageKey: true,
        position: true,
        _count: { select: { products: true } },
      },
    });
    return rows
      .sort((a, b) => b._count.products - a._count.products || a.position - b.position || a.name.localeCompare(b.name))
      .map((c) => ({
        id: c.id,
        name: c.name,
        nameEn: c.nameEn,
        carModel: c.carModel,
        imageUrl: c.imageKey ? imageUrl(c.imageKey) : null,
        thumbUrl: c.imageKey ? imageUrl(c.imageKey, 'sm') : null,
        count: c._count.products,
      }));
  }
}
