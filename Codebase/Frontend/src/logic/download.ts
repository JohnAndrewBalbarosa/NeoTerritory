// Shared browser download primitive (Blob + anchor click).
//
// docExport.ts has a private `blobDownload()` with this exact logic. Rather
// than widen that module's surface, the Instructor tab's CSV/JSON exports
// (admin/logic/toCsv.ts) use this shared helper. Same Blob+anchor approach.
export function blobDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
