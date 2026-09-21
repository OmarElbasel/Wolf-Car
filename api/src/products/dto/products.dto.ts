import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { BARCODE_PATTERN, PRODUCT_DESCRIPTION_MAX, PRODUCT_NAME_MAX } from '../../../../shared/validation';
import { EmptyToNull, EmptyToUndefined, IsPrice, ToPriceString, Trim } from '../../common/validators';

/**
 * Multipart fields for POST /products (plus an `image` file part). There is
 * deliberately no price field: sending one is rejected (forbidNonWhitelisted).
 */
export class CreateProductDto {
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(PRODUCT_NAME_MAX)
  name: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(PRODUCT_DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @Matches(BARCODE_PATTERN, { message: 'barcode may only contain letters, digits and dashes (max 64)' })
  barcode?: string;
}

/** Multipart fields for PATCH /products/:id (optional new `image`). Details only — no price. */
export class UpdateProductDetailsDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(PRODUCT_NAME_MAX)
  name?: string;

  /** Empty string clears it. */
  @IsOptional()
  @EmptyToNull()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(PRODUCT_DESCRIPTION_MAX)
  description?: string | null;

  /** Empty string clears it. */
  @IsOptional()
  @EmptyToNull()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Matches(BARCODE_PATTERN, { message: 'barcode may only contain letters, digits and dashes (max 64)' })
  barcode?: string | null;
}

/** The only field Finance can change. Anything else in the body is rejected. */
export class UpdatePriceDto {
  /** QAR amount with at most 2 decimals, e.g. 125 or "125.50". */
  @ToPriceString()
  @IsPrice()
  price: string;
}

export class ReorderProductsDto {
  /** Every product of the branch, in the new showroom order. */
  @IsArray()
  @ArrayMaxSize(2000)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  productIds: string[];

  /** Only for users without a branch (Super Admin): which branch to reorder. Ignored/forbidden otherwise. */
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class ListProductsQueryDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsIn(['all', 'priced', 'unpriced'])
  price: 'all' | 'priced' | 'unpriced' = 'all';

  /** For users without a branch: show this branch's display order. */
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
