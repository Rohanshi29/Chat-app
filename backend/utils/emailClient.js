// Thin wrapper around nodemailer for transactional email (currently just
// password resets). If SMTP isn't configured, it logs the email to the
// console instead of failing - handy for local development.
//
// Configure in backend/.env:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
// Works with Gmail (use an App Password), SendGrid, Mailgun, etc.

const nodemailer = require("nodemailer");

const isConfigured = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

let transporter = null;
if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Force IPv4: some home networks/ISPs have broken IPv6 routing, which
    // shows up as ECONNREFUSED on an IPv6 address even though IPv4 works fine.
    family: 4,
  });
}

const logToConsole = ({ to, subject, html, text }) => {
  console.log("\n--- Email (see below) ---");
  console.log(`To: ${to}\nSubject: ${subject}\n${text || html}`);
  console.log("--------------------------\n");
};

// Sending a real email is a nice-to-have layered on top of the core flow -
// if it's not configured, or the SMTP connection fails for any reason
// (network/firewall blocking the port, wrong credentials, etc.), fall back
// to logging instead of throwing. Callers (like password reset) should
// never break just because outbound email isn't working.
const sendEmail = async ({ to, subject, html, text }) => {
  if (!isConfigured) {
    logToConsole({ to, subject, html, text });
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text,
    });
  } catch (error) {
    console.error("Failed to send email via SMTP, logging instead:", error.message);
    logToConsole({ to, subject, html, text });
  }
};

module.exports = { sendEmail, isConfigured };
