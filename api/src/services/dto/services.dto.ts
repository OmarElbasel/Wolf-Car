import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { EmptyToNull, Trim } from '../../common/validators';
import { SECTIONS, TIER_SETS, type Section, type TierSet } from '../service-catalogue';

const NAME_MAX = 80;
const NOTE_MAX = 200;
const TIER_NAME_MAX = 40;

export class CreateServiceDto {
  @IsIn(SECTIONS)
  section: Section;

  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(NAME_MAX)
  nameAr: string;

  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(NAME_MAX)
  nameEn: string;

  /** The packages or films it is priced by; leave out for a single price. */
  @IsOptional()
  @IsIn(TIER_SETS)
  tierSet?: TierSet;

  /** True for separate sedan and SUV prices. */
  @IsOptional()
  @IsBoolean()
  bodySplit?: boolean;
}

export class UpdateServiceDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(NAME_MAX)
  nameAr?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(NAME_MAX)
  nameEn?: string;

  /** Empty string clears it. */
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(NOTE_MAX)
  noteAr?: string | null;

  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(NOTE_MAX)
  noteEn?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTierDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(TIER_NAME_MAX)
  nameAr: string;

  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(TIER_NAME_MAX)
  nameEn: string;
}
