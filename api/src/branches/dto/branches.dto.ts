import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { BRANCH_CODE_PATTERN, BRANCH_NAME_MAX, DISPLAY_NAME_MAX } from '../../../../shared/validation';
import { EmptyToUndefined, Trim, TrimLower } from '../../common/validators';

export class StaffDto {
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(DISPLAY_NAME_MAX)
  displayName: string;

  @IsOptional()
  @EmptyToUndefined()
  @TrimLower()
  @IsEmail()
  @MaxLength(254)
  email?: string;
}

export class CreateBranchDto {
  /** 2–4 uppercase letters, used as the order-number prefix (e.g. "GH" → GH-000042). Cannot be changed later. */
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(BRANCH_CODE_PATTERN, { message: 'code must be 2–4 letters' })
  code: string;

  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(BRANCH_NAME_MAX)
  name: string;

  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(BRANCH_NAME_MAX)
  nameAr: string;

  /** The branch's only Branch Manager (created now, credentials returned once). */
  @ValidateNested()
  @Type(() => StaffDto)
  manager: StaffDto;

  /** The branch's only Cashier (created now, credentials returned once). */
  @ValidateNested()
  @Type(() => StaffDto)
  cashier: StaffDto;
}

export class UpdateBranchDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(BRANCH_NAME_MAX)
  name?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(BRANCH_NAME_MAX)
  nameAr?: string;

  /** Inactive branches cannot use the showroom. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
