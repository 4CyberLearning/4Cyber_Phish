import { Router } from "express"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()
const router = Router()

// POZOR: mountuješ to jako app.use("/api/auth", authRouter)
// takže tady musí být jen "/login", ne "/auth/login"
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {}
  const isDev = process.env.NODE_ENV !== "production"

  if (!email || !password) {
    if (isDev) console.log("LOGIN FAIL: missing email/password", { email, hasPassword: !!password })
    return res.status(400).json({ error: "Email and password required" })
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: "demo" } })
  if (!tenant) {
    console.error("LOGIN FAIL: tenant 'demo' not found")
    return res.status(500).json({ error: "Tenant not found" })
  }

  const user = await prisma.user.findFirst({ where: { email, tenantId: tenant.id } })
  if (!user) {
    if (isDev) console.log("LOGIN FAIL: user not found", { email, tenantId: tenant.id })
    return res.status(401).json({ error: isDev ? "User not found" : "Invalid credentials" })
  }

  if (!user.isAdmin) {
    if (isDev) console.log("LOGIN FAIL: user not admin", { userId: user.id, email: user.email })
    return res.status(403).json({ error: isDev ? "User is not admin" : "Forbidden" })
  }

  if (!user.passwordHash) {
    if (isDev) console.log("LOGIN FAIL: missing passwordHash", { userId: user.id, email: user.email })
    return res.status(401).json({ error: isDev ? "No password set" : "Invalid credentials" })
  }

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    if (isDev) console.log("LOGIN FAIL: wrong password", { userId: user.id, email: user.email })
    return res.status(401).json({ error: isDev ? "Wrong password" : "Invalid credentials" })
  }

  req.session.userId = user.id
  req.session.tenantId = tenant.id

  if (isDev) console.log("LOGIN OK", { userId: user.id, email: user.email })

  return res.json({
    user: { id: user.id, email: user.email, fullName: user.fullName, isAdmin: user.isAdmin },
  })
})

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }))
})

router.get("/me", async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: "Not logged in" });
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { id: true, email: true, fullName: true, isAdmin: true },
  });
  res.json({ user });
});

export default router
