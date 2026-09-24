import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('reads a header row and maps each row onto it', () => {
    expect(parseCsv('a,b\n1,2\n3,4')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('keeps commas that sit inside quoted fields', () => {
    expect(parseCsv('id,name\n1,"Smith, John"')).toEqual([{ id: '1', name: 'Smith, John' }]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsv('id,name\n1,"He said ""hi"""')).toEqual([{ id: '1', name: 'He said "hi"' }]);
  });

  it('keeps newlines inside quoted fields', () => {
    expect(parseCsv('id,note\n1,"line one\nline two"')).toEqual([{ id: '1', note: 'line one\nline two' }]);
  });

  it('handles CRLF line endings and a trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([{ a: '1', b: '2' }]);
  });

  it('preserves empty fields as empty strings', () => {
    expect(parseCsv('a,b,c\n1,,3')).toEqual([{ a: '1', b: '', c: '3' }]);
  });

  it('preserves a base64 data URI containing commas and plus signs', () => {
    const uri = 'data:image/webp;base64,UklGRnwU+AAA/BQ==';
    const [row] = parseCsv(`id,image_url\nprod-1,"${uri}"`);
    expect(row.image_url).toBe(uri);
  });

  it('returns no rows for an empty file or a header-only file', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('a,b\n')).toEqual([]);
  });

  it('ignores a UTF-8 byte order mark on the header', () => {
    expect(parseCsv('﻿a,b\n1,2')).toEqual([{ a: '1', b: '2' }]);
  });
});
