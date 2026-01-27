// server/routes/assets.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../db/prisma.js";

const router = express.Router();

// DEV: jeden tenant napevno (id = 1)
const TENANT_ID = 1;

// připravíme adresář /uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path
      .basename(file.originalname, ext)
      .replace(/\s+/g, "-")
      .toLowerCase();
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${base}-${unique}${ext}`);
  },
});

const upload = multer({ storage });

// GET /api/assets
router.get("/", async (_req, res) => {
  try {
    const assets = await prisma.asset.findMany({
      where: { tenantId: TENANT_ID },
      orderBy: { createdAt: "desc" },
    });
    res.json(assets);
  } catch (err) {
    console.error("GET /api/assets error", err);
    res.status(500).json({ error: "Failed to load assets" });
  }
});

// POST /api/assets/upload
router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const baseUrl = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
    const publicUrl = `${baseUrl}/uploads/${req.file.filename}`;

    const asset = await prisma.asset.create({
      data: {
        tenantId: TENANT_ID,
        fileName: req.file.originalname,
        url: publicUrl,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });

    res.status(201).json(asset);
  } catch (err) {
    console.error("POST /api/assets/upload error", err);
    res.status(500).json({ error: "Failed to upload asset" });
  }
});

export default router;
