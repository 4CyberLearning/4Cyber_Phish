import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { nav } from "../../navigation";
import { MonoIcon } from "../MonoIcon";
import { useRouteTransition } from "../../transition/RouteTransition";
import { useTheme } from "../../theme";
import logo from "../../assets/4Cyber_phish_logo.png";

// === NAV VISIBILITY (feature toggles) ===
// false = skrýt, true/undefined = zobrazit
const NAV_VISIBILITY = {
  "nav.dashboard": false,
  "nav.playbook.title": true,

  "nav.content.title": true,
  "nav.content.emailTemplates": true,
  "nav.content.landingPages": true,
  "nav.content.senderIdentities": true,
  "nav.content.assets": true,

  "nav.campaign.title": true,
  "nav.campaign.list": true,
  "nav.campaign.new": true,
  "nav.campaign.aftercare": false,

  "nav.recipients.title": true,
  "nav.recipients.upload": true,
  "nav.recipients.groups": false,
  "nav.recipients.rules": false,

  "nav.reports.title": true,
  "nav.reports.overview": true,
  "nav.reports.delivery": false,
  "nav.reports.security": false,
  "nav.reports.audit": false,

  "nav.automation.title": false,
  "nav.automation.rules": false,
  "nav.automation.tasks": false,

  "nav.settings.title": true,
  "nav.settings.general": true,
  "nav.settings.mail": false,
  "nav.settings.api": false,
  "nav.settings.users": false,
};

function isNavVisible(key) {
  return NAV_VISIBILITY[key] !== false;
}

function buildVisibleNav(items) {
  return (items || [])
    .filter((node) => isNavVisible(node.key))
    .map((node) => {
      if (!node.children?.length) return node;
      const children = node.children.filter((c) => isNavVisible(c.key));
      return { ...node, children };
    })
    .filter((node) => !node.children || node.children.length > 0);
}

const UI = {
  icon: "h-7 w-7",
  headTxt: "text-[14px] font-semibold",
  leafTxt: "text-[13px] leading-[18px] font-medium",
  headPad: "px-3 py-2",
  leafPad: "px-3 py-1.5",
  groupBottomGap: "mb-5",

  leafBlockTop: "pt-[2px]",
  leafBlockBottom: "pb-2",
  groupBottomGap: "mb-4",
  leafGap: "space-y-[1px]",
  indent: "pl-8",

  headIdle: "text-slate-800 dark:text-slate-200",
  groupActive:
    "text-slate-900 dark:text-slate-100",
  leafActive:
    "bg-[var(--glass-bg-strong)] dark:bg-white/12 text-slate-900 dark:text-slate-100 border border-white/70 dark:border-white/10 shadow-soft ring-1 ring-[var(--brand-soft-dark)]",
  hoverPill: "hover:bg-white/50 dark:hover:bg-white/10",
  leafIdle:
    "text-slate-700 dark:text-slate-200 hover:bg-white/45 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-slate-100",
  groupHint:
    "bg-[var(--brand-soft)]/60 text-[var(--brand-strong)] ring-1 ring-[var(--brand-soft-dark)]",
  gridCols: "grid grid-cols-[1fr_20px] items-center",
};

const normPath = (p) => {
  if (!p) return "/";
  if (p === "/") return "/";
  return p.replace(/\/+$/, "");
};

const isExactActive = (pathname, to) => normPath(pathname) === normPath(to);

function getNavLabel(t, key) {
  const value = t(key, { defaultValue: key, returnObjects: false });
  return typeof value === "string" ? value : key;
}

function TransitionNavLink({ to, replace, onNavigate, onClick, ...props }) {
  const { start } = useRouteTransition();

  return (
    <NavLink
      to={to}
      replace={replace}
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (e.button !== 0) return;
        if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return;
        if (!to || to === "#") {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        start(to, { replace: !!replace });
        onNavigate?.();
      }}
    />
  );
}

function Leaf({ to, label, onNavigate, end = false }) {
  return (
    <TransitionNavLink
      to={to}
      end={end}
      onNavigate={onNavigate}
      className={({ isActive }) =>
        [
          "block w-full rounded-md transition-colors border border-transparent",
          UI.leafPad,
          UI.leafTxt,
          isActive ? UI.leafActive : UI.leafIdle,
        ].join(" ")
      }
    >
      <span className="truncate">{label}</span>
    </TransitionNavLink>
  );
}

