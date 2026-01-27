import { Router } from "express"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()
const router = Router()

// POZOR: mountuješ to jako app.use("/api/auth", authRouter)
// takže tady musí být jen "/login", ne "/auth/login"
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: "Email and password required" })

  const tenant = await prisma.tenant.findUnique({ where: { slug: "demo" } })
  if (!tenant) return res.status(500).json({ error: "Tenant not found" })

  const user = await prisma.user.findFirst({ where: { email, tenantId: tenant.id } })
  if (!user) return res.status(401).json({ error: "Invalid credentials" })
  if (!user.isAdmin) return res.status(403).json({ error: "Forbidden" })
  if (!user.passwordHash) return res.status(401).json({ error: "Invalid credentials" })

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: "Invalid credentials" })

  req.session.userId = user.id
  req.session.tenantId = tenant.id

  return res.json({
    user: { id: user.id, email: user.email, fullName: user.fullName, isAdmin: user.isAdmin },
  })
})

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }))
})

router.get("/me", async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: "Not logged in" });
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
  res.json({ user });
});

export default router
