import { useState } from "react"
import { apiUrl } from "../../api/base";

export default function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")

    const r = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    })

    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      return setError(j?.error || "Login failed")
    }

    window.location.href = "/dashboard"
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 p-8 rounded w-96 space-y-4">
        <h2 className="text-xl font-semibold text-center">Sign in</h2>

        {/* type="text" = žádná email validace, takže projde i "admin" */}
        <input
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 border rounded"
          placeholder="admin"
          autoComplete="username"
          required
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 border rounded"
          placeholder="Password"
          autoComplete="current-password"
          required
        />

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <button className="w-full bg-blue-600 text-white py-2 rounded">Continue</button>
      </form>
    </div>
  )
}
