import { IsOptional, IsUUID } from 'class-validator';

export class PublicProductsQueryDto {
  /** Only this category's products (the landing page's car-model cards link here). */
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
