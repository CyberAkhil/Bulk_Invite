const express = require("express");
const crypto = require("crypto");
const { getInvites, createInvite, getUsers } = require("../lib/store");

const router = express.Router();

router.get("/invites", (req, res) => {
  const invites = getInvites();
  const users = getUsers();
  const withEmail = invites.map((i) => ({
    ...i,
    usedByEmail: i.usedBy ? (users.find((u) => u.id === i.usedBy) || {}).email || null : null,
  }));
  res.json({ invites: withEmail });
});

router.post("/invites", (req, res) => {
  const code = crypto.randomBytes(4).toString("hex").toUpperCase();
  const invite = createInvite({
    code,
    used: false,
    usedBy: null,
    createdAt: new Date().toISOString(),
  });
  res.json({ invite });
});

router.get("/users", (req, res) => {
  const users = getUsers().map((u) => ({ id: u.id, email: u.email, createdAt: u.createdAt }));
  res.json({ users });
});

module.exports = router;
