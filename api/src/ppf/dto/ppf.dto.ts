import { IsIn, IsOptional, ValidateIf } from 'class-validator';
import { BOOKING_NOTE_MAX, BOOKING_SERVICE_MAX, CLOSE_REASON_MAX, DECISION_NOTE_MAX } from '../../../../shared/validation';
import { IfSent, NameField, PhoneField, SearchField, TextField } from '../../common/booking-fields';
import { IsDay } from '../../common/day';
import { PageQueryDto } from '../../common/pagination';
import { EmptyToNull, EmptyToUndefined } from '../../common/validators';

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

  @IsOptional()
  @EmptyToUndefined()
  @NameField()
  ownerName?: string | null;

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
  @IfSent()
  @IsIn(PPF_BOOKING_TYPES)
  type?: (typeof PPF_BOOKING_TYPES)[number];

  @IfSent()
  @NameField()
  car?: string;

  @IsOptional()
  @EmptyToNull()
  @NameField()
  ownerName?: string | null;

  @IsOptional()
  @EmptyToNull()
  @PhoneField()
  phone?: string | null;

  @IsOptional()
  @EmptyToNull()
  @TextField(BOOKING_SERVICE_MAX)
  service?: string | null;

  @IfSent()
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
  @SearchField()
  q?: string;
}

export class CloseDayDto {
  @IsOptional()
  @EmptyToUndefined()
  @TextField(CLOSE_REASON_MAX)
  reason?: string | null;
}
export const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export class ListRequestsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(REQUEST_STATUSES)
  status?: (typeof REQUEST_STATUSES)[number];
}

export class DecideRequestDto {
  /** Shown to sales, e.g. why the request was rejected. */
  @IsOptional()
  @EmptyToUndefined()
  @TextField(DECISION_NOTE_MAX)
  decisionNote?: string | null;
}

/** Sent from the sales page; sales have no accounts, so the name is typed. */
export class CreatePpfRequestDto {
  @IsDay()
  date: string;

  /** A page loaded before full PPF requests existed sends none: it can only mean a light job. */
  @IsOptional()
  @IsIn(PPF_BOOKING_TYPES)
  type?: (typeof PPF_BOOKING_TYPES)[number];

  @NameField()
  salesName: string;

  @NameField()
  car: string;

  @NameField()
  ownerName: string;

  @IsOptional()
  @EmptyToUndefined()
  @PhoneField()
  phone?: string | null;

  /** What the job is. A light job must say; a full PPF may leave it out. */
  @ValidateIf((o: CreatePpfRequestDto, value: unknown) => o.type !== 'FULL' || (value !== undefined && value !== null))
  @EmptyToUndefined()
  @TextField(BOOKING_NOTE_MAX)
  note?: string | null;
}
