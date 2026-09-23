const { Client, LocalAuth } = require("whatsapp-web.js");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

const SESSIONS_DIR = path.join(__dirname, "..", "storage", "sessions");
fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// ---- Per-user WhatsApp sessions ----
// Each signed-up user gets their own Chromium instance + WhatsApp session.
// This is the single biggest resource cost of this app: N active users
// roughly means N Chromium processes running on the server at once.
const sessions = new Map(); // userId -> { client, state }

function newState() {
  return {
    qrDataUrl: null,
    ready: false,
    contacts: [], // [{ id, name, phone, status, error }]
    sending: false,
    minDelayMs: 4000, // minimum gap between sends — do NOT go much lower than this
    maxDelayMs: 6000,
  };
}

function getOrCreateSession(userId) {
  if (sessions.has(userId)) return sessions.get(userId);

  const state = newState();

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: userId, dataPath: SESSIONS_DIR }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    },
  });

  client.on("qr", async (qr) => {
    state.qrDataUrl = await QRCode.toDataURL(qr);
    state.ready = false;
    console.log(`[wa:${userId}] New QR code generated.`);
  });

  client.on("ready", () => {
    state.ready = true;
    state.qrDataUrl = null;
    console.log(`[wa:${userId}] Client is ready.`);
  });

  client.on("disconnected", (reason) => {
    state.ready = false;
    console.log(`[wa:${userId}] Disconnected:`, reason);
  });

  client.initialize();

  const session = { client, state };
  sessions.set(userId, session);
  return session;
}

function getState(userId) {
  return getOrCreateSession(userId).state;
}

/**
 * Fully tears down a user's WhatsApp client and clears its saved session,
 * so the next /api/qr call starts fresh and shows a brand-new QR code.
 * Used by the "Regenerate QR" button — handles both an expired QR and
 * someone wanting to link a different WhatsApp account.
 */
async function resetSession(userId) {
  const existing = sessions.get(userId);
  if (existing) {
    try {
      await existing.client.destroy();
    } catch (err) {
      console.log(`[wa:${userId}] Error destroying client during reset:`, err.message);
    }
    sessions.delete(userId);
  }

  const sessionFolder = path.join(SESSIONS_DIR, `session-${userId}`);
  if (fs.existsSync(sessionFolder)) {
    fs.rmSync(sessionFolder, { recursive: true, force: true });
  }

  console.log(`[wa:${userId}] Session reset — will generate a fresh QR on next check.`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(state) {
  const { minDelayMs, maxDelayMs } = state;
  return Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
}

function buildMessage(template, contact, inviteLink) {
  return (template || "Hi {name}, join our group: {link}")
    .replace("{name}", contact.name)
    .replace("{link}", inviteLink);
}

/**
 * Sends the invite link + message to every pending contact for this user,
 * one at a time, with a randomized delay between sends.
 */
async function startBulkSend(userId, inviteLink, messageTemplate) {
  const { client, state } = getOrCreateSession(userId);

  if (state.sending) return { started: false, reason: "A send is already in progress." };
  if (!state.ready) return { started: false, reason: "WhatsApp is not connected yet — scan the QR code first." };

  state.sending = true;
  console.log(`[send:${userId}] Starting bulk send to ${state.contacts.length} contact(s)...`);

  (async () => {
    for (const contact of state.contacts) {
      if (contact.status === "sent") continue;

      contact.status = "sending";
      console.log(`[send:${userId}] -> ${contact.name} (${contact.phone})`);

      try {
        const numberId = await client.getNumberId(contact.phone.replace("+", ""));
        if (!numberId) {
          contact.status = "failed";
          contact.error = "Number is not on WhatsApp";
          await sleep(randomDelay(state));
          continue;
        }

        const text = buildMessage(messageTemplate, contact, inviteLink);

        try {
          await client.sendMessage(numberId._serialized, text);
        } catch (firstErr) {
          if (/findChat/i.test(firstErr.message || "")) {
            const fallbackId = contact.phone.replace("+", "") + "@c.us";
            await client.sendMessage(fallbackId, text);
          } else {
            throw firstErr;
          }
        }

        contact.status = "sent";
        contact.error = null;
      } catch (err) {
        contact.status = "failed";
        contact.error = err.message || "Unknown send error";
      }

      await sleep(randomDelay(state));
    }
    state.sending = false;
    console.log(`[send:${userId}] Bulk send finished.`);
  })().catch((err) => {
    state.sending = false;
    console.error(`[send:${userId}] Bulk send loop crashed:`, err);
  });

  return { started: true };
}

module.exports = { getOrCreateSession, getState, startBulkSend, resetSession };
