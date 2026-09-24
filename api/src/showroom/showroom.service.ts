import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuditTrail } from '../activity/audit-trail.service';
import { decimal, money } from '../common/money';
import type { AuthUser } from '../common/types';
import { Prisma } from '../generated/prisma/client';
import { ORDER_DETAIL_SELECT, orderAuditView, orderDetail, type OrderDetail } from '../orders/order.view';
import { PrismaService } from '../prisma/prisma.service';
import { imageUrl } from '../uploads/image-processing';
import type { CreateShowroomOrderDto } from '../orders/dto/orders.dto';

@Injectable()
export class ShowroomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trail: AuditTrail,
  ) {}

  /**
   * The branch's priced products in the manager-defined order, with full
   * details, plus the catalogue's categories so the kiosk can offer tabs.
   * Only categories that actually have a priced product here are returned.
   */
  async products(user: AuthUser) {
    const branch = await this.activeBranch(user);
    const rows = await this.prisma.branchProduct.findMany({
      where: { branchId: branch.id, product: { price: { not: null } } },
      orderBy: { position: 'asc' },
      select: {
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            barcode: true,
            price: true,
            imageKey: true,
            categoryId: true,
          },
        },
      },
    });
    const products = rows.map(({ product: p }) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      barcode: p.barcode,
      categoryId: p.categoryId,
      price: money(p.price) as string,
      imageUrl: imageUrl(p.imageKey),
      thumbUrl: imageUrl(p.imageKey, 'sm'),
    }));

    const used = new Set(products.map((p) => p.categoryId).filter((id): id is string => id !== null));
    const categories = used.size
      ? await this.prisma.category.findMany({
          where: { id: { in: [...used] }, isActive: true },
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true, carModel: true, imageKey: true },
        })
      : [];

    return {
      branch: { id: branch.id, code: branch.code, name: branch.name, nameAr: branch.nameAr },
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        carModel: c.carModel,
        imageUrl: c.imageKey ? imageUrl(c.imageKey) : null,
        thumbUrl: c.imageKey ? imageUrl(c.imageKey, 'sm') : null,
        count: products.filter((p) => p.categoryId === c.id).length,
      })),
      products,
    };
  }

  /**
   * Places an order for the signed-in showroom user's branch. Unit prices and
   * names are snapshotted onto the lines, so later catalogue changes never
   * alter the order. A repeated Idempotency-Key returns the original order.
   */
  async createOrder(
    user: AuthUser,
    dto: CreateShowroomOrderDto,
    idempotencyKey: string | undefined,
  ): Promise<{ order: OrderDetail; replayed: boolean }> {
    if (dto.userId !== user.id) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'USER_MISMATCH',
        message: 'The order must be placed by the signed-in showroom user.',
      });
    }
    const branch = await this.activeBranch(user);

    if (idempotencyKey) {
      const existing = await this.findByKey(user.id, idempotencyKey);
      if (existing) return { order: existing, replayed: true };
    }

    let orderId: string;
    try {
      orderId = await this.prisma.$transaction(async (tx) => {
        const products = await tx.product.findMany({
          where: {
            id: { in: dto.items.map((i) => i.productId) },
            price: { not: null },
            branchPositions: { some: { branchId: branch.id } },
          },
          select: { id: true, name: true, price: true },
        });
        const byId = new Map(products.map((p) => [p.id, p]));
        const unavailable = dto.items.filter((i) => !byId.has(i.productId)).map((i) => i.productId);
        if (unavailable.length) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            code: 'PRODUCT_UNAVAILABLE',
            message: 'Some products are no longer available. Please review the cart.',
            productIds: unavailable,
          });
        }

        // per-branch sequence; the row lock also serialises concurrent orders of the branch
        const { orderSeq, code } = await tx.branch.update({
          where: { id: branch.id },
          data: { orderSeq: { increment: 1 } },
          select: { orderSeq: true, code: true },
        });

        let total = decimal(0);
        const items = dto.items.map((line, position) => {
          const product = byId.get(line.productId)!;
          const unitPrice = product.price as Prisma.Decimal;
          const lineTotal = unitPrice.mul(line.quantity);
          total = total.add(lineTotal);
          return { productId: product.id, productName: product.name, unitPrice, quantity: line.quantity, lineTotal, position };
        });

        const order = await tx.order.create({
          data: {
            branchId: branch.id,
            number: orderSeq,
            code: `${code}-${String(orderSeq).padStart(6, '0')}`,
            customerName: dto.customerName,
            total,
            createdById: user.id,
            idempotencyKey: idempotencyKey ?? null,
            items: { create: items },
          },
          select: { id: true },
        });
        return order.id;
      });
    } catch (err) {
      // two identical requests raced past the lookup: return the one that won
      if (idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.findByKey(user.id, idempotencyKey);
        if (existing) return { order: existing, replayed: true };
      }
      throw err;
    }

    const order = orderDetail(await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: ORDER_DETAIL_SELECT }));
    this.trail.setEntity('Order', order.id).setBranch(branch.id).setChange(null, orderAuditView(order));
    return { order, replayed: false };
  }

  private async findByKey(userId: string, key: string): Promise<OrderDetail | null> {
    const row = await this.prisma.order.findUnique({
      where: { createdById_idempotencyKey: { createdById: userId, idempotencyKey: key } },
      select: ORDER_DETAIL_SELECT,
    });
    return row ? orderDetail(row) : null;
  }

  private async activeBranch(user: AuthUser) {
    const branch = user.branchId
      ? await this.prisma.branch.findUnique({ where: { id: user.branchId }, select: { id: true, code: true, name: true, nameAr: true, isActive: true } })
      : null;
    if (!branch?.isActive) {
      throw new ForbiddenException({ statusCode: 403, error: 'Forbidden', code: 'NO_SHOWROOM_ACCESS', message: 'This account cannot use the showroom.' });
    }
    return branch;
  }
}
