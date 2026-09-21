import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { imageUrl } from '../uploads/image-processing';

/** The only product fields that may ever leave the API unauthenticated. */
export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  thumbUrl: string;
}

@Injectable()
export class PublicCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<PublicProduct[]> {
    // explicit select: price and barcode are never read, so they cannot leak
    const rows = await this.prisma.product.findMany({
      select: { id: true, name: true, description: true, imageKey: true },
      orderBy: { name: 'asc' },
      take: 1000,
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: imageUrl(p.imageKey),
      thumbUrl: imageUrl(p.imageKey, 'sm'),
    }));
  }
}
