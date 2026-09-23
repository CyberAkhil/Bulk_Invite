const test = require("node:test");
const assert = require("node:assert/strict");
const { newState, applyConnectionState } = require("../routes/whatsapp");

test("qr scan marks session as not ready, and ready event flips to ready", () => {
  const state = newState();

  applyConnectionState(state, "qr", "data:image/png;base64,abc");
  assert.equal(state.ready, false);
  assert.equal(state.authenticated, false);
  assert.equal(state.qrDataUrl, "data:image/png;base64,abc");

  applyConnectionState(state, "ready");
  assert.equal(state.ready, true);
  assert.equal(state.authenticated, true);
  assert.equal(state.qrDataUrl, null);
});
