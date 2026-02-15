// server/utils/smtpAuthProvider.js
import { getAccessToken } from "./entraOauthClient.js";

function cleanEnv(v) {
  if (v == null) return "";
  return String(v).trim().replace(/^['"]|['"]$/g, "");
}

function extractEmail(fromValue) {
  const s = String(fromValue || "").trim();
  const m = /<([^>]+)>/.exec(s);
  return (m ? m[1] : s).trim();
}

export async function getSmtpAuthConfig({ smtpUser } = {}) {
  const user =
    cleanEnv(smtpUser) ||
    cleanEnv(process.env.SMTP_USER) ||
    extractEmail(process.env.SMTP_FROM);

  if (!user) {
    throw new Error("Missing smtpUser (or SMTP_USER/SMTP_FROM) for SMTP OAuth.");
  }

  const scope =
    cleanEnv(process.env.ENTRA_TOKEN_SCOPE) || "https://outlook.office365.com/.default";

  const accessToken = await getAccessToken({ scope });

  if (!accessToken) {
    throw new Error("Failed to obtain ENTRA access token for SMTP.");
  }

  // Nodemailer: type OAuth2 -> AUTH XOAUTH2
  return {
    type: "OAuth2",
    user,
    accessToken,
  };
}