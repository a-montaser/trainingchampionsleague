/**
 * CSV generation.
 *
 * Values are always quoted and embedded quotes doubled, so a training name with
 * a comma or a line break cannot shift the columns. A leading `=`, `+`, `-` or
 * `@` is prefixed with an apostrophe: spreadsheets treat those as formulas, and
 * a name a participant typed must never execute when the file is opened.
 */

export type CsvRow = Record<string, string | number | null | undefined>;

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';

  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: readonly CsvRow[], columns: readonly string[]): string {
  const header = columns.map(escapeCell).join(',');
  const body = rows.map((row) => columns.map((column) => escapeCell(row[column])).join(','));

  // A BOM so Excel opens UTF-8 names correctly; CRLF per RFC 4180.
  return `﻿${[header, ...body].join('\r\n')}\r\n`;
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
