import { execFileSync } from 'node:child_process';
import path from 'node:path';

export function pdfText(pdf: Buffer): string {
  const text = execFileSync(process.execPath, [path.join(__dirname, 'pdf-text.mjs')], { input: pdf, encoding: 'utf8' });
  return text.replace(/\u00a0/g, ' ');
}
