// server/routes/assets.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../db/prisma.js";

const router = express.Router();

// stejný default tenant jako jinde (templates, landing pages)
const DEFAULT_TENANT_SLUG = "demo";

async function getTenantId() {
  let tenant = await prisma.tenant.findUnique({
    where: { slug: DEFAULT_TENANT_SLUG },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        slug: DEFAULT_TENANT_SLUG,
        name: "Demo tenant",
      },
    });
  }

  return tenant.id;
}

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

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    // jen obrázky
    if (!file.mimetype?.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
    }
    cb(null, true);
  },
});

// GET /api/assets
router.get("/", async (_req, res) => {
  try {
    const tenantId = await getTenantId();
    const assets = await prisma.asset.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    res.json(assets);
  } catch (err) {
    console.error("GET /api/assets error", err);
    res.status(500).json({ error: "Failed to load assets" });
  }
});

// POST /api/assets
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const tenantId = await getTenantId();

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Absolutní base URL je nutná pro e-maily.
    // 1) preferuj env PUBLIC_BASE_URL (produkce)
    // 2) fallback z requestu (dev / test)
    const baseUrlRaw =
      (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`) ??
      "";
    const baseUrl = String(baseUrlRaw).replace(/\/$/, "");

    const publicUrl = `${baseUrl}/uploads/${req.file.filename}`;

    const asset = await prisma.asset.create({
      data: {
        tenantId,
        fileName: req.file.originalname,
        url: publicUrl,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });

    res.status(201).json(asset);
  } catch (err) {
    console.error("POST /api/assets error", err);
    res.status(500).json({ error: err?.message || "Failed to upload asset" });
  }
});

// DELETE /api/assets/:id
router.delete("/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const asset = await prisma.asset.findFirst({
      where: { id, tenantId },
    });
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }

    // vezmeme jen basename (ochrana proti traversal)
    const storedName = path.basename(String(asset.url).split("/").pop() || "");
    if (storedName) {
      const absPath = path.join(uploadDir, storedName);
      try {
        if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
      } catch (e) {
        // nemaž to celé kvůli tomu – jen logni
        console.warn("Failed to remove file from uploads:", e?.message || e);
      }
    }

    await prisma.asset.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/assets/:id error", err);
    res.status(500).json({ error: "Failed to delete asset" });
  }
});

export default router;
