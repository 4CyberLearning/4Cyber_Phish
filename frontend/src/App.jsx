import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import AppLayout from "./components/Layout/AppLayout";
import LoginPage from "./pages/Login";

import Dashboard from "./pages/Dashboard";
import ContentPage from "./pages/Content";
import Campaigns from "./pages/Campaigns";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Playbook from "./pages/Playbook";
import EmailTemplatesPage from "./pages/Content/EmailTemplates";
import LandingPagesPage from "./pages/Content/LandingPages";
import SenderIdentitiesPage from "./pages/Content/SenderIdentities";
import CampaignCreate from "./pages/CampaignCreate";
import CampaignDetail from "./pages/CampaignDetail";
import CampaignPreflight from "./pages/CampaignPreflight";
import CampaignLaunch from "./pages/CampaignLaunch";
import AssetsPage from "./pages/Content/Assets";
import { apiUrl } from "./api/base";
import { RouteTransitionProvider } from "./transition/RouteTransition";
import ReportsOverviewPage from "./pages/Reports/Overview";
import CampaignSchedule from "./pages/CampaignSchedule";

export default function App() {
  // undefined = loading, null = not logged, object = logged
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const r = await fetch(apiUrl("/api/auth/me"), { credentials: "include" });
        if (!alive) return;

        if (!r.ok) {
          setUser(null);
          return;
        }

        const data = await r.json().catch(() => null);
        setUser(data?.user ?? null);
      } catch {
        if (alive) setUser(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Login route */}
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <LoginPage onLoggedIn={setUser} />}
        />

        {/* Protected app */}
        <Route element={<RequireAuth user={user}><RouteTransitionProvider><AppLayout /></RouteTransitionProvider></RequireAuth>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/content" element={<ContentPage />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/new" element={<CampaignCreate />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/users" element={<Users />} />
          <Route path="/campaigns/:id/launch" element={<CampaignLaunch />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/playbook" element={<Playbook />} />
          <Route path="/campaigns/:id/preflight" element={<CampaignPreflight />} />
          <Route path="/content/email-templates" element={<EmailTemplatesPage />} />
          <Route path="/content/landing-pages" element={<LandingPagesPage />} />
          <Route path="/content/sender-identities" element={<SenderIdentitiesPage />} />
          <Route path="/content/assets" element={<AssetsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
          <Route path="/reports" element={<Navigate to="/reports/overview" replace />} />
          <Route path="/reports/overview" element={<ReportsOverviewPage />} />
          <Route path="/campaigns/:id/schedule" element={<CampaignSchedule />} />
        </Route>

        {/* Default: pokud nejsem přihlášen a dám jinou URL než /login */}
        {!user && <Route path="*" element={<Navigate to="/login" replace />} />}
      </Routes>
    </BrowserRouter>
  );
}

function RequireAuth({ user, children }) {
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}
