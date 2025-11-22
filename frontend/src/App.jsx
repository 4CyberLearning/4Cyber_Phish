import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/Layout/AppLayout";
import LoginForm from "./components/Auth/LoginForm";

import Dashboard from "./pages/Dashboard";
import ContentPage from "./pages/Content";
import Campaigns from "./pages/Campaigns";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Playbook from "./pages/Playbook";
import EmailTemplatesPage from "./pages/Content/EmailTemplates";


export default function App() {
  const isAuthenticated = true; // zatím natvrdo

  return (
    <BrowserRouter>
      {isAuthenticated ? (
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/content" element={<ContentPage />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/users" element={<Users />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
            <Route path="/playbook" element={<Playbook />} />
            <Route path="/content/email-templates" element={<EmailTemplatesPage />} />
          </Route>
        </Routes>
      ) : (
        <Routes>
          <Route path="/*" element={<LoginForm />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
