// server/prisma/seed.js
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'Demo Tenant', slug: 'demo' }
  })

  await prisma.user.createMany({
    data: [
      { email: 'admin@demo.local', fullName: 'Admin', isAdmin: true, tenantId: tenant.id },
      { email: 'user1@demo.local', fullName: 'User One', tenantId: tenant.id },
      { email: 'user2@demo.local', fullName: 'User Two', tenantId: tenant.id },
    ]
  })

  await prisma.emailTemplate.create({
    data: {
      tenantId: tenant.id,
      name: 'Welcome check',
      subject: 'Quick check',
      bodyHtml: '<p>Ahoj, toto je ukázková šablona.</p>',
      tags: ['demo'],
      difficulty: 1
    }
  })

  await prisma.landingPage.create({
    data: {
      tenantId: tenant.id,
      name: 'Simple LP',
      urlSlug: 'lp-demo',
      html: '<h2>Simulace – tréninkový obsah</h2>',
      tags: ['demo']
    }
  })
}

main().finally(()=>prisma.$disconnect())
