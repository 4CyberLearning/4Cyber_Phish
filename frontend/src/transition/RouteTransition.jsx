// src/transition/RouteTransition.jsx
import { createContext, useContext, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const RouteTransitionCtx = createContext({
  isExiting: false,
  start: (_to, _opts) => {},
});

export function useRouteTransition() {
  return useContext(RouteTransitionCtx);
}

/**
 * Provider drží stav "isExiting" a poskytuje funkci start(to),
 * která spustí fade-out. Po dokončení animace zavolá navigate(to).
 */
export function RouteTransitionProvider({ children }) {
  const [isExiting, setIsExiting] = useState(false);
  const [nextTo, setNextTo] = useState(null);
  const navigate = useNavigate();

  const start = useCallback((to, { replace = false } = {}) => {
    // už běží animace? ignoruj další kliky
    if (isExiting) return;
    setNextTo({ to, replace });
    setIsExiting(true);
  }, [isExiting]);

  // Tohle zavolej z onAnimationComplete(exit)
  const completeExit = useCallback(() => {
    if (nextTo) {
      const { to, replace } = nextTo;
      navigate(to, { replace });
    }
    // připrav se na další vstup
    setIsExiting(false);
    setNextTo(null);
  }, [nextTo, navigate]);

  return (
    <RouteTransitionCtx.Provider value={{ isExiting, start, completeExit }}>
      {children}
    </RouteTransitionCtx.Provider>
  );
}
