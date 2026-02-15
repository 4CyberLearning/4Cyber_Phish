// server/smtpAuthProvider.js
import { getAccessToken } from "./entraOauthClient.js";

function clean(v) {
  return v == null ? "" : String(v).trim().replace(/^['"]|['"]$/g, "");
}

function required(name) {
  const v = clean(process.env[name]);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function optional(name, def = "") {
  const v = clean(process.env[name]);
  return v || def;
}

/**
 * Returns nodemailer auth config.
 * - OAuth app-only (preferred): { type: "OAuth2", user, accessToken }
 * - Fallback basic auth (if you still use it): { user, pass }
 */
export async function getSmtpAuthConfig({ smtpUser } = {}) {
  const user = clean(smtpUser) || "";
  if (!user) {
    throw new Error(
      "SMTP_USER is required (or pass smtpUser to sendMail) to know which mailbox to send as."
    );
  }

  const tenantId = clean(process.env.ENTRA_TENANT_ID);
  const clientId = clean(process.env.ENTRA_CLIENT_ID);

  // OAuth path (app-only)
  if (tenantId && clientId) {
    // SMTP OAuth needs outlook resource (.default)
    const scope = optional("ENTRA_TOKEN_SCOPE", "https://outlook.office365.com/.default");
    const accessToken = await getAccessToken({ scope });
    return {
      type: "OAuth2",
      user,
      accessToken,
    };
  }

  // Fallback basic (not recommended for EXO long-term)
  const pass = clean(process.env.SMTP_PASS);
  if (!pass) {
    throw new Error(
      "No Entra OAuth config found (ENTRA_TENANT_ID/ENTRA_CLIENT_ID) and SMTP_PASS is missing."
    );
  }

  return { user, pass };
}