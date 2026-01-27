import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const prisma = new PrismaClient()

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'Demo Tenant', slug: 'demo' }
  })

  const admins = [
    {
      email: process.env.ADMIN1_EMAIL || 'dpirkl@4cyber.cz',
      password: process.env.ADMIN1_PASSWORD || '3Cq2U!rtY4Vhz&B3Jcp^Q0svN0ar*c2',
      fullName: process.env.ADMIN1_NAME || 'Admin DP',
    },
    {
      email: process.env.ADMIN2_EMAIL || 'jjancar@4cyber.cz',
      password: process.env.ADMIN2_PASSWORD || 'ww92f2MebJ2!X@YHv&XStMPdh6PhnN08',
      fullName: process.env.ADMIN2_NAME || 'Admin JJ',
    },
  ]

  if (process.env.NODE_ENV === 'production') {
    for (const a of admins) {
      if (!a.email || !a.password || a.password.startsWith('CHANGE_ME')) {
        throw new Error('Set ADMIN1_EMAIL/ADMIN1_PASSWORD and ADMIN2_EMAIL/ADMIN2_PASSWORD in production env.')
      }
    }
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

main().finally(()=>prisma.$disconnect())
