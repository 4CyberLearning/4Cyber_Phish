// server/mailer.js
import nodemailer from "nodemailer";
import { getSmtpAuthConfig } from "./smtpAuthProvider.js";

const {
  NODE_ENV = "development",

  EMAIL_SENDING_ENABLED = "false",
  REQUIRE_ALLOWLIST_IN_PROD = "true",

  // allowlist příjemců (fallback env; primárně už používáš DB allowlist)
  ALLOWED_RECIPIENTS = "",
  ALLOWED_RECIPIENT_DOMAINS = "",

  // allowlist odesílatelů (základní pojistka – ideálně používej i sender identities v DB)
  ALLOWED_FROM_DOMAINS = "",

  // pokud true, vynutí: from-email musí být shodný se smtpUser
  STRICT_FROM_MATCH_SMTP_USER = "true",

  MAX_EMAILS_PER_MINUTE = "0",
  MAX_EMAILS_PER_DAY = "0",

  SMTP_HOST = "localhost",
  SMTP_PORT = "1025",
  SMTP_SECURE = "false",
  SMTP_FROM = "App <no-reply@dev.local>",
} = process.env;

const isProd = NODE_ENV === "production";
const emailSendingEnabled = EMAIL_SENDING_ENABLED === "true";

const port = Number(SMTP_PORT);
const secure = SMTP_SECURE === "true";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure, // 465=true, 587=false
  requireTLS: !secure && (port === 587 || port === 25),
  tls: { minVersion: "TLSv1.2" },
});

// refresh auth per message (kvůli dynamickému smtpUser / token refresh)
async function refreshAuth(smtpUser) {
  transporter.options.auth = await getSmtpAuthConfig({ smtpUser });
}

const allowedRecipients = new Set(
  ALLOWED_RECIPIENTS.split(/[,\s;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
);

const allowedDomains = new Set(
  ALLOWED_RECIPIENT_DOMAINS.split(/[,\s;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
);

const allowedFromDomains = new Set(
  ALLOWED_FROM_DOMAINS.split(/[,\s;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
);

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

function isAllowedRecipient(addr) {
  if (!allowedRecipients.size && !allowedDomains.size) return true;

  const email = String(addr).trim().toLowerCase();
  if (allowedRecipients.has(email)) return true;

  const domain = domainOfEmail(email);
  return !!(domain && allowedDomains.has(domain));
}

function enforceFromDomain(fromValue) {
  if (!allowedFromDomains.size) return;

  const fromEmail = extractEmail(fromValue);
  const domain = domainOfEmail(fromEmail);
  if (!domain || !allowedFromDomains.has(domain)) {
    throw new Error(`From doména není povolena: ${fromEmail}`);
  }
}

function enforceFromMatchesSmtpUser(fromValue, smtpUser) {
  if (STRICT_FROM_MATCH_SMTP_USER !== "true") return;
  const fromEmail = extractEmail(fromValue).toLowerCase();
  const smtp = String(smtpUser || "").trim().toLowerCase();
  if (!smtp) throw new Error("smtpUser is required");
  if (fromEmail !== smtp) {
    throw new Error(
      `From (${fromEmail}) musí být shodné se smtpUser (${smtp}). Pro SendAs/alias řeš přes EXO a vypni STRICT_FROM_MATCH_SMTP_USER.`
    );
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

export async function sendMail({ to, subject, html, from, replyTo, smtpUser }) {
  if (!emailSendingEnabled) {
    throw new Error("Email sending je vypnuté (EMAIL_SENDING_ENABLED=false).");
  }

  // (fallback env allowlist; DB allowlist si vynucuješ jinde)
  const recipients = normalizeToList(to);
  const blocked = recipients.filter((r) => !isAllowedRecipient(r));
  if (blocked.length) {
    throw new Error(`Recipient not allowlisted: ${blocked.join(", ")}`);
  }

  const finalFrom = from || SMTP_FROM;

  enforceFromDomain(finalFrom);
  enforceRateLimits();

  const effectiveSmtpUser = smtpUser || process.env.SMTP_USER;
  enforceFromMatchesSmtpUser(finalFrom, effectiveSmtpUser);

  await refreshAuth(effectiveSmtpUser);

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
  await refreshAuth(smtpUser || process.env.SMTP_USER);
  return transporter.verify();
}