import { useState } from "react";
import { apiUrl } from "../api/base";

export default function Dashboard(){
  const [result, setResult] = useState("");

  async function sendTest(){
    const r = await fetch(apiUrl("/api/debug/send-test"), {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      credentials: "include",
      body: JSON.stringify({ to: "dev@local" })
    });
    const data = await r.json();
    setResult(r.ok ? `OK: ${data.messageId}` : `ERR: ${data.error}`);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Dashboard</h2>
      <button onClick={sendTest} className="bg-blue-600 text-white px-4 py-2 rounded">
        Send test email (MailHog)
      </button>
      {result && <div className="text-sm text-gray-600">{result}</div>}
      <div className="text-sm">
        MailHog UI: <a className="text-blue-600 underline" href="http://localhost:8025" target="_blank">http://localhost:8025</a>
      </div>
    </div>
  );
}
