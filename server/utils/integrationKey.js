import crypto from "crypto";

export function sha256Base64url(input) {
  return crypto.createHash("sha256").update(input, "utf8").digest("base64url");
}

export function makeIntegrationToken() {
  const keyId = `ik_${crypto.randomBytes(6).toString("hex")}`;      // veřejná část
  const secret = crypto.randomBytes(24).toString("base64url");      // tajná část
  const token = `${keyId}.${secret}`;
  const keyHash = sha256Base64url(token);
  return { keyId, token, keyHash };
}