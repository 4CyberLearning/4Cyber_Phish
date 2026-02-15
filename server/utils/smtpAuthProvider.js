// server/utils/smtpAuthProvider.js
import { getAccessToken } from "./entraOauthClient.js";

export async function getSmtpAuthConfig({ smtpUser } = {}) {
  const mode = (process.env.SMTP_AUTH_MODE || "oauth").toLowerCase(); // <- změna (default oauth)

  if (mode === "basic") {
    const { SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_USER || !SMTP_PASS) {
      throw new Error("SMTP_AUTH_MODE=basic vyžaduje SMTP_USER a SMTP_PASS."); // <- změna (nevracet undefined)
    }
    return { user: SMTP_USER, pass: SMTP_PASS };
  }

  if (mode === "oauth") {
    const user = (smtpUser || process.env.SMTP_USER || "").trim().toLowerCase();
    if (!user) throw new Error("Missing smtpUser (sender mailbox UPN/email)");

    const scope = (
      process.env.SMTP_OAUTH_SCOPE ||
      process.env.ENTRA_TOKEN_SCOPE ||
      "https://outlook.office365.com/.default"
    ).trim();

    const accessToken = await getAccessToken({ scope });

    return { type: "OAuth2", user, accessToken };
  }

  throw new Error(`Unknown SMTP_AUTH_MODE: ${mode}`);
}