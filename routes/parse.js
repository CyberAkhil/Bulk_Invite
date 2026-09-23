const XLSX = require("xlsx");

/**
 * Normalize a raw phone value into E.164-ish format.
 * Defaults to India (+91) when a 10-digit local number is given.
 * Returns null if the value can't be turned into something plausible.
 */
function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;

  let s = String(raw).trim();
  if (!s) return null;

  // Strip everything except leading + and digits
  s = s.replace(/[^\d+]/g, "");

  if (s.startsWith("+")) {
    const digits = s.slice(1);
    if (digits.length < 8 || digits.length > 15) return null;
    return "+" + digits;
  }

  // Drop a leading 0 (common in local formats like 09876543210)
  if (s.startsWith("0")) s = s.replace(/^0+/, "");

  if (s.length === 10) {
    // Assume India by default — change this default for other countries
    return "+91" + s;
  }

  if (s.length > 10 && s.length <= 15) {
    return "+" + s;
  }

  return null;
}

/**
 * Parses an uploaded Excel/CSV buffer into a normalized contact list.
 * Expects columns that loosely match "name" and "phone"/"number"/"mobile".
 * Returns { valid: [...], invalid: [...] }
 */
function parseContactsFile(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (rows.length === 0) {
    return { valid: [], invalid: [], error: "Sheet appears to be empty." };
  }

  // Figure out which columns hold name / phone, case-insensitively
  const headerKeys = Object.keys(rows[0]);
  const nameKey = headerKeys.find((k) => /name/i.test(k)) || headerKeys[0];
  const phoneKey =
    headerKeys.find((k) => /(phone|mobile|number|contact)/i.test(k)) ||
    headerKeys[1];

  if (!phoneKey) {
    return {
      valid: [],
      invalid: [],
      error:
        "Couldn't find a phone/mobile/number column. Please check your sheet headers.",
    };
  }

  const valid = [];
  const invalid = [];
  const seen = new Set();

  rows.forEach((row, idx) => {
    const name = String(row[nameKey] || "").trim() || `Contact ${idx + 1}`;
    const rawPhone = row[phoneKey];
    const phone = normalizePhone(rawPhone);

    if (!phone) {
      invalid.push({ row: idx + 2, name, rawPhone, reason: "Invalid or missing phone number" });
      return;
    }

    if (seen.has(phone)) {
      invalid.push({ row: idx + 2, name, rawPhone, reason: "Duplicate number, skipped" });
      return;
    }

    seen.add(phone);
    valid.push({
      id: phone,
      name,
      phone,
      status: "pending", // pending | sending | sent | failed
      error: null,
    });
  });

  return { valid, invalid, columnsUsed: { nameKey, phoneKey } };
}

module.exports = { normalizePhone, parseContactsFile };
