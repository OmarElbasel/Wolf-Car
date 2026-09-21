import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { RECOVERY_CODE_PATTERN, TOTP_CODE_PATTERN } from '../../../../shared/validation';
import { IsStrongPassword, TrimLower } from '../../common/validators';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword: string;

  /** ≥ 12 chars with upper, lower, number and symbol; must not contain the username. */
  @IsString()
  @IsStrongPassword()
  newPassword: string;
}

export class ChangeShowroomPasswordDto {
  /** The account's dashboard password, to confirm it is really the account owner. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword: string;

  @IsString()
  @IsStrongPassword()
  newPassword: string;
}

export class PasswordConfirmDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

export class TotpCodeDto {
  @IsString()
  @Matches(TOTP_CODE_PATTERN, { message: 'code must be 6 digits' })
  code: string;
}

export class SecondFactorConfirmDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;

  @ValidateIf((o: SecondFactorConfirmDto) => o.recoveryCode === undefined)
  @IsString()
  @Matches(TOTP_CODE_PATTERN, { message: 'code must be 6 digits' })
  code?: string;

  @IsOptional()
  @TrimLower()
  @IsString()
  @Matches(RECOVERY_CODE_PATTERN, { message: 'recoveryCode must look like xxxxx-xxxxx' })
  recoveryCode?: string;
}
