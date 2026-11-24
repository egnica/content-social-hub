import assert from "node:assert/strict";
import test from "node:test";
import { parseCsvRows, stringifyCsvRows } from "../lib/bulk-csv.js";

const encode = (text) => Buffer.from(text, "utf8");

test("CSV codec round-trips commas, double quotes, Unicode and multiline content", () => {
  const rows = [
    ["post_key", "title", "master_text", "link_url"],
    ["sample", "Happy Thanksgiving 🦃", 'Hello, "everyone"\nSecond line', "https://example.org/?q=a,b"],
  ];
  assert.deepEqual(parseCsvRows(encode("\ufeff" + stringifyCsvRows(rows))), rows);
});

test("CSV preserves an empty final account selection and literal formula-like text", () => {
  const rows = [["post_key", "account1", "account2"], ["p1", "=do-not-evaluate()", ""]];
  const parsed = parseCsvRows(encode(stringifyCsvRows(rows)));
  assert.deepEqual(parsed, rows);
  assert.equal(parsed[1][1], "=do-not-evaluate()");
});

test("CSV rejects invalid quoting, NUL bytes, invalid UTF-8 and excessive rows or columns", () => {
  for (const input of ['a,b\n"unclosed', 'a,b\n"closed"extra', 'a,b\nbad"quote']) {
    assert.throws(() => parseCsvRows(encode(input)), /CSV/);
  }
  assert.throws(() => parseCsvRows(encode("abc\0def")), /NUL/);
  assert.throws(() => parseCsvRows(Buffer.from([0xc3, 0x28])), /UTF-8/);
  assert.throws(() => parseCsvRows(encode(Array.from({ length: 203 }, () => "a").join("\r\n"))), /Maximum 200/);
  assert.throws(() => parseCsvRows(encode("x,".repeat(512))), /too many columns/);
});

test("CSV handles LF, CRLF, CR and trailing line endings without adding fake posts", () => {
  for (const text of ["a,b\nc,d\n", "a,b\r\nc,d\r\n", "a,b\rc,d\r"]) {
    assert.deepEqual(parseCsvRows(encode(text)), [["a", "b"], ["c", "d"]]);
  }
});
