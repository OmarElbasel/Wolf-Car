import { IsJWT, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { RECOVERY_CODE_PATTERN, TOTP_CODE_PATTERN } from '../../../../shared/validation';
import { TrimLower } from '../../common/validators';

export class LoginDto {
  /** Auto-generated username, e.g. "gh.cashier" (case-insensitive). */
  @TrimLower()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

export class TwoFactorLoginDto {
  /** Token returned by POST /auth/login when two-factor authentication is required. */
  @IsJWT()
  challengeToken: string;

  /** 6-digit code from the authenticator app (or use recoveryCode). */
  @ValidateIf((o: TwoFactorLoginDto) => o.recoveryCode === undefined)
  @IsString()
  @Matches(TOTP_CODE_PATTERN, { message: 'code must be 6 digits' })
  code?: string;

  /** One-time recovery code, format xxxxx-xxxxx. */
  @IsOptional()
  @TrimLower()
  @IsString()
  @Matches(RECOVERY_CODE_PATTERN, { message: 'recoveryCode must look like xxxxx-xxxxx' })
  recoveryCode?: string;
}
