import ExcelJS from "exceljs";
import { parseCsvRows, stringifyCsvRows } from "./bulk-csv.js";
import { resolveLocalDateTimeToUtc } from "./scheduling-logic.js";

export const MAX_BULK_FILE_BYTES = 2 * 1024 * 1024;
const MAX_POSTS = 200;
const FIELDS = ["post_key", "title", "master_text", "link_url", "media_url", "local_date", "local_time"];
const MARKER = "CONTENT_SOCIAL_HUB_BULK_V1";
const NAMES = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", google_business_profile: "Google Business", youtube: "YouTube" };

function cellText(cell, { allowHyperlink = false } = {}) {
  if (cell.value == null) return "";
  if (allowHyperlink && typeof cell.value?.hyperlink === "string") return cell.value.hyperlink.trim();
  return typeof cell.value === "string" ? cell.value.trim() : null;
}

export function bulkAccountColumns(connections, clientId) {
  const owned = connections.filter((connection) => connection.clientId === clientId)
    .sort((a, b) => `${a.platform}:${a.accountName}:${a._id}`.localeCompare(`${b.platform}:${b.accountName}:${b._id}`));
  const labels = owned.map((connection) => `${NAMES[connection.platform] || connection.platform} - ${connection.accountName}`);
  return owned.map((connection, index) => ({
    id: connection._id,
    name: connection.accountName,
    platform: connection.platform,
    label: labels.filter((label) => label === labels[index]).length > 1 ? `${labels[index]} (${connection._id.slice(-6)})` : labels[index],
  }));
}

export function createBulkTemplate({ client, connections }) {
  const accounts = bulkAccountColumns(connections, client._id);
  if (!accounts.length) throw new TypeError("Connect an account for this client before downloading a template.");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Bulk Posts");
  sheet.views = [{ state: "frozen", xSplit: 3, ySplit: 2 }];
  sheet.addRow([...FIELDS, ...accounts.map((account) => account.label)]);
  sheet.addRow([MARKER, client._id, "", "", "", "", "", ...accounts.map((account) => account.id)]).hidden = true;
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF244A38" } };
  sheet.getRow(1).height = 38;
  sheet.getRow(1).alignment = { vertical: "middle", wrapText: true };
  FIELDS.forEach((_, index) => {
    sheet.getColumn(index + 1).width = [22, 26, 48, 38, 38, 16, 14][index];
    sheet.getColumn(index + 1).numFmt = "@";
  });
  accounts.forEach((_, index) => {
    const column = sheet.getColumn(FIELDS.length + index + 1);
    column.width = 31;
    column.numFmt = "@";
    for (let row = 3; row <= MAX_POSTS + 2; row++) {
      sheet.getCell(row, FIELDS.length + index + 1).dataValidation = { type: "list", allowBlank: true, formulae: ['"X"'] };
    }
  });
  return workbook;
}


export function createBulkCsvTemplate({ client, connections }, { sample = false } = {}) {
  const accounts = bulkAccountColumns(connections, client._id);
  if (!accounts.length) throw new TypeError("Connect an account for this client before downloading a template.");
  const rows = [
    [...FIELDS, ...accounts.map((account) => account.label)],
    [MARKER, client._id, "", "", "", "", "", ...accounts.map((account) => account.id)],
  ];
  if (sample) {
    // A deliberately incomplete example: no real post can be imported without
    // replacing the date, time and sample content.
    rows.push([
      "example-replace-me", "Example (replace this row)",
      "Replace this text with your post.", "", "",
      "YYYY-MM-DD", "HH:mm", ...accounts.map((_, index) => index === 0 ? "X" : ""),
    ]);
  }
  return "\ufeff" + stringifyCsvRows(rows);
}

function validateUrl(value, field, errors) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || value.length > 2048) throw new Error();
  } catch { errors.push(`${field} must be a valid http(s) URL.`); }
}

function mediaChoice(post, platform) {
  if (post.media_url) return "Media URL (file not checked or imported yet)";
  if (platform === "google_business_profile" && post.link_url) return "Google Business metadata image fallback (image not fetched yet)";
  if (["facebook", "linkedin"].includes(platform) && post.link_url) return "Link preview (appearance may differ on the platform)";
  if (post.link_url) return "Link provided; destination requirements still need review";
  return "Text only; destination requirements still need review";
}

export async function previewBulkWorkbook(buffer, options) {
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer); }
  catch { throw new TypeError("The file is not a readable .xlsx workbook."); }
  const sheet = workbook.getWorksheet("Bulk Posts");
  if (workbook.worksheets.length !== 1 || !sheet) throw new TypeError("Use the one-sheet Bulk Posts template downloaded for this client.");
  return previewBulkSheet(sheet, options);
}

export function previewBulkCsv(buffer, options) {
  const rows = parseCsvRows(buffer);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Bulk Posts");
  rows.forEach((values) => sheet.addRow(values));
  return previewBulkSheet(sheet, options);
}

