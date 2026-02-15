import { Router } from "express";
import prisma from "../db/prisma.js";
import { sendMail, verifySmtp } from "../utils/mailer.js";
import { getTokenDiagnostics, clearTokenCache } from "../utils/entraOauthClient.js";

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

// OAuth healthcheck (app-only client credentials)
// Nevrací token – jen diagnostiku a expiry.
router.get("/oauth-health", async (_req, res) => {
  try {
    const info = await getTokenDiagnostics();
    res.json(info);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post("/oauth-clear-cache", (_req, res) => {
  clearTokenCache();
  res.json({ ok: true });
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
  if (process.env.EMAIL_SENDING_ENABLED !== "true") {
    return res.status(403).json({ ok: false, error: "Email sending je vypnuté (EMAIL_SENDING_ENABLED=false)." });
  }
  const { to = 'test@dev.local', subject = '4Cyber Phish – test', html = '<h3>MailHog test OK</h3>' } = req.body || {};
  try {

    const info = await sendMail({ to, subject, html });
    res.json({ ok: true, messageId: info.messageId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;

/*

do serveru do .env doplnit:

ENTRA_TENANT_ID=...
ENTRA_CLIENT_ID=...
ENTRA_CLIENT_SECRET=...

# pro první ověření doporučuji nechat Graph default (funguje pro healthcheck)
ENTRA_TOKEN_SCOPE=https://graph.microsoft.com/.default

# volitelné: pokud chceš scope explicitně omezit
# ENTRA_ALLOWED_SCOPES=https://graph.microsoft.com/.default


*/