import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/** "manager" | "cashier" route segment → Role. */
@Injectable()
export class ParseStaffRolePipe implements PipeTransform<string, 'BRANCH_MANAGER' | 'CASHIER'> {
  transform(value: string): 'BRANCH_MANAGER' | 'CASHIER' {
    if (value === 'manager') return 'BRANCH_MANAGER';
    if (value === 'cashier') return 'CASHIER';
    throw new BadRequestException('role must be "manager" or "cashier"');
  }
}
