const FORMULA_PREFIX_REGEX = /^[=+\t\r@]/;
const NEGATIVE_NUMBER_REGEX = /^-\d+(\.\d+)?$/;
const CSV_NEEDS_QUOTES_REGEX = /[",\r\n]/;

/**
 * Neutralizes spreadsheet formula injection (CWE-1236) on string cells
 * while preserving genuine negative numeric strings such as "-225.50".
 */
export function sanitizeCsvFormula(raw: string): string {
  if (!raw) return raw;
  if (FORMULA_PREFIX_REGEX.test(raw)) {
    return `'${raw}`;
  }
  if (raw.startsWith("-") && !NEGATIVE_NUMBER_REGEX.test(raw)) {
    return `'${raw}`;
  }
  return raw;
}

/**
 * Escapes a single cell value according to RFC-4180 with formula-injection protection.
 */
export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = typeof value === "string" ? sanitizeCsvFormula(value) : String(value);
  if (CSV_NEEDS_QUOTES_REGEX.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes column headers and rows into an RFC-4180 CSV string.
 */
export function serializeCsv(
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
): string {
  const headerLine = headers.map((header) => escapeCsvCell(header)).join(",");
  const bodyLines = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(","));
  return [headerLine, ...bodyLines].join("\r\n");
}

/**
 * Triggers a browser CSV file download with UTF-8 BOM for Excel compatibility.
 * Safe in Node/SSR environments where DOM APIs are absent (returns false).
 */
export function downloadCsvFile(filename: string, csvContent: string): boolean {
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof Blob === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return false;
  }

  const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.setAttribute("download", filename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
  return true;
}
