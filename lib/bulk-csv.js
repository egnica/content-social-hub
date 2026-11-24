// Strict UTF-8 RFC 4180-style CSV codec for client-bound bulk posts.
// CSV deliberately retains the XLSX template's second identity row.
export const MAX_BULK_CSV_ROWS = 202;
const MAX_BULK_CSV_COLUMNS = 512;
const MAX_BULK_CSV_BYTES = 2 * 1024 * 1024;

export function stringifyCsvRows(rows) {
  return rows.map((row) => row.map((cell) => {
    const value = String(cell ?? "");
    return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
  }).join(",")).join("\r\n") + "\r\n";
}

export function parseCsvRows(bytes) {
  if (!bytes?.byteLength || bytes.byteLength > MAX_BULK_CSV_BYTES) {
    throw new TypeError("Choose a nonempty CSV file up to 2 MB.");
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TypeError("The CSV must use UTF-8 text encoding.");
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.includes("\0")) throw new TypeError("The CSV contains invalid NUL characters.");

  const rows = [];
  let row = [];
  let value = "";
  let mode = "plain";

  function pushField() {
    if (row.length >= MAX_BULK_CSV_COLUMNS) {
      throw new TypeError("The CSV contains too many columns.");
    }
    row.push(value);
    value = "";
    mode = "plain";
  }
  function pushRow() {
    pushField();
    if (rows.length >= MAX_BULK_CSV_ROWS) {
      throw new TypeError("Maximum 200 post rows.");
    }
    rows.push(row);
    row = [];
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (mode === "quoted") {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          mode = "closed";
        }
      } else {
        value += ch;
      }
      continue;
    }
    if (mode === "closed" && ch !== "," && ch !== "\r" && ch !== "\n") {
      throw new TypeError("The CSV has characters after a closing quote.");
    }
    if (ch === ",") {
      pushField();
    } else if (ch === "\r" || ch === "\n") {
      pushRow();
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else if (ch === '"') {
      if (mode !== "plain" || value !== "") {
        throw new TypeError("The CSV contains an incorrectly placed quote.");
      }
      mode = "quoted";
    } else {
      value += ch;
    }
  }
  if (mode === "quoted") throw new TypeError("The CSV has an unclosed quoted field.");
  if (row.length || value || mode === "closed") pushRow();
  if (!rows.length) throw new TypeError("The CSV is empty.");
  return rows;
}
