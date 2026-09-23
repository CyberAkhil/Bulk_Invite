const nodemailer = require("nodemailer");

function getTransporter() {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // a Gmail "App Password", not the normal login password
      },
    });
  }

  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }

  return null; // no email configured — caller should fall back to logging
}

async function sendMail({ to, subject, text, html }) {
  const transporter = getTransporter();

  if (!transporter) {
    return { sent: false };
  }

  const from = process.env.MAIL_FROM || process.env.GMAIL_USER || process.env.SMTP_USER || "no-reply@bulkinvite.local";
  await transporter.sendMail({ from, to, subject, text, html });
  return { sent: true };
}

module.exports = { sendMail };
