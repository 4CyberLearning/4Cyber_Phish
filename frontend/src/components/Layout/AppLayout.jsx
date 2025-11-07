import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "./Sidebar";

const page = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.3, ease: "easeIn" } },
};

export default function AppLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 bg-gray-50 p-6 md:p-8">
        {/* DŮLEŽITÉ: počkej na exit před mountem nové stránky */}
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}                 // přepíná animaci dle cesty
            variants={page}
            initial="initial"
            animate="animate"
            exit="exit"
            className="will-change-[opacity,transform]"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
