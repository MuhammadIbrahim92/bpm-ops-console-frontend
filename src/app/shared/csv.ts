export interface CsvColumn {
  field: string;
  header: string;
}

function cell(v: unknown): string {
  if (v === null || v === undefined) {
    return '';
  }
  const text = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return `"${text.replace(/"/g, '""')}"`;
}

/** Downloads the rows as a CSV file (UTF-8 with a byte-order mark so Excel reads it correctly). */
export function downloadCsv(filename: string, columns: CsvColumn[], rows: readonly unknown[]): void {
  const lines = [columns.map(c => cell(c.header)).join(',')];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    lines.push(columns.map(c => cell(r[c.field])).join(','));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
