import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useRouteTransition } from "../../transition/RouteTransition";

const page = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.5, ease: "easeIn" } },
};

const WIDTH_BY_PATH = [
  { test: (p) => p.startsWith("/playbook"), w: "980px" },

  { test: (p) => p.startsWith("/content/landing-pages"), w: "1500px" },
  { test: (p) => p.startsWith("/content/email-templates"), w: "1500px" },
  { test: (p) => p.startsWith("/content/sender-identities"), w: "1400px" },
  { test: (p) => p.startsWith("/content/assets"), w: "1200px" },

  { test: (p) => p.startsWith("/campaigns/new"), w: "1100px" },
  { test: (p) => p.startsWith("/campaigns/"), w: "1400px" }, // detail
  { test: (p) => p.startsWith("/campaigns"), w: "1400px" },  // list

  { test: (p) => p.startsWith("/users"), w: "1300px" },

  { test: () => true, w: "1200px" },
];

export default function AppLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isExiting, completeExit } = useRouteTransition();

  useEffect(() => {
    const path = location.pathname || "/";
    const hit = WIDTH_BY_PATH.find((x) => x.test(path));
    document.documentElement.style.setProperty("--content-max", hit?.w || "1200px");
  }, [location.pathname]);

  return (
    <div className="min-h-screen p-3 md:p-6">
      <div className="mx-auto flex max-w-[1536px] min-h-[calc(100vh-24px)] md:min-h-[calc(100vh-48px)] overflow-hidden rounded-4xl app-chrome">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenSidebar={() => setMobileOpen(true)} />

          <div className="flex-1 min-h-0 p-4 md:p-6">
            <div className="content-wrap h-full">
              <div className="h-full overflow-y-auto rounded-3xl p-5 md:p-7 shadow-soft bg-white/[0.95] border border-slate-200/70 dark:bg-slate-900/[0.90] dark:border-white/10">
                <motion.div
                  key={location.pathname}
                  variants={page}
                  initial="initial"
                  animate={isExiting ? "exit" : "animate"}
                  className="will-change-[opacity,transform]"
                  onAnimationComplete={() => {
                    if (isExiting) completeExit();
                  }}
                >
                  <Outlet />
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-slate-900/20"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="absolute left-0 top-0 h-full w-[290px]"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "tween", duration: 0.22 }}
            >
              <Sidebar variant="mobile" onNavigate={() => setMobileOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
