import { useState } from "react"

export default function LoginForm() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(e){
    e.preventDefault()
    setError("")
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email })
    })
    if (!r.ok) return setError("Login failed")
    window.location.href = "/dashboard"
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 p-8 rounded w-96 space-y-4">
        <h2 className="text-xl font-semibold text-center">Sign in</h2>
        <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)}
               className="w-full px-4 py-2 border rounded" placeholder="admin@demo.local" />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className="w-full bg-blue-600 text-white py-2 rounded">Continue</button>
      </form>
    </div>
  )
}
