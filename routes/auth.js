const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const {
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  findInvite,
  markInviteUsed,
} = require("../lib/store");
const { sendMail } = require("../lib/mailer");

const router = express.Router();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "nikhilgumasta1@gmail.com").toLowerCase();

router.post("/signup", async (req, res) => {
  const { email, password, inviteCode } = req.body;

  if (!email || !password || !inviteCode) {
    return res.status(400).json({ error: "Email, password, and invite code are all required." });
  }

  const invite = findInvite(inviteCode.trim().toUpperCase());
  if (!invite) return res.status(400).json({ error: "Invalid invite code." });
  if (invite.used) return res.status(400).json({ error: "This invite code has already been used." });

  if (findUserByEmail(email)) {
    return res.status(400).json({ error: "An account with this email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  createUser(user);
  markInviteUsed(invite.code, user.id);

  req.session.userId = user.id;
  res.json({ ok: true, email: user.email });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required." });

  const user = findUserByEmail(email);
  if (!user) return res.status(401).json({ error: "Invalid email or password." });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error: "Invalid email or password." });

  req.session.userId = user.id;
  res.json({ ok: true, email: user.email });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/me", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not logged in." });
  const user = findUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: "Not logged in." });
  res.json({ email: user.email, isAdmin: user.email.toLowerCase() === ADMIN_EMAIL });
});

// --- Forgot / reset password ---
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required." });

  const user = findUserByEmail(email);

  // Always respond the same way whether or not the account exists,
  // so this endpoint can't be used to check which emails are registered.
  if (user) {
    const token = crypto.randomBytes(24).toString("hex");
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour
    updateUser(user.id, { resetToken: token, resetTokenExpires: expires });

    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const resetLink = `${baseUrl}/reset-password.html?token=${token}`;

    const { sent } = await sendMail({
      to: user.email,
      subject: "Reset your Bulk Invite password",
      text: `Reset your password here (valid 1 hour): ${resetLink}`,
    });

    if (!sent) {
      // No SMTP/Gmail configured — print the link so it's still usable during dev/testing.
      console.log(`[auth] Password reset link for ${user.email}: ${resetLink}`);
    }
  }

  res.json({ ok: true, message: "If that email has an account, a reset link has been sent." });
});

router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: "Token and new password are required." });

  const { getUsers } = require("../lib/store");
  const user = getUsers().find((u) => u.resetToken === token && u.resetTokenExpires > Date.now());
  if (!user) return res.status(400).json({ error: "This reset link is invalid or has expired." });

  const passwordHash = await bcrypt.hash(password, 10);
  updateUser(user.id, { passwordHash, resetToken: null, resetTokenExpires: null });

  res.json({ ok: true });
});

function requireAuth(req, res, next) {
  if (!req.session.userId || !findUserById(req.session.userId)) {
    return res.status(401).json({ error: "Not logged in." });
  }
  next();
}

function requireAdmin(req, res, next) {
  const user = findUserById(req.session.userId);
  if (!user || user.email.toLowerCase() !== ADMIN_EMAIL) {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

module.exports = { router, requireAuth, requireAdmin };
