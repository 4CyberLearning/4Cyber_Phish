import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const prisma = new PrismaClient()

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'Demo Tenant', slug: 'demo' }
  })

  const isProd = process.env.NODE_ENV === 'production'

  const admins = [
    {
      email: process.env.ADMIN1_EMAIL ?? (isProd ? undefined : 'dpirkl@4cyber.cz'),
      password: process.env.ADMIN1_PASSWORD ?? (isProd ? undefined : '3Cq2U!rtY4Vhz&B3Jcp^Q0svN0ar*c2'),
      fullName: process.env.ADMIN1_NAME ?? 'Admin DP',
    },
    {
      email: process.env.ADMIN2_EMAIL ?? (isProd ? undefined : 'jjancar@4cyber.cz'),
      password: process.env.ADMIN2_PASSWORD ?? (isProd ? undefined : 'ww92f2MebJ2!X@YHv&XStMPdh6PhnN08'),
      fullName: process.env.ADMIN2_NAME ?? 'Admin JJ',
    },
    {
      email: process.env.ADMIN3_EMAIL ?? (isProd ? undefined : 'lpirkl@4cyber.cz'),
      password: process.env.ADMIN3_PASSWORD ?? (isProd ? undefined : '62iejKLM4h5N0UzPBVuHkL'),
      fullName: process.env.ADMIN3_NAME ?? 'Admin LP',
    },
    {
      email: process.env.ADMIN4_EMAIL ?? (isProd ? undefined : 'jsommer@4cyber.cz'),
      password: process.env.ADMIN4_PASSWORD ?? (isProd ? undefined : 'nv4GNmuA798mp8P9d6Psa5'),
      fullName: process.env.ADMIN4_NAME ?? 'Admin JS',
    },
  ]


  if (isProd) {
    admins.forEach((a, i) => {
      const n = i + 1
      if (!a.email || !a.password || a.password.startsWith('CHANGE_ME')) {
        throw new Error(`Set ADMIN${n}_EMAIL and ADMIN${n}_PASSWORD in production env.`)
      }
    })
  }

  for (const a of admins) {
    const passwordHash = await bcrypt.hash(a.password, 12)

    await prisma.user.upsert({
      where: { email: a.email },
      update: {
        fullName: a.fullName,
        isAdmin: true,
        tenantId: tenant.id,
        passwordHash,
      },
      create: {
        email: a.email,
        fullName: a.fullName,
        isAdmin: true,
        tenantId: tenant.id,
        passwordHash,
      },
    })
  }

  if (process.env.NODE_ENV !== 'production') {
    await prisma.user.createMany({
      data: [
        { email: 'user1@demo.local', fullName: 'User One', tenantId: tenant.id },
        { email: 'user2@demo.local', fullName: 'User Two', tenantId: tenant.id },
      ],
      skipDuplicates: true,
    })
  }

  await prisma.emailTemplate.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Welcome check' } },
    update: {
      subject: 'Quick check',
      bodyHtml: '<p>Ahoj, toto je ukázková šablona.</p>',
      tags: ['demo'],
      difficulty: 1,
    },
    create: {
      tenantId: tenant.id,
      name: 'Welcome check',
      subject: 'Quick check',
      bodyHtml: '<p>Ahoj, toto je ukázková šablona.</p>',
      tags: ['demo'],
      difficulty: 1,
    },
  })

  await prisma.landingPage.upsert({
    where: { urlSlug: 'lp-demo' },
    update: {
      tenantId: tenant.id,
      name: 'Simple LP',
      html: '<h2>Simulace – tréninkový obsah</h2>',
      tags: ['demo'],
    },
    create: {
      tenantId: tenant.id,
      name: 'Simple LP',
      urlSlug: 'lp-demo',
      html: '<h2>Simulace – tréninkový obsah</h2>',
      tags: ['demo'],
    },
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
