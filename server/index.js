import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import authRoutes from "./routes/auth.js";
import campaignRoutes from "./routes/campaigns.js";
import templatesRoutes from "./routes/templates.js";
import assetsRoutes from "./routes/assets.js";

dotenv.config();

const app = express();
const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// statické soubory (obrázky)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api", authRoutes);
app.use("/api", campaignRoutes);
app.use("/api/templates", templatesRoutes);
app.use("/api/assets", assetsRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(process.env.PORT || 5000, () =>
  console.log("✅ Backend running at http://localhost:5000")
);
