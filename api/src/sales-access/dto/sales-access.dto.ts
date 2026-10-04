import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';
import { normaliseDigits, SALES_PIN_PATTERN } from '../../../../shared/validation';

const digits = ({ value }: { value: unknown }) => (typeof value === 'string' ? normaliseDigits(value).trim() : value);

export class PinDto {
  @Transform(digits)
  @IsString()
  @Matches(SALES_PIN_PATTERN, { message: 'pin must be exactly 6 digits' })
  pin: string;
}