function PrimaryLink({ node, t, onNavigate }) {
  const to = node.to || node.overview || "/";
  return (
    <div className={UI.gridCols}>
      <TransitionNavLink
        to={to}
        onNavigate={onNavigate}
        className={({ isActive }) =>
          [
            "relative block w-full rounded-xl transition-colors border",
            "flex items-center gap-2",
            UI.headPad,
            UI.headTxt,
            isActive
              ? UI.leafActive
              : ["border-transparent", UI.headIdle, UI.hoverPill].join(" "),
          ].join(" ")
        }
      >
        {node.iconName && (
          <MonoIcon name={node.iconName} className={UI.icon} />
        )}
        <span className="truncate">{getNavLabel(t, node.key)}</span>
      </TransitionNavLink>
      <span />
    </div>
  );
}

function Group({ node, t, currentPath, onNavigate }) {
  const groupActive = useMemo(() => {
    const self =
      node.overview &&
      (currentPath === node.overview || currentPath.startsWith(node.overview + "/"));
    const child = (node.children || []).some(
      (c) => currentPath === c.to || currentPath.startsWith((c.to || "") + "/")
    );
    return !!(self || child);
  }, [currentPath, node]);

  const [open, setOpen] = useState(groupActive);
  useEffect(() => {
    if (groupActive) setOpen(true);
  }, [groupActive]);

  const variants = {
    collapsed: { opacity: 0, height: 0, y: -4, transition: { duration: 0.22, ease: "easeOut" } },
    expanded: { opacity: 1, height: "auto", y: 0, transition: { duration: 0.22, ease: "easeOut" } },
  };

  return (
    <div className={["space-y-0.5", UI.groupBottomGap].join(" ")}>
      <div className={UI.gridCols}>
        <TransitionNavLink
          to={node.overview || "#"}
          onNavigate={onNavigate}
          onClick={() => setOpen(true)}
          className={({ isActive }) =>
            [
              "relative block w-full rounded-xl transition-colors border",
              "flex items-center justify-between gap-2",
              UI.headPad,
              UI.headTxt,
              groupActive || isActive
                ? ["border-transparent", UI.groupActive].join(" ")
                : ["border-transparent", UI.headIdle, UI.hoverPill].join(" "),
            ].join(" ")
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            {node.iconName && (
              <MonoIcon name={node.iconName} className={UI.icon} />
            )}
            <span className="truncate">{getNavLabel(t, node.key)}</span>
          </span>
        </TransitionNavLink>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="justify-self-center rounded-lg p-1 hover:bg-white/45 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"
          aria-label={open ? "Sbalit" : "Rozbalit"}
        >
          <svg className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} viewBox="0 0 20 20" fill="currentColor">
            <path d="M7 5l6 5-6 5V5z" />
          </svg>
        </button>
      </div>

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
              <Leaf
                key={c.to}
                to={c.to}
                end={!!node.overview && c.to === node.overview}
                label={getNavLabel(t, c.key)}
                onNavigate={onNavigate}
              />
            ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Sidebar({ variant = "desktop", onNavigate }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  const visibleNav = useMemo(() => buildVisibleNav(nav), []);

  const base =
    variant === "mobile"
      ? "flex w-full h-full"
      : "hidden md:flex w-64";

  return (
      <aside
        className={[
          base,
          "shrink-0 flex-col",
          // desktop: transparent (barvu dělá app-chrome wrapper)
          variant === "mobile" ? "glass-panel-strong" : "bg-transparent",
        ].join(" ")}
      >
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center justify-center">
          <img
            src={logo}
            alt="4Cyber"
            className="h-40 w-40 drop-shadow-sm"
            draggable={false}
          />
        </div>

        <div className="mt-4 h-px w-full bg-white/50 dark:bg-white/10" />
      </div>

      <nav className="flex-1 px-2 space-y-2">
        {visibleNav.map((node) =>
          node.children?.length ? (
            <Group
              key={node.key}
              node={node}
              t={t}
              currentPath={location.pathname}
              onNavigate={onNavigate}
            />
          ) : (
            <PrimaryLink key={node.key} node={node} t={t} onNavigate={onNavigate} />
          )
        )}
      </nav>

      <div className="px-4 py-3 border-t border-white/55 dark:border-white/10">
        <button
          type="button"
          onClick={toggleTheme}
          className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-[12px]
                     border border-white/55 dark:border-white/10
                     bg-white/35 hover:bg-white/55 dark:bg-white/5 dark:hover:bg-white/10"
        >
          <span className="text-slate-700 dark:text-slate-200">Režim</span>
          <span className="text-slate-500 dark:text-slate-400">{isDark ? "Tmavý" : "Světlý"}</span>
        </button>

        <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500 select-none">
          v0.1 • dev
        </div>
      </div>
    </aside>
  );
}
