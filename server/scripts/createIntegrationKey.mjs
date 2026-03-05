import prisma from "../db/prisma.js";
import { makeIntegrationToken } from "../utils/integrationKey.js";

const tenantSlug = process.argv[2];
const name = process.argv[3] || "4CyberCity";

if (!tenantSlug) {
  console.error("Usage: node server/scripts/createIntegrationKey.mjs <tenantSlug> [name]");
  process.exit(1);
}

const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
if (!tenant) {
  console.error("Tenant not found:", tenantSlug);
  process.exit(1);
}

const { keyId, token, keyHash } = makeIntegrationToken();

await prisma.integrationClient.create({
  data: { tenantId: tenant.id, name, keyId, keyHash },
});

console.log("✅ Created integration key");
console.log("tenant:", tenantSlug);
console.log("keyId:", keyId);
console.log("TOKEN (store in 4CyberCity GUI):");
console.log(token);