import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TENANT_SLUG = String(process.env.PHISH_TENANT_SLUG || "cyberphish").trim().toLowerCase();
const TENANT_NAME = String(process.env.PHISH_TENANT_NAME || "CyberPhish").trim();
const ADMIN_EMAIL = String(process.env.PHISH_ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.PHISH_ADMIN_PASSWORD || "").trim();
const ADMIN_NAME = String(process.env.PHISH_ADMIN_NAME || "CyberPhish Admin").trim();
const SEED_SAMPLE_CONTENT = String(process.env.PHISH_SEED_SAMPLE_CONTENT || "false").trim() === "true";

function assertRequiredEnv() {
  if (!ADMIN_EMAIL) {
    throw new Error("Missing PHISH_ADMIN_EMAIL for seed.");
  }
  if (!ADMIN_PASSWORD) {
    throw new Error("Missing PHISH_ADMIN_PASSWORD for seed.");
  }
  if (process.env.NODE_ENV === "production" && ADMIN_PASSWORD.length < 20) {
    throw new Error("PHISH_ADMIN_PASSWORD must have at least 20 characters in production.");
  }
}

async function seedAdmin(tenantId) {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  return prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId,
        email: ADMIN_EMAIL,
      },
    },
    update: {
      fullName: ADMIN_NAME,
      isAdmin: true,
      isActive: true,
      passwordHash,
    },
    create: {
      tenantId,
      email: ADMIN_EMAIL,
      fullName: ADMIN_NAME,
      isAdmin: true,
      isActive: true,
      passwordHash,
    },
  });
}

async function seedSampleContent(tenantId) {
  await prisma.emailTemplate.upsert({
    where: { tenantId_name: { tenantId, name: "Welcome check" } },
    update: {
      subject: "Quick check",
      bodyHtml: "<p>Ahoj, toto je ukázková šablona.</p>",
      tags: ["demo"],
      difficulty: 1,
    },
    create: {
      tenantId,
      name: "Welcome check",
      subject: "Quick check",
      bodyHtml: "<p>Ahoj, toto je ukázková šablona.</p>",
      tags: ["demo"],
      difficulty: 1,
    },
  });

  await prisma.landingPage.upsert({
    where: { urlSlug: "lp-demo" },
    update: {
      tenantId,
      name: "Simple LP",
      html: "<h2>Simulace – tréninkový obsah</h2>",
      tags: ["demo"],
    },
    create: {
      tenantId,
      name: "Simple LP",
      urlSlug: "lp-demo",
      html: "<h2>Simulace – tréninkový obsah</h2>",
      tags: ["demo"],
    },
  });
}

async function main() {
  assertRequiredEnv();

  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    update: { name: TENANT_NAME },
    create: { name: TENANT_NAME, slug: TENANT_SLUG },
  });

  const admin = await seedAdmin(tenant.id);

  if (SEED_SAMPLE_CONTENT) {
    await seedSampleContent(tenant.id);
  }

  console.log("Seed complete", {
    tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
    admin: { id: admin.id, email: admin.email },
    sampleContent: SEED_SAMPLE_CONTENT,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
