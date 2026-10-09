import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class PublicProductsQueryDto {
  /** Only this category's products (the landing page's car-model cards link here). */
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** "true" lists only the quick-service products (filters, oils, brake pads) of every car. */
  @IsOptional()
  @IsIn(['true'])
  quickService?: 'true';
}
