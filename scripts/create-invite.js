// Run this to generate a new invite code:
//   node scripts/create-invite.js
const crypto = require("crypto");
const { createInvite } = require("../lib/store");

const code = crypto.randomBytes(4).toString("hex").toUpperCase(); // e.g. "A1B2C3D4"

createInvite({
  code,
  used: false,
  usedBy: null,
  createdAt: new Date().toISOString(),
});

console.log(`Invite code created: ${code}`);
console.log(`Give this to the person you want to let sign up.`);
