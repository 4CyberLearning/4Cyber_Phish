import prisma from "../db/prisma.js";

export const PHISH_TENANT_SLUG = String(process.env.PHISH_TENANT_SLUG || "cyberphish").trim().toLowerCase();
export const PHISH_TENANT_NAME = String(process.env.PHISH_TENANT_NAME || "CyberPhish").trim();

function shouldAllowAutoCreate(allowCreate) {
  if (typeof allowCreate === "boolean") return allowCreate;
  if (String(process.env.PHISH_TENANT_AUTO_CREATE || "").trim() === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export async function getTenantScope(options = {}) {
  const allowCreate = shouldAllowAutoCreate(options.allowCreate);

  let tenant = await prisma.tenant.findUnique({
    where: { slug: PHISH_TENANT_SLUG },
  });

  if (!tenant && allowCreate) {
    tenant = await prisma.tenant.create({
      data: {
        slug: PHISH_TENANT_SLUG,
        name: PHISH_TENANT_NAME,
      },
    });
  }

  if (!tenant) {
    const err = new Error(`Tenant '${PHISH_TENANT_SLUG}' not found.`);
    err.code = "TENANT_NOT_FOUND";
    throw err;
  }

  return tenant;
}

export async function getTenantId(options = {}) {
  const tenant = await getTenantScope(options);
  return tenant.id;
}
