import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { BOOKING_NOTE_MAX, BOOKING_SERVICE_MAX, CLOSE_REASON_MAX } from '../../../../shared/validation';
import { NameField, PhoneField, TextField } from '../../common/booking-fields';
import { IsDay } from '../../common/day';
import { PageQueryDto } from '../../common/pagination';
import { EmptyToNull, EmptyToUndefined, Trim } from '../../common/validators';

export const PPF_BOOKING_TYPES = ['FULL', 'LIGHT'] as const;
export const BOOKING_STATUSES = ['BOOKED', 'CANCELLED'] as const;

export class CalendarQueryDto {
  @IsDay()
  from: string;

  @IsDay()
  to: string;
}

export class CreatePpfBookingDto {
  @IsIn(PPF_BOOKING_TYPES)
  type: (typeof PPF_BOOKING_TYPES)[number];

  @NameField()
  car: string;

  @NameField()
  ownerName: string;

  @IsOptional()
  @EmptyToUndefined()
  @PhoneField()
  phone?: string | null;

  @IsOptional()
  @EmptyToUndefined()
  @TextField(BOOKING_SERVICE_MAX)
  service?: string | null;

  /** The day the car arrives; a FULL booking closes it. */
  @IsDay()
  receiveDate: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsDay()
  deliveryDate?: string | null;

  @IsOptional()
  @EmptyToUndefined()
  @TextField(BOOKING_NOTE_MAX)
  note?: string | null;
}

/** Every field is optional; send "" or null to clear phone, service, delivery day or note. */
export class UpdatePpfBookingDto {
  @IsOptional()
  @IsIn(PPF_BOOKING_TYPES)
  type?: (typeof PPF_BOOKING_TYPES)[number];

  @IsOptional()
  @NameField()
  car?: string;

  @IsOptional()
  @NameField()
  ownerName?: string;

  @IsOptional()
  @EmptyToNull()
  @PhoneField()
  phone?: string | null;

  @IsOptional()
  @EmptyToNull()
  @TextField(BOOKING_SERVICE_MAX)
  service?: string | null;

  @IsOptional()
  @IsDay()
  receiveDate?: string;

  @IsOptional()
  @EmptyToNull()
  @IsDay()
  deliveryDate?: string | null;

  @IsOptional()
  @EmptyToNull()
  @TextField(BOOKING_NOTE_MAX)
  note?: string | null;
}

export class ListPpfBookingsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsDay()
  from?: string;

  @IsOptional()
  @IsDay()
  to?: string;

  @IsOptional()
  @IsIn(BOOKING_STATUSES)
  status?: (typeof BOOKING_STATUSES)[number];

  /** matches car, owner name, phone or service */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class CloseDayDto {
  @IsOptional()
  @EmptyToUndefined()
  @TextField(CLOSE_REASON_MAX)
  reason?: string | null;
}
