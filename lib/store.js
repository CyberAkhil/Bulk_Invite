const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "storage", "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const INVITES_FILE = path.join(DATA_DIR, "invites.json");

function ensureFile(filePath, defaultContent) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

ensureFile(USERS_FILE, []);
ensureFile(INVITES_FILE, []);

// ---- Users ----
function getUsers() {
  return readJson(USERS_FILE);
}

function findUserByEmail(email) {
  return getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
}

function findUserById(id) {
  return getUsers().find((u) => u.id === id);
}

function createUser(user) {
  const users = getUsers();
  users.push(user);
  writeJson(USERS_FILE, users);
  return user;
}

function updateUser(id, updates) {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...updates };
  writeJson(USERS_FILE, users);
  return users[idx];
}

// ---- Invites ----
function getInvites() {
  return readJson(INVITES_FILE);
}

function findInvite(code) {
  return getInvites().find((i) => i.code === code);
}

function createInvite(invite) {
  const invites = getInvites();
  invites.push(invite);
  writeJson(INVITES_FILE, invites);
  return invite;
}

function markInviteUsed(code, userId) {
  const invites = getInvites();
  const invite = invites.find((i) => i.code === code);
  if (invite) {
    invite.used = true;
    invite.usedBy = userId;
    invite.usedAt = new Date().toISOString();
    writeJson(INVITES_FILE, invites);
  }
}

module.exports = {
  getUsers,
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  getInvites,
  findInvite,
  createInvite,
  markInviteUsed,
};
