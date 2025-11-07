import { useEffect, useState } from "react"

export default function Campaigns(){
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ name:"", emailTemplateId:"", landingPageId:"", scheduledAt:"" })
  const [templates, setTemplates] = useState([])
  const [pages, setPages] = useState([])

  useEffect(()=>{
    fetch("/api/campaigns", { credentials:"include" })
      .then(r=>r.json()).then(setRows)

    // pro jednoduchost načteme seznam templátů/LP přes dočasný endpoint
    Promise.all([
      fetch("/api/debug/templates", { credentials:"include" }).then(r=>r.json()),
      fetch("/api/debug/landing-pages", { credentials:"include" }).then(r=>r.json())
    ]).then(([t, p])=>{ setTemplates(t); setPages(p) })
  },[])

  async function create(){
    const r = await fetch("/api/campaigns",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      credentials:"include",
      body:JSON.stringify({
        name: form.name,
        emailTemplateId: Number(form.emailTemplateId),
        landingPageId: Number(form.landingPageId),
        scheduledAt: form.scheduledAt || null,
        userIds: [] // zatím prázdné
      })
    })
    if (r.ok) {
      const created = await r.json()
      setRows(prev=>[created, ...prev])
      setForm({ name:"", emailTemplateId:"", landingPageId:"", scheduledAt:"" })
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded p-4">
        <h3 className="font-semibold mb-3">Create campaign</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Name"
                 value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
          <input className="border rounded px-3 py-2" type="datetime-local"
                 value={form.scheduledAt} onChange={e=>setForm({...form, scheduledAt:e.target.value})}/>
          <select className="border rounded px-3 py-2"
                  value={form.emailTemplateId} onChange={e=>setForm({...form, emailTemplateId:e.target.value})}>
            <option value="">– template –</option>
            {templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="border rounded px-3 py-2"
                  value={form.landingPageId} onChange={e=>setForm({...form, landingPageId:e.target.value})}>
            <option value="">– landing page –</option>
            {pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button onClick={create} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">Create</button>
      </div>

      <div className="bg-white border rounded">
        <table className="w-full text-sm">
          <thead><tr className="border-b">
            <th className="text-left p-3">Name</th>
            <th className="text-left p-3">Scheduled</th>
            <th className="text-left p-3">Template</th>
            <th className="text-left p-3">LP</th>
          </tr></thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id} className="border-b">
                <td className="p-3">{r.name}</td>
                <td className="p-3">{new Date(r.scheduledAt).toLocaleString()}</td>
                <td className="p-3">{r.emailTemplate?.name}</td>
                <td className="p-3">{r.landingPage?.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
