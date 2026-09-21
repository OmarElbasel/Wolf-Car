/** Unicode isolate (FSI … PDI): keeps a formatted amount or a free-text name intact inside a translated sentence. */
const FSI = String.fromCharCode(0x2068);
const PDI = String.fromCharCode(0x2069);

export const isolate = (text: string) => `${FSI}${text}${PDI}`;
