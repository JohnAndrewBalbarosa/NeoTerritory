// CSV + download helpers for the Instructor tab (D91).
//
// The Instructor dashboard lets a course operator export per-student and
// per-module rollups (CSV) plus the raw dataset (JSON). RFC-4180-ish quoting:
// a field is quoted when it contains a comma, double-quote, or newline, and
// internal double-quotes are doubled.

import { blobDownload } from '../../logic/download';

function escapeField(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Build an RFC-4180-ish CSV string from a header row + data rows. Lines are
// CRLF-joined (the spec's line terminator) so the file opens cleanly in Excel.
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeField).join(','));
  return lines.join('\r\n');
}

// Serialise to CSV and trigger a browser download.
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
): void {
  blobDownload(toCsv(headers, rows), filename, 'text/csv;charset=utf-8');
}

// Pretty-print a value to JSON and trigger a browser download (the raw dataset).
export function downloadJson(filename: string, data: unknown): void {
  blobDownload(JSON.stringify(data, null, 2), filename, 'application/json');
}
