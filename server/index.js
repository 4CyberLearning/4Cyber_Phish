// server/index.js
import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";

import templatesRouter from "./routes/templates.js";
import assetsRouter from "./routes/assets.js";
import campaignsRouter from "./routes/campaigns.js";
import authRouter from "./routes/auth.js";
import debugRouter from "./routes/debug.js";

const app = express();

const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN || "http://localhost:5173";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS pro FE (Vite dev na 5173)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// session pro auth / kampaně / debug
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: "lax",
      secure: false, // pro lokální HTTP
    },
  })
);

// statické servírování nahraných souborů (obrázky v šablonách)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ROUTES ------------------------------------------------------

// login/logout/me → /api/auth/...
app.use("/api", authRouter);

// CRUD e-mailových šablon – BEZ loginu (tenant = demo)
app.use("/api/templates", templatesRouter);

// assets → /api/assets, /api/assets/upload
app.use("/api/assets", assetsRouter);

// kampaně – session guard je přímo v campaignsRouteru
app.use("/api", campaignsRouter);

// debug utilitky přesunuty pod /api/debug/...
app.use("/api/debug", debugRouter);

// jednoduchý health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// fallback error handler (log + 500)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
