import nodemailer from "nodemailer";

const {
  SMTP_HOST = "localhost",
  SMTP_PORT = "1025",
  SMTP_SECURE = "false",
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM = "4Cyber Phish <no-reply@dev.local>",

  // Bezpečnost: omez odesílání jen na povolené příjemce/domény
  ALLOWED_RECIPIENTS = "",          // např. "a@firma.cz,b@firma.cz"
  ALLOWED_RECIPIENT_DOMAINS = "",   // např. "firma.cz,subsidiary.cz"
} = process.env;

const port = Number(SMTP_PORT);
const secure = SMTP_SECURE === "true";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure, // 465=true, 587=false
  requireTLS: !secure && (port === 587 || port === 25), // vynutit STARTTLS
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  tls: { minVersion: "TLSv1.2" },
});

const allowedRecipients = new Set(
  ALLOWED_RECIPIENTS.split(/[,\s;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
);

const allowedDomains = new Set(
  ALLOWED_RECIPIENT_DOMAINS.split(/[,\s;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
);

function normalizeToList(to) {
  if (Array.isArray(to)) return to;
  if (typeof to === "string") {
    return to.split(/[,\s;]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [String(to)];
}

function isAllowed(addr) {
  // pokud není nic nastaveno, neomezuj
  if (!allowedRecipients.size && !allowedDomains.size) return true;

  const email = String(addr).trim().toLowerCase();
  if (allowedRecipients.has(email)) return true;

  const at = email.lastIndexOf("@");
  if (at > 0) {
    const domain = email.slice(at + 1);
    if (allowedDomains.has(domain)) return true;
  }
  return false;
}

export async function sendMail({ to, subject, html, from, replyTo }) {
  const recipients = normalizeToList(to);
  const blocked = recipients.filter((r) => !isAllowed(r));

  if (blocked.length) {
    throw new Error(`Recipient not allowlisted: ${blocked.join(", ")}`);
  }

  const info = await transporter.sendMail({
    from: from || SMTP_FROM,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
  return info;
}

export async function verifySmtp() {
  return transporter.verify();
}
