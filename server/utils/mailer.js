// server/utils/mailer.js
import nodemailer from "nodemailer";
import { getSmtpAuthConfig } from "./smtpAuthProvider.js";

const {
  NODE_ENV = "development",

  EMAIL_SENDING_ENABLED = "false",
  REQUIRE_ALLOWLIST_IN_PROD = "true",

  SMTP_HOST = "smtp.office365.com",
  SMTP_PORT = "587",
  SMTP_SECURE = "false",
  SMTP_FROM = "App <no-reply@dev.local>",

  MAX_EMAILS_PER_MINUTE = "0",
  MAX_EMAILS_PER_DAY = "0",

  // fallback allowlist z ENV (když policy nepředáš)
  ALLOWED_RECIPIENTS = "",
  ALLOWED_RECIPIENT_DOMAINS = "",
  ALLOWED_FROM_DOMAINS = "",

  SMTP_DEBUG = "false",
} = process.env;

const isProd = NODE_ENV === "production";
const emailSendingEnabled = EMAIL_SENDING_ENABLED === "true";

const port = Number(SMTP_PORT);
const secure = SMTP_SECURE === "true";
const smtpDebug = SMTP_DEBUG === "true";

function toSet(value) {
  if (!value) return new Set();
  return new Set(
    String(value)
      .split(/[,\s;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

const envAllowedRecipients = toSet(ALLOWED_RECIPIENTS);
const envAllowedDomains = toSet(ALLOWED_RECIPIENT_DOMAINS);
const envAllowedFromDomains = toSet(ALLOWED_FROM_DOMAINS);

if (
  isProd &&
  emailSendingEnabled &&
  REQUIRE_ALLOWLIST_IN_PROD === "true" &&
  !envAllowedRecipients.size &&
  !envAllowedDomains.size
) {
  throw new Error(
    "EMAIL_SENDING_ENABLED=true v produkci vyžaduje ALLOWED_RECIPIENTS nebo ALLOWED_RECIPIENT_DOMAINS (nebo předávej policy z DB)."
  );
}

function normalizeToList(to) {
  if (Array.isArray(to)) return to;
  if (typeof to === "string") {
    return to.split(/[,\s;]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [String(to)];
}

function extractEmail(fromValue) {
  const s = String(fromValue || "").trim();
  const m = /<([^>]+)>/.exec(s);
  return (m ? m[1] : s).trim();
}

function domainOfEmail(addr) {
  const email = String(addr).trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0) return null;
  return email.slice(at + 1);
}

function isAllowedRecipient(addr, policy) {
  const allowedRecipients = policy?.allowedRecipients || envAllowedRecipients;
  const allowedDomains = policy?.allowedRecipientDomains || envAllowedDomains;

  if (!allowedRecipients.size && !allowedDomains.size) return true;

  const email = String(addr).trim().toLowerCase();
  if (allowedRecipients.has(email)) return true;

  const domain = domainOfEmail(email);
  return !!(domain && allowedDomains.has(domain));
}

function enforceFromDomain(fromValue, policy) {
  const allowedFromDomains = policy?.allowedFromDomains || envAllowedFromDomains;
  if (!allowedFromDomains.size) return;

  const fromEmail = extractEmail(fromValue);
  const domain = domainOfEmail(fromEmail);
  if (!domain || !allowedFromDomains.has(domain)) {
    throw new Error(`From doména není povolena: ${fromEmail}`);
  }
}

// jednoduchý in-memory rate limit
let minuteWindowStart = Date.now();
let sentThisMinute = 0;

let dayKey = new Date().toISOString().slice(0, 10);
let sentToday = 0;

function enforceRateLimits() {
  const maxPerMin = Number(MAX_EMAILS_PER_MINUTE) || 0;
  const maxPerDay = Number(MAX_EMAILS_PER_DAY) || 0;

  const now = Date.now();

  if (now - minuteWindowStart >= 60_000) {
    minuteWindowStart = now;
    sentThisMinute = 0;
  }

  const currentDayKey = new Date().toISOString().slice(0, 10);
  if (currentDayKey !== dayKey) {
    dayKey = currentDayKey;
    sentToday = 0;
  }

  if (maxPerMin > 0 && sentThisMinute >= maxPerMin) {
    throw new Error(`Rate limit: MAX_EMAILS_PER_MINUTE (${maxPerMin}) exceeded`);
  }
  if (maxPerDay > 0 && sentToday >= maxPerDay) {
    throw new Error(`Rate limit: MAX_EMAILS_PER_DAY (${maxPerDay}) exceeded`);
  }
}

function createTransport(auth) {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    requireTLS: !secure && (port === 587 || port === 25),
    auth,
    tls: { minVersion: "TLSv1.2" },
    ...(smtpDebug ? { logger: true, debug: true } : {}),
  });
}

export async function sendMail({ smtpUser, to, subject, html, from, replyTo, policy } = {}) {
  if (!emailSendingEnabled) {
    throw new Error("Email sending je vypnuté (EMAIL_SENDING_ENABLED=false).");
  }

  const recipients = normalizeToList(to);
  const blocked = recipients.filter((r) => !isAllowedRecipient(r, policy));
  if (blocked.length) {
    throw new Error(`Recipient not allowlisted: ${blocked.join(", ")}`);
  }

  const finalFrom = from || SMTP_FROM;
  enforceFromDomain(finalFrom, policy);
  enforceRateLimits();

  const auth = await getSmtpAuthConfig({ smtpUser });

  // bezpečný log pro ověření, že auth fakt existuje (neprintuj token)
  if (smtpDebug) {
    console.log("[SMTP] auth:", { type: auth?.type, user: auth?.user, hasToken: !!auth?.accessToken });
  }

  const transporter = createTransport(auth);

  const info = await transporter.sendMail({
    from: finalFrom,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });

  sentThisMinute += 1;
  sentToday += 1;

  return info;
}

export async function verifySmtp({ smtpUser } = {}) {
  const auth = await getSmtpAuthConfig({ smtpUser });
  const transporter = createTransport(auth);
  return transporter.verify();
}