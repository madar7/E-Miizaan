const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST) {
    return null; // Not configured — caller falls back to logging the link instead
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendPasswordResetEmail(to, resetUrl) {
  const t = getTransporter();

  const subject = "Reset your E-Miizaan password";
  const text = `You requested a password reset.\n\nClick the link below to set a new password (valid for 30 minutes):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`;
  const html = `
    <p>You requested a password reset for your E-Miizaan account.</p>
    <p><a href="${resetUrl}">Click here to set a new password</a> (link valid for 30 minutes).</p>
    <p>If you didn't request this, you can safely ignore this email.</p>
  `;

  if (!t) {
    // No SMTP configured yet (e.g. local development) — log the link so it's still usable.
    console.log("\n[E-Miizaan] SMTP not configured. Password reset link for", to, ":\n", resetUrl, "\n");
    return { delivered: false };
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || `"E-Miizaan" <no-reply@e-miizaan.local>`,
    to,
    subject,
    text,
    html,
  });

  return { delivered: true };
}

module.exports = { sendPasswordResetEmail };
