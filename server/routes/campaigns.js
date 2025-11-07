import { Router } from 'express';
import { PrismaClient, CampaignStatus } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

router.use((req,res,next)=>{
  if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

// list
router.get('/campaigns', async (req,res)=>{
  const rows = await prisma.campaign.findMany({
    where: { tenantId: req.session.tenantId },
    include: { emailTemplate: true, landingPage: true, targetUsers: { include: { user: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(rows);
});

// create
router.post('/campaigns', async (req,res)=>{
  const { name, description, scheduledAt, emailTemplateId, landingPageId, userIds = [] } = req.body || {};
  if (!name || !emailTemplateId || !landingPageId) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const data = await prisma.campaign.create({
    data: {
      tenantId: req.session.tenantId,
      name,
      description: description || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
      status: CampaignStatus.SCHEDULED,
      emailTemplateId,
      landingPageId,
      targetUsers: { create: userIds.map(uid => ({ userId: uid })) }
    }
  });
  res.status(201).json(data);
});

export default router;
