import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const router = Router();

router.post('/auth/login', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo' }});
  const user = await prisma.user.findFirst({ where: { email, tenantId: tenant.id }});
  if (!user) return res.status(401).json({ error: 'Unknown user' });

  req.session.userId = user.id;
  req.session.tenantId = tenant.id;
  res.json({ user: { id: user.id, email: user.email, fullName: user.fullName, isAdmin: user.isAdmin }});
});

router.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/auth/me', async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not logged in' });
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
  res.json({ user });
});

export default router;
