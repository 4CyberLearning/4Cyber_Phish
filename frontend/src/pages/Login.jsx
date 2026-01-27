import { useLocation } from "react-router-dom";
import LoginForm from "../components/Auth/LoginForm";

export default function LoginPage({ onLoggedIn }) {
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || "/dashboard";

  return <LoginForm onLoggedIn={onLoggedIn} redirectTo={redirectTo} />;
}