export function previewBulkFile(buffer, { filename, ...options }) {
  const name = String(filename || "").toLowerCase();
  if (name.endsWith(".csv")) return previewBulkCsv(buffer, options);
  if (name.endsWith(".xlsx")) return previewBulkWorkbook(buffer, options);
  throw new TypeError("Choose a .csv or .xlsx file.");
}

function previewBulkSheet(sheet, { client, connections, now = new Date() }) {
  if (cellText(sheet.getCell(2, 1)) !== MARKER || cellText(sheet.getCell(2, 2)) !== client._id) {
    throw new TypeError("Download a fresh template for the selected client.");
  }
  if (FIELDS.some((field, index) => cellText(sheet.getCell(1, index + 1)) !== field)) {
    throw new TypeError(`The first seven headers must be ${FIELDS.join(", ")}.`);
  }
  if (sheet.actualRowCount > MAX_POSTS + 2) {
    throw new TypeError(`Maximum ${MAX_POSTS} post rows.`);
  }
  const expected = new Map(bulkAccountColumns(connections, client._id).map((account) => [account.id, account]));
  const columns = [];
  const seen = new Set();
  for (let index = FIELDS.length + 1; index <= sheet.columnCount; index++) {
    const heading = cellText(sheet.getCell(1, index));
    const id = cellText(sheet.getCell(2, index));
    if (!heading && !id) {
      let filled = false;
      sheet.getColumn(index).eachCell((cell, rowNumber) => {
        if (rowNumber > 2 && cellText(cell) !== "") filled = true;
      });
      if (filled) throw new TypeError("A filled account column has no matching template header. Download a fresh template.");
      continue;
    }
    const account = expected.get(id);
    if (!account || account.label !== heading || seen.has(id)) {
      throw new TypeError("A social account column changed, was duplicated, or no longer belongs to this client. Download a fresh template.");
    }
    seen.add(id);
    columns.push({ index, account });
  }
  if (!columns.length) throw new TypeError("Keep at least one connected account column in the template.");

  const posts = [];
  const errors = [];
  sheet.eachRow((row, number) => {
    if (number <= 2) return;
    const entries = FIELDS.map((field, index) => [field, cellText(row.getCell(index + 1), { allowHyperlink: field === "link_url" || field === "media_url" })]);
    const selections = columns.map(({ index, account }) => ({ account, value: cellText(row.getCell(index)) }));
    if (entries.every(([, value]) => value === "") && selections.every(({ value }) => value === "")) return;
    const post = {
      row: number,
      ...Object.fromEntries(entries),
      errors: entries.filter(([, value]) => value === null).map(([field]) => `${field} must be plain text (no Excel dates or formulas).`),
      destinations: [],
    };
    for (const { account, value } of selections) {
      if (value === "") continue;
      if (value?.toUpperCase() !== "X") {
        post.errors.push(`${account.label}: use X to include or leave blank to skip.`);
        continue;
      }
      post.destinations.push({ account, errors: [], mediaChoice: mediaChoice(post, account.platform) });
    }
    posts.push(post);
  });
  if (!posts.length) errors.push("Add at least one post row.");
  if (posts.length > MAX_POSTS) errors.push(`Maximum ${MAX_POSTS} post rows.`);
  const keys = new Set();
  for (const post of posts.slice(0, MAX_POSTS)) {
    if (!post.post_key || !/^[\w-]{1,80}$/.test(post.post_key)) post.errors.push("post_key must be 1–80 letters, numbers, underscores, or hyphens.");
    else if (keys.has(post.post_key)) post.errors.push("Duplicate post_key.");
    else keys.add(post.post_key);
    if (!post.title || post.title.length > 220) post.errors.push("title is required (maximum 220 characters).");
    if (!post.master_text || post.master_text.length > 50_000) post.errors.push("master_text is required (maximum 50,000 characters).");
    validateUrl(post.link_url, "link_url", post.errors);
    validateUrl(post.media_url, "media_url", post.errors);
    if (!post.destinations.length) post.errors.push("Mark at least one social account with X.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(post.local_date || "") || !/^\d{2}:\d{2}$/.test(post.local_time || "")) {
      post.errors.push("Use text date YYYY-MM-DD and 24-hour time HH:mm.");
    } else {
      const resolved = resolveLocalDateTimeToUtc(`${post.local_date}T${post.local_time}`, client.timezone);
      if (!resolved.ok) post.errors.push(resolved.error);
      else if (resolved.releaseAt <= now) post.errors.push("Release time must be in the future.");
      else {
        post.releaseAt = resolved.releaseAtIso;
        post.destinations.forEach((destination) => { destination.releaseAt = resolved.releaseAtIso; });
      }
    }
    for (const destination of post.destinations) {
      if (["instagram", "youtube"].includes(destination.account.platform) && !post.media_url) {
        destination.errors.push("This account needs a media URL; a link preview cannot supply its media.");
      }
    }
  }
  return {
    client: { id: client._id, name: client.name, timezone: client.timezone },
    posts: posts.slice(0, MAX_POSTS),
    errors,
    valid: !errors.length && posts.every((post) => !post.errors.length && post.destinations.every((destination) => !destination.errors.length)),
  };
}
