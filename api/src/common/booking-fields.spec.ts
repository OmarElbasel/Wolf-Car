import { plainToInstance } from 'class-transformer';
import { IsOptional, validateSync } from 'class-validator';
import { NameField, PhoneField, TextField } from './booking-fields';
import { EmptyToNull } from './validators';

class Probe {
  @NameField()
  ownerName: string;

  @IsOptional()
  @EmptyToNull()
  @PhoneField()
  phone?: string | null;

  @IsOptional()
  @EmptyToNull()
  @TextField(10)
  note?: string | null;
}

const parse = (raw: Record<string, unknown>) => {
  const probe = plainToInstance(Probe, raw);
  return { probe, fields: validateSync(probe).map((e) => e.property) };
};

describe('booking field decorators', () => {
  it('trims and collapses spaces in names, in any script', () => {
    const { probe, fields } = parse({ ownerName: '  خالد   المري ' });
    expect(fields).toEqual([]);
    expect(probe.ownerName).toBe('خالد المري');
  });

  it('rejects names that are too short or too long', () => {
    expect(parse({ ownerName: 'A' }).fields).toEqual(['ownerName']);
    expect(parse({ ownerName: 'x'.repeat(81) }).fields).toEqual(['ownerName']);
    expect(parse({ ownerName: 42 }).fields).toEqual(['ownerName']);
  });

  it('stores Arabic-Indic and Persian digits as plain digits', () => {
    expect(parse({ ownerName: 'Sara', phone: '٥٥١٢٣٤٥٦' }).probe.phone).toBe('55123456');
    expect(parse({ ownerName: 'Sara', phone: '+۹۷۴ 5512 3456' }).probe.phone).toBe('+974 5512 3456');
  });

  it('treats an empty phone or note as "none"', () => {
    const { probe, fields } = parse({ ownerName: 'Sara', phone: '   ', note: '' });
    expect(fields).toEqual([]);
    expect(probe.phone).toBeNull();
    expect(probe.note).toBeNull();
  });

  it('rejects phones with letters or the wrong length, and long notes', () => {
    expect(parse({ ownerName: 'Sara', phone: 'call me' }).fields).toEqual(['phone']);
    expect(parse({ ownerName: 'Sara', phone: '123' }).fields).toEqual(['phone']);
    expect(parse({ ownerName: 'Sara', note: 'x'.repeat(11) }).fields).toEqual(['note']);
  });
});
