import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { nav } from "../../navigation";
import { MonoIcon } from "../MonoIcon";

/* ---- Jednotné UI (jemné doladění vyřešíš tady) ---- */
const UI = {
  // velikosti
  icon: "h-6 w-6",
  headTxt: "text-[14px] font-semibold",
  leafTxt: "text-[12px] leading-[16px]",
  headPad: "px-2.5 py-1.5",
  leafPad: "px-2.5 py-1",

  // spacing
  leafBlockTop: "pt-[2px]",     // 1. položka blíž k nadpisu
  leafBlockBottom: "pb-2",      // mezera po poslední položce
  groupBottomGap: "mb-4",       // mezera pod celou skupinou
  leafGap: "space-y-[1px]",     // svislý rozestup mezi leavy
  indent: "pl-6",               // odsazení podmenu

  // vzhled
  headIdle: "text-[var(--brand-strong)]", // hlavní nadpisy = tmavší cyan
  activeFill: "bg-[var(--brand-soft-dark)] text-[var(--brand-strong)]",
  hoverPill: "hover:bg-[var(--brand-soft)]",
  leafIdle: "text-gray-700 hover:bg-gray-50 hover:text-gray-900",

  // POZOR: musí být statická hodnota, ne proměnná!
  gridCols: "grid grid-cols-[1fr_20px] items-center", // text | šipka
};

/* ---------- Leaf (podpoložka) ---------- */
function Leaf({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "block w-full rounded-md transition-colors",
          UI.leafPad,
          UI.leafTxt,
          isActive ? UI.activeFill : UI.leafIdle,
        ].join(" ")
      }
    >
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

/* ---------- Single řádek (Dashboard / Návod) ---------- */
function PrimaryLink({ node, t }) {
  const to = node.to || node.overview || "/";
  return (
    <div className={UI.gridCols}>
      <NavLink
        to={to}
        className={({ isActive }) =>
          [
            "block w-full rounded-md transition-colors",
            "flex items-center gap-2",
            UI.headPad,
            UI.headTxt,
            isActive ? UI.activeFill : [UI.headIdle, UI.hoverPill].join(" "),
          ].join(" ")
        }
      >
        {node.iconName && (
          <MonoIcon
            name={node.iconName}
            className={UI.icon}
            color="var(--brand-strong)"
          />
        )}
        <span className="truncate">{t(node.key, { defaultValue: node.key })}</span>
      </NavLink>
      {/* prázdná buňka pro srovnání se sloupcem šipek */}
      <span />
    </div>
  );
}

/* ---------- Skupina s podmenu ---------- */
function Group({ node, t, currentPath }) {
  const groupActive = useMemo(() => {
    const self = node.overview &&
      (currentPath === node.overview || currentPath.startsWith(node.overview + "/"));
    const child = (node.children || []).some(
      (c) => currentPath === c.to || currentPath.startsWith((c.to || "") + "/")
    );
    return !!(self || child);
  }, [currentPath, node]);

  const [open, setOpen] = useState(groupActive);
  useEffect(() => { if (groupActive) setOpen(true); }, [groupActive]);

  const variants = {
    collapsed: { opacity: 0, height: 0, y: -4, transition: { duration: 0.25, ease: "easeOut" } },
    expanded:  { opacity: 1, height: "auto", y: 0,  transition: { duration: 0.25, ease: "easeOut" } },
  };

  return (
    <div className={["space-y-0.5", UI.groupBottomGap].join(" ")}>
      {/* Řádek nadpisu: (text | šipka) v jedné mřížce → šipky vždy zarovnané */}
      <div className={UI.gridCols}>
        <NavLink
          to={node.overview || "#"}
          onClick={() => setOpen(true)}
          className={({ isActive }) =>
            [
              "block w-full rounded-md transition-colors",
              "flex items-center gap-2",
              UI.headPad,
              UI.headTxt,
              (groupActive || isActive) ? UI.activeFill : [UI.headIdle, UI.hoverPill].join(" "),
            ].join(" ")
          }
        >
          {node.iconName && (
            <MonoIcon
              name={node.iconName}
              className={UI.icon}
              color="var(--brand-strong)"
            />
          )}
          <span className="truncate">{t(node.key, { defaultValue: node.key })}</span>
        </NavLink>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="justify-self-center rounded p-1 hover:bg-gray-50"
          aria-label={open ? "Sbalit" : "Rozbalit"}
        >
          <svg
            className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`}
            viewBox="0 0 20 20" fill="currentColor"
          >
            <path d="M7 5l6 5-6 5V5z" />
          </svg>
        </button>
      </div>

      {/* Podmenu (full width, kompaktní) */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key={`${node.key}-submenu`}
            variants={variants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className={[UI.indent, UI.leafBlockTop, UI.leafBlockBottom].join(" ")}
          >
            <div className={UI.leafGap}>
              {(node.children || []).map((c) => (
                <Leaf key={c.to} to={c.to} label={t(c.key, { defaultValue: c.key })} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Sidebar wrapper ---------- */
export default function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <aside className="
      hidden md:flex w-60 shrink-0 flex-col
      bg-white shadow-right-soft z-20
      md:sticky md:top-0 md:h-screen md:overflow-y-auto md:self-start
    ">
      <div className="px-5 py-3">
        <div className="text-lg font-semibold tracking-tight text-gray-900">4Cyber Phish</div>
      </div>

      <nav className="flex-1 px-2 space-y-1">
        {nav.map((node) =>
          node.children?.length
            ? <Group key={node.key} node={node} t={t} currentPath={location.pathname} />
            : <PrimaryLink key={node.key} node={node} t={t} />
        )}
      </nav>

      <div className="px-5 py-3 text-[12px] text-gray-400 select-none">v0.1 • dev</div>
    </aside>
  );
}
