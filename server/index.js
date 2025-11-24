// server/index.js
import express from "express";
import session from "express-session";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import authRouter from "./routes/auth.js";
import templatesRouter from "./routes/templates.js";
import assetsRouter from "./routes/assets.js";
import campaignsRouter from "./routes/campaigns.js";
import debugRouter from "./routes/debug.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// ---------- CORS (pro vývoj klidně úplně otevřené) ----------
app.use(
  cors({
    origin(origin, cb) {
      // povolíme vše – v produkci si to můžeš zpřísnit
      cb(null, true);
    },
    credentials: true,
  })
);

// ---------- Parsování požadavků ----------
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ---------- Session ----------
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

// ---------- Statické soubory ----------
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------- Routy ----------
app.use(authRouter); // /auth/...
app.use("/api/templates", templatesRouter);
app.use("/api/assets", assetsRouter);
app.use("/api", campaignsRouter);   // /api/campaigns...
app.use("/api/debug", debugRouter); // /api/debug/...

// jednoduchý healthcheck – můžeš si ho otevřít v prohlížeči
app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

// ---------- Error handler ----------
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ---------- Start serveru ----------
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
