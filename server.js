const express = require("express");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const multer = require("multer");
const path = require("path");

const { parseContactsFile } = require("./routes/parse");
const { getOrCreateSession, getState, startBulkSend, resetSession } = require("./routes/whatsapp");
const { router: authRouter, requireAuth, requireAdmin } = require("./routes/auth");
const adminRouter = require("./routes/admin");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(
  session({
    store: new FileStore({
      path: path.join(__dirname, "storage", "sessions"),
      ttl: 7 * 24 * 60 * 60,
      retries: 5,
      fileExtension: ".json",
    }),
    secret: process.env.SESSION_SECRET || "change-this-secret-before-going-live",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days
  })
);

app.use("/api/auth", authRouter);
app.use("/api/admin", requireAuth, requireAdmin, adminRouter);

// --- WhatsApp connection status / QR code for login (per user) ---
app.get("/api/qr", requireAuth, (req, res) => {
  getOrCreateSession(req.session.userId); // lazily starts the client on first check
  const state = getState(req.session.userId);
  res.json({ ready: state.ready, qr: state.qrDataUrl });
});

// --- Force a fresh QR code (regenerate / reconnect) ---
app.post("/api/qr/regenerate", requireAuth, async (req, res) => {
  await resetSession(req.session.userId);
  res.json({ ok: true });
});

// --- Upload & parse the Excel sheet (per user) ---
app.post("/api/upload", requireAuth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });

  const result = parseContactsFile(req.file.buffer);
  if (result.error) return res.status(400).json({ error: result.error });

  const state = getState(req.session.userId);
  state.contacts = result.valid;

  res.json({
    validCount: result.valid.length,
    invalidCount: result.invalid.length,
    invalid: result.invalid,
    contacts: state.contacts,
    columnsUsed: result.columnsUsed,
  });
});

// --- Kick off the rate-limited bulk send (per user) ---
app.post("/api/send", requireAuth, async (req, res) => {
  const { inviteLink, message } = req.body;
  if (!inviteLink) return res.status(400).json({ error: "inviteLink is required." });

  const state = getState(req.session.userId);
  if (!state.contacts.length) return res.status(400).json({ error: "No contacts uploaded yet." });

  const result = await startBulkSend(req.session.userId, inviteLink, message);
  if (!result.started) return res.status(409).json({ error: result.reason });

  res.json({ started: true, total: state.contacts.length });
});

// --- Poll send status (per user) ---
app.get("/api/status", requireAuth, (req, res) => {
  const state = getState(req.session.userId);
  res.json({
    sending: state.sending,
    contacts: state.contacts,
    sentCount: state.contacts.filter((c) => c.status === "sent").length,
    failedCount: state.contacts.filter((c) => c.status === "failed").length,
    pendingCount: state.contacts.filter((c) => c.status === "pending" || c.status === "sending").length,
  });
});

// Static pages — login/signup are open, everything else needs a session.
// (Front-end also redirects to login.html on a 401 from any /api call.)
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`WhatsApp Bulk Invite server running at http://localhost:${PORT}`);
});
