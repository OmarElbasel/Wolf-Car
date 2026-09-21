// Prints the text of a PDF read from stdin. Runs as a plain Node process
// because pdf-parse (pdf.js) is ESM-only and cannot load inside Jest on Node 22.
import { PDFParse } from 'pdf-parse';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const parser = new PDFParse({ data: new Uint8Array(Buffer.concat(chunks)) });
const result = await parser.getText();
process.stdout.write(result.text);
await parser.destroy();
