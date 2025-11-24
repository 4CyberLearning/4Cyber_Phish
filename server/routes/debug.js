import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { sendMail, verifySmtp } from "../utils/mailer.js";

const prisma = new PrismaClient();
const router = Router();

// musí být přihlášen
router.use((req, res, next) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

router.get('/health', async (_req, res) => {
  try {
    await verifySmtp();
    res.json({ smtp: 'ok' });
  } catch (e) {
    res.status(500).json({ smtp: 'fail', error: e.message });
  }
});

router.get('/templates', async (req, res) => {
  const list = await prisma.emailTemplate.findMany({
    where: { tenantId: req.session.tenantId },
    orderBy: { id: 'asc' },
  });
  res.json(list);
});

router.get('/landing-pages', async (req, res) => {
  const list = await prisma.landingPage.findMany({
    where: { tenantId: req.session.tenantId },
    orderBy: { id: 'asc' },
  });
  res.json(list);
});

// odeslání test mailu do MailHog
router.post('/send-test', async (req, res) => {
  const { to = 'test@dev.local', subject = '4Cyber Phish – test', html = '<h3>MailHog test OK</h3>' } = req.body || {};
  try {
    const info = await sendMail({ to, subject, html });
    res.json({ ok: true, messageId: info.messageId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
