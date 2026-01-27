// server/index.js
import express from "express";
import session from "express-session";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

import helmet from "helmet";
import rateLimit from "express-rate-limit";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

import authRouter from "./routes/auth.js";
import templatesRouter from "./routes/templates.js";
import landingPagesRouter from "./routes/landingPages.js";
import assetsRouter from "./routes/assets.js";
import campaignsRouter from "./routes/campaigns.js";
import debugRouter from "./routes/debug.js";
import trackingRouter from "./routes/tracking.js";
import recipientsRouter from "./routes/recipients.js";
import senderIdentitiesRouter from "./routes/senderIdentities.js";
import senderDomainsRouter from "./routes/senderDomains.js";
import campaignReportsRouter from "./routes/campaignReports.js";
import publicLandingRouter from "./routes/publicLanding.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

// ---------- Security headers ----------
app.use(
  helmet({
    // zatím necháváme default; CSP případně doladíš později kvůli inline HTML
  })
);

// ---------- CORS ----------
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // dev: povol bez origin (curl, server-to-server), nebo když nemáš whitelist
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0) return cb(null, true);

      return cb(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  })
);

// ---------- Parsování požadavků ----------
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ---------- Postgres session store ----------
const { Pool } = pg;
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const PgSession = connectPgSimple(session);

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const SESSION_MAX_AGE_MS = Number(process.env.SESSION_MAX_AGE_MS || 1000 * 60 * 60 * 24 * 7); // 7 dní
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "phish.sid";

app.use(
  session({
    name: SESSION_COOKIE_NAME,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, // prodlužuje session při aktivitě
    store: new PgSession({
      pool: pgPool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_MAX_AGE_MS,
    },
  })
);

function requireAuth(req, res, next) {
  if (req.session?.userId) return next();
  return res.status(401).json({ error: "Not logged in" });
}

// ---------- Statické soubory ----------
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------- Public routy ----------
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.use("/t", trackingRouter);
app.use("/lp", publicLandingRouter);

// rate-limit pro auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 požadavků / 15 min / IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth", authLimiter, authRouter);

// ---------- Protected API (rate-limit + auth) ----------
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600, // 600 požadavků / 15 min / IP (jen pro přihlášené)
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", requireAuth, apiLimiter);

app.use("/api/templates", templatesRouter);
app.use("/api/assets", assetsRouter);
app.use("/api", senderDomainsRouter);
app.use("/api", senderIdentitiesRouter);
app.use("/api", campaignsRouter);
app.use("/api", campaignReportsRouter);
app.use("/api/debug", debugRouter);
app.use("/api", recipientsRouter);
app.use("/api/landing-pages", landingPagesRouter);

// ---------- Error handler ----------
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ---------- Start serveru ----------
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
