import prisma from "../prismaClient.js";
import { sha256Base64url } from "../utils/integrationKey.js";

export default async function requireIntegrationAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/.exec(h);
  if (!m) return res.status(401).json({ error: "Missing bearer token" });

  const token = m[1].trim();
  const keyHash = sha256Base64url(token);

  const client = await prisma.integrationClient.findFirst({
    where: { keyHash, revokedAt: null },
    select: { id: true, tenantId: true, keyId: true },
  });

  if (!client) return res.status(401).json({ error: "Invalid token" });

  // lightweight usage mark
  await prisma.integrationClient.update({
    where: { id: client.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  req.integration = { tenantId: client.tenantId, clientId: client.id, keyId: client.keyId };
  next();
}