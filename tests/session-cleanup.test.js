const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { safeRemoveSessionDir } = require("../routes/whatsapp");

test("safeRemoveSessionDir retries when a file lock temporarily blocks deletion", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bulk-invite-"));
  const lockFile = path.join(tempDir, "first_party_sets.db");
  fs.writeFileSync(lockFile, "locked");

  const originalRmSync = fs.rmSync;
  let attempts = 0;

  fs.rmSync = (...args) => {
    attempts += 1;
    if (attempts === 1) {
      const err = new Error("resource busy or locked");
      err.code = "EBUSY";
      throw err;
    }
    return originalRmSync.apply(fs, args);
  };

  try {
    await safeRemoveSessionDir(tempDir);
    assert.equal(fs.existsSync(tempDir), false);
    assert.ok(attempts >= 2);
  } finally {
    fs.rmSync = originalRmSync;
  }
});
