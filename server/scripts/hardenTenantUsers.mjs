import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

const tenantSlug = String(readArg("tenant", process.env.PHISH_TENANT_SLUG || "cyberphish")).trim().toLowerCase();
const tenantName = String(readArg("tenant-name", process.env.PHISH_TENANT_NAME || "CyberPhish")).trim();
const email = String(readArg("email", process.env.PHISH_ADMIN_EMAIL || "")).trim().toLowerCase();
const fullName = String(readArg("name", process.env.PHISH_ADMIN_NAME || "CyberPhish Admin")).trim();
const plainPassword = String(readArg("password", process.env.PHISH_ADMIN_PASSWORD || "")).trim();
const dryRun = !process.argv.includes("--apply");

async function main() {
  if (!email) throw new Error("Missing admin email. Use --email=<EMAIL> or PHISH_ADMIN_EMAIL.");
  if (!plainPassword) throw new Error("Missing admin password. Use --password=<PASSWORD> or PHISH_ADMIN_PASSWORD.");

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { name: tenantName },
    create: { name: tenantName, slug: tenantSlug },
  });

  const existingUsers = await prisma.user.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ isAdmin: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      fullName: true,
      isAdmin: true,
      isActive: true,
      externalUserPublicId: true,
      createdAt: true,
    },
  });

  const seededDemoEmails = new Set(["user1@demo.local", "user2@demo.local"]);

  const adminsToDisable = existingUsers.filter((user) => user.email !== email && user.isAdmin);
  const demoUsersToDelete = existingUsers.filter((user) => seededDemoEmails.has(String(user.email).toLowerCase()));
  const localUsersToDisable = existingUsers.filter(
    (user) => user.email !== email && !user.externalUserPublicId && !user.isAdmin && !seededDemoEmails.has(String(user.email).toLowerCase()),
  );

  const plan = {
    tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
    centralAdmin: email,
    adminsToDisable: adminsToDisable.map((user) => ({ id: user.id, email: user.email })),
    demoUsersToDelete: demoUsersToDelete.map((user) => ({ id: user.id, email: user.email })),
    localUsersToDisable: localUsersToDisable.map((user) => ({ id: user.id, email: user.email })),
    syncedUsersKept: existingUsers.filter((user) => Boolean(user.externalUserPublicId)).length,
    mode: dryRun ? "dry-run" : "apply",
  };

  console.log(JSON.stringify(plan, null, 2));

  if (dryRun) {
    console.log("Dry run only. Re-run with --apply to execute changes.");
    return;
  }

  const passwordHash = await bcrypt.hash(plainPassword, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email,
        },
      },
      update: {
        fullName,
        isAdmin: true,
        isActive: true,
        passwordHash,
      },
      create: {
        tenantId: tenant.id,
        email,
        fullName,
        isAdmin: true,
        isActive: true,
        passwordHash,
      },
    });

    if (adminsToDisable.length) {
      await tx.user.updateMany({
        where: {
          tenantId: tenant.id,
          id: { in: adminsToDisable.map((user) => user.id) },
        },
        data: {
          isAdmin: false,
          isActive: false,
          passwordHash: null,
        },
      });
    }

    if (localUsersToDisable.length) {
      await tx.user.updateMany({
        where: {
          tenantId: tenant.id,
          id: { in: localUsersToDisable.map((user) => user.id) },
        },
        data: {
          isActive: false,
          passwordHash: null,
        },
      });
    }

    if (demoUsersToDelete.length) {
      await tx.user.deleteMany({
        where: {
          tenantId: tenant.id,
          id: { in: demoUsersToDelete.map((user) => user.id) },
        },
      });
    }
  });

  console.log("Tenant hardening complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
