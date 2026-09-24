/**
 * Minimal RFC 4180 CSV reader for the one-off legacy catalogue import.
 *
 * Hand-rolled rather than pulled from npm because the only caller is the
 * import script, and the fields it must survive are unusual: base64 data URIs
 * megabytes long, full of commas, plus signs and newlines.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  const header = rows.shift();
  if (!header) return [];
  return rows.map((cells) => {
    const row: Record<string, string> = {};
    header.forEach((name, i) => {
      row[name] = cells[i] ?? '';
    });
    return row;
  });
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let dirty = false; // this row has content, so a trailing newline still ends a row

  const endField = () => {
    row.push(field);
    field = '';
    dirty = true;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
    dirty = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') {
        field += ch;
      } else if (text[i + 1] === '"') {
        field += '"';
        i++; // doubled quote is a literal quote
      } else {
        quoted = false;
      }
      continue;
    }
    if (ch === '"' && field === '') quoted = true;
    else if (ch === ',') endField();
    else if (ch === '\n') endRow();
    else if (ch === '\r') continue; // CRLF: the \n does the work
    else field += ch;
  }
  if (dirty || field !== '') endRow();
  return rows;
}
