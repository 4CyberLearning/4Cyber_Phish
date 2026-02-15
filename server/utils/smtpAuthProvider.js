// server/utils/smtpAuthProvider.js
import { getAccessToken } from "./entraOauthClient.js";

export async function getSmtpAuthConfig() {
  const mode = (process.env.SMTP_AUTH_MODE || "basic").toLowerCase();

  if (mode === "basic") {
    const { SMTP_USER, SMTP_PASS } = process.env;
    return SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined;
  }

  if (mode === "oauth") {
    const user = (process.env.SMTP_USER || "").trim();
    if (!user) throw new Error("Missing env: SMTP_USER (mailbox UPN/email)");

    // pro SMTP app-only token
    const scope = (process.env.SMTP_OAUTH_SCOPE || "https://outlook.office365.com/.default").trim();
    const accessToken = await getAccessToken({ scope });

    return { type: "OAuth2", user, accessToken };
  }

  throw new Error(`Unknown SMTP_AUTH_MODE: ${mode}`);
}