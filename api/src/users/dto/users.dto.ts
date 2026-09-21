import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { DISPLAY_NAME_MAX } from '../../../../shared/validation';
import { PageQueryDto } from '../../common/pagination';
import { EmptyToNull, EmptyToUndefined, Trim, TrimLower } from '../../common/validators';
import { Role } from '../../generated/prisma/enums';

/** Roles that are not tied to a branch. Branch staff are created with their branch. */
export const NON_BRANCH_ROLES = ['SUPER_ADMIN', 'FINANCE'] as const;

export class CreateUserDto {
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

  /** Branch managers and cashiers are created together with their branch (POST /branches) or via staff replacement. */
  @IsIn(NON_BRANCH_ROLES)
  role: (typeof NON_BRANCH_ROLES)[number];
}

export class UpdateUserDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(DISPLAY_NAME_MAX)
  displayName?: string;

  /** Send an empty string or null to clear. */
  @IsOptional()
  @EmptyToNull()
  @ValidateIf((_o, v) => v !== null)
  @TrimLower()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @IsOptional()
  @IsIn(NON_BRANCH_ROLES)
  role?: (typeof NON_BRANCH_ROLES)[number];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListUsersQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(Object.values(Role))
  role?: Role;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  /** matches username, display name or email */
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  status: 'active' | 'inactive' | 'all' = 'all';
}
