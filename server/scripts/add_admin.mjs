// scripts/add-admin.mjs
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  // 1) tenant "demo" – vytvoří se, pokud neexistuje
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: { name: "Demo Tenant", slug: "demo" },
  })

  // 2) TVŮJ ÚČET – UPRAV SI EMAIL / JMÉNO / HESLO
  const email = "dpirkl@4cyber.cz"
  const fullName = "Admin DP"
  const plainPassword = "3Cq2U!rtY4Vhz&B3Jcp^Q0svN0ar*c2"

  const passwordHash = await bcrypt.hash(plainPassword, 12)

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      isAdmin: true,
      tenantId: tenant.id,
      passwordHash,
    },
    create: {
      email,
      fullName,
      isAdmin: true,
      tenantId: tenant.id,
      passwordHash,
    },
  })

  console.log("ADMIN READY:", {
    id: user.id,
    email: user.email,
    tenantId: user.tenantId,
    isAdmin: user.isAdmin,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })