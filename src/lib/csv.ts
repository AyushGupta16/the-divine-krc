/**
 * Client-safe CSV export. No server imports, no npm deps — keep it that way
 * so check-client-bundle.mjs can't find a reason to flag it.
 */

export function toCsv(
  rows: Record<string, unknown>[],
  columns: { key: string; header: string }[],
): string {
  const lines = [columns.map((c) => escapeCsvValue(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvValue(row[c.key])).join(","));
  }
  return lines.join("\r\n");
}

function escapeCsvValue(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
