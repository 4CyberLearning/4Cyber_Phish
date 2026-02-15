// server/utils/entraOauthClient.js
import https from "node:https";
import { URL } from "node:url";
import fs from "node:fs";
import crypto from "node:crypto";

function cleanEnv(v) {
  if (v == null) return v;
  return String(v).trim().replace(/^['"]|['"]$/g, "");
}

function requiredEnv(name) {
  const v = cleanEnv(process.env[name]);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function optionalEnv(name, def = "") {
  const v = cleanEnv(process.env[name]);
  return !v ? def : v;
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecodeToJson(str) {
  const s = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = s + "===".slice((s.length + 3) % 4);
  const json = Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(json);
}

function decodeJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;
  try {
    return {
      header: base64UrlDecodeToJson(parts[0]),
      payload: base64UrlDecodeToJson(parts[1]),
    };
  } catch {
    return null;
  }
}

function postForm(urlStr, bodyObj) {
  const url = new URL(urlStr);
  const body = new URLSearchParams(bodyObj).toString();

  const options = {
    method: "POST",
    hostname: url.hostname,
    path: url.pathname + url.search,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        if (!ok) {
          return reject(
            new Error(`Token endpoint error ${res.statusCode}: ${data.slice(0, 800)}`)
          );
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse token JSON: ${e?.message || e}`));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function isScopeAllowed(scope) {
  const allow = optionalEnv("ENTRA_ALLOWED_SCOPES", "").trim();
  if (!allow) return true;
  const allowed = new Set(allow.split(/[,\s;]+/).map((s) => s.trim()).filter(Boolean));
  return allowed.has(scope);
}

function readFileStrict(path, label) {
  const p = cleanEnv(path);
  if (!p) throw new Error(`Missing env: ${label}`);
  if (!fs.existsSync(p)) throw new Error(`${label} file not found: ${p}`);
  return fs.readFileSync(p);
}

function sha1ThumbprintFromDer(derBuf) {
  const digest = crypto.createHash("sha1").update(derBuf).digest();
  return base64UrlEncode(digest); // x5t expects base64url(SHA1)
}

function createClientAssertion({ tokenUrl, clientId }) {
  const keyPath = optionalEnv("ENTRA_CLIENT_CERT_KEY_PATH", "");
  const derPath = optionalEnv("ENTRA_CLIENT_CERT_DER_PATH", "");

  const privateKeyPem = readFileStrict(keyPath, "ENTRA_CLIENT_CERT_KEY_PATH").toString("utf8");
  const certDer = readFileStrict(derPath, "ENTRA_CLIENT_CERT_DER_PATH");

  const x5t = sha1ThumbprintFromDer(certDer);

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", x5t };
  const payload = {
    aud: tokenUrl,
    iss: clientId,
    sub: clientId,
    jti: crypto.randomUUID(),
    nbf: now - 5,
    exp: now + 10 * 60,
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(payload)
  )}`;

  const signature = crypto
    .createSign("RSA-SHA256")
    .update(signingInput)
    .end()
    .sign(privateKeyPem);

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

// cache per scope (SMTP token != Graph token)
const cacheByScope = new Map();

export function clearTokenCache(scope) {
  if (scope) {
    cacheByScope.delete(scope);
    return;
  }
  cacheByScope.clear();
}

function getScopeCache(scope) {
  if (!cacheByScope.has(scope)) {
    cacheByScope.set(scope, { accessToken: null, expiresAtMs: 0, inFlight: null });
  }
  return cacheByScope.get(scope);
}

export async function getAccessToken({ scope } = {}) {
  const tenantId = requiredEnv("ENTRA_TENANT_ID");
  const clientId = requiredEnv("ENTRA_CLIENT_ID");

  const tokenScope =
    scope || optionalEnv("ENTRA_TOKEN_SCOPE", "https://graph.microsoft.com/.default");

  if (!isScopeAllowed(tokenScope)) {
    throw new Error(`Scope not allowed by ENTRA_ALLOWED_SCOPES: ${tokenScope}`);
  }

  const c = getScopeCache(tokenScope);

  const nowMs = Date.now();
  if (c.accessToken && c.expiresAtMs - nowMs > 60_000) return c.accessToken;
  if (c.inFlight) return c.inFlight;

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const clientSecret = optionalEnv("ENTRA_CLIENT_SECRET", "");
  const authMode = optionalEnv("ENTRA_CLIENT_AUTH", "auto").toLowerCase(); // auto|cert|secret

  const certKeyPath = optionalEnv("ENTRA_CLIENT_CERT_KEY_PATH", "");
  const certDerPath = optionalEnv("ENTRA_CLIENT_CERT_DER_PATH", "");
  const hasCert = !!certKeyPath && !!certDerPath;
  const hasSecret = !!clientSecret;

  c.inFlight = (async () => {
    const body = {
      client_id: clientId,
      grant_type: "client_credentials",
      scope: tokenScope,
    };

    const useCert =
      authMode === "cert" ? true : authMode === "secret" ? false : hasCert; // auto => prefer cert

    if (useCert) {
      if (!hasCert) {
        throw new Error(
          "ENTRA_CLIENT_AUTH=cert vyžaduje ENTRA_CLIENT_CERT_KEY_PATH a ENTRA_CLIENT_CERT_DER_PATH."
        );
      }
      const assertion = createClientAssertion({ tokenUrl, clientId });
      body.client_assertion_type =
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
      body.client_assertion = assertion;
    } else {
      if (!hasSecret) {
        throw new Error("Chybí ENTRA_CLIENT_SECRET (nebo nastav cert přes ENTRA_CLIENT_CERT_*).");
      }
      body.client_secret = clientSecret;
    }

    const json = await postForm(tokenUrl, body);

    if (!json?.access_token || !json?.expires_in) {
      throw new Error("Unexpected token response (missing access_token/expires_in)");
    }

    c.accessToken = json.access_token;
    c.expiresAtMs = Date.now() + Number(json.expires_in) * 1000;
    c.inFlight = null;

    return c.accessToken;
  })();

  try {
    return await c.inFlight;
  } catch (e) {
    c.inFlight = null;
    throw e;
  }
}

export async function getTokenDiagnostics({ scope } = {}) {
  const tokenScope =
    scope || optionalEnv("ENTRA_TOKEN_SCOPE", "https://graph.microsoft.com/.default");
  const token = await getAccessToken({ scope: tokenScope });
  const decoded = decodeJwt(token);
  const c = getScopeCache(tokenScope);
  const now = Date.now();

  return {
    ok: true,
    scope: tokenScope,
    expiresAt: new Date(c.expiresAtMs).toISOString(),
    expiresInSec: Math.max(0, Math.floor((c.expiresAtMs - now) / 1000)),
    jwt: decoded
      ? {
          aud: decoded.payload?.aud,
          iss: decoded.payload?.iss,
          tid: decoded.payload?.tid,
          appid: decoded.payload?.appid,
          roles: decoded.payload?.roles,
          scp: decoded.payload?.scp,
        }
      : null,
  };
}