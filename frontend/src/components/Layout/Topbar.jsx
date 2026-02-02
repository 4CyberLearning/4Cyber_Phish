import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getCampaign, listCampaigns } from "../../api/campaigns";
import { useRouteTransition } from "../../transition/RouteTransition";

// 1) Email
// 2) Landing page
// 3) Odesílatel
// 4) Příjemci (před kontrolou)
// 5) Příprava
// 6) Kontrola
// 7) Spuštění
const STEPS = [
  { key: "email", label: "Email", to: () => "/content/email-templates" },
  { key: "landing", label: "Landing page", to: () => "/content/landing-pages" },
  { key: "sender", label: "Odesílatel", to: () => "/content/sender-identities" },
  {
    key: "targets",
    label: (
      <>
        <span>Příjemci</span>
        <span className="block">(před kontrolou)</span>
      </>
    ),
    title: "Příjemci (před kontrolou)",
    to: () => "/users",
  },
  { key: "preflight", label: "Příprava", to: (id) => (id ? `/campaigns/${id}/preflight` : "/campaigns") },
  { key: "review", label: "Kontrola", to: (id) => (id ? `/campaigns/${id}` : "/campaigns") },
  { key: "launch", label: "Spuštění", to: (id) => (id ? `/campaigns/${id}/launch` : "/campaigns") },
];

const SELECTED_CAMPAIGN_KEY = "campaign.selected.v1";
const LOCK_KEY = "campaign.locked.v1";
const PROGRESS_KEY = "campaign.progress.v3";

const PREFLIGHT_KEY = "campaign.preflight.v1";

const CAMPAIGN_SELECTED_EVENT = "campaign:selected";
const CAMPAIGN_UPDATED_EVENT = "campaign:updated";
const CAMPAIGN_CHANGED_EVENT = "campaign:changed";
const FALLBACK_ID = "__no_campaign__";
const NONE_ID = "__none__";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function ensureBucket(progressById, id) {
  if (progressById[id]) return progressById;
  return { ...progressById, [id]: { currentStep: "email", completed: {} } };
}

function recipientsCount(c) {
  if (!c) return 0;
  if (Array.isArray(c.targetUsers) && c.targetUsers.length) return c.targetUsers.length;
  if (typeof c.recipientCount === "number") return c.recipientCount;
  if (typeof c.userCount === "number") return c.userCount;
  if (typeof c.targetsCount === "number") return c.targetsCount;
  return 0;
}

function readPreflightDone(campaignId) {
  if (!campaignId) return false;
  const all = readJson(PREFLIGHT_KEY, {});
  return !!all[String(campaignId)]?.done;
}

function CampaignDropdown({ value, locked, loading, campaigns, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQ("");
    }
  }, [open]);

  const disabled = loading || locked;

  const label = useMemo(() => {
    if (!value || value === NONE_ID) return "Žádná kampaň";
    const found = campaigns.find((c) => String(c.id) === String(value));
    if (found) return found.name || `Kampaň #${found.id}`;
    return loading ? "Načítám…" : "Vyber kampaň";
  }, [value, campaigns, loading]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return campaigns;
    return campaigns.filter((c) => {
      const name = String(c?.name || "").toLowerCase();
      const id = String(c?.id ?? "");
      return name.includes(term) || id.includes(term);
    });
  }, [campaigns, q]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={[
          "h-8 w-[260px] max-w-[52vw]",
          "rounded-2xl px-3 pr-10 text-[12px] font-semibold",
          "text-left outline-none transition relative",
          "bg-white/60 border border-slate-200/90",
          "shadow-[0_1px_0_rgba(255,255,255,0.7),0_8px_22px_rgba(15,23,42,0.08)]",
          "hover:bg-white/70",
          "focus:ring-1 focus:ring-[var(--brand-strong)]",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "dark:bg-white/8 dark:border-white/14 dark:text-slate-100 dark:hover:bg-white/10",
        ].join(" ")}
      >
        <span className="block truncate text-slate-900 dark:text-slate-100">{label}</span>

        <svg
          className={[
            "pointer-events-none absolute right-2 top-1/2 -translate-y-1/2",
            "h-5 w-5 rounded-lg p-0.5",
            "bg-slate-100 text-slate-700 border border-slate-200/80",
            "dark:bg-white/10 dark:text-slate-200 dark:border-white/10",
            open ? "rotate-180 transition-transform" : "transition-transform",
          ].join(" ")}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M5.5 7.5l4.5 5 4.5-5H5.5z" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className={[
              "absolute left-0 right-0 z-50 mt-2",
              "rounded-2xl border border-slate-200/90",
              "bg-white/92 backdrop-blur-2xl shadow-[0_18px_48px_rgba(15,23,42,0.18)]",
              "dark:bg-slate-900/85 dark:border-white/10",
              "overflow-hidden",
            ].join(" ")}
          >
            <div className="p-2 border-b border-slate-200/80 dark:border-white/10">
              <div className="relative">
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Hledat kampaň…"
                  className={[
                    "w-full h-8 rounded-xl pl-9 pr-3 text-[12px] font-medium",
                    "bg-white border border-slate-200/90 text-slate-900",
                    "outline-none focus:ring-1 focus:ring-[var(--brand-strong)]",
                    "dark:bg-white/5 dark:border-white/10 dark:text-slate-100",
                  ].join(" ")}
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-slate-300"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M10 4a6 6 0 104.472 10.03l3.249 3.25a1 1 0 001.414-1.415l-3.25-3.249A6 6 0 0010 4zm0 2a4 4 0 110 8 4 4 0 010-8z" />
                </svg>
              </div>
            </div>

            <div className="max-h-[280px] overflow-auto p-2">
              <button
                type="button"
                onClick={() => {
                  onChange(NONE_ID);
                  setOpen(false);
                }}
                className={[
                  "w-full rounded-xl px-3 py-2 text-left text-[12px] font-semibold",
                  !value || value === NONE_ID
                    ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                    : "text-slate-800 hover:bg-slate-50",
                  "dark:text-slate-100 dark:hover:bg-white/10",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>Žádná kampaň</span>
                  {(!value || value === NONE_ID) && (
                    <span className="rounded-full bg-[var(--brand-strong)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-strong)] ring-1 ring-[var(--brand-strong)]/25">
                      Aktuální
                    </span>
                  )}
                </div>
              </button>

              {filtered.length ? (
                filtered.map((c) => {
                  const id = String(c.id);
                  const active = id === String(value);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        onChange(id);
                        setOpen(false);
                      }}
                      className={[
                        "mt-1 w-full rounded-xl px-3 py-2 text-left text-[12px] font-semibold",
                        active
                          ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                          : "text-slate-800 hover:bg-slate-50",
                        "dark:text-slate-100 dark:hover:bg-white/10",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{c.name || `Kampaň #${c.id}`}</span>
                        {active && (
                          <span className="shrink-0 rounded-full bg-[var(--brand-strong)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-strong)] ring-1 ring-[var(--brand-strong)]/25">
                            Aktuální
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-[12px] text-slate-500 dark:text-slate-300">Nenalezeno</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Topbar({ onOpenSidebar }) {
  const { start } = useRouteTransition();

  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const [locked, setLocked] = useState(() => localStorage.getItem(LOCK_KEY) === "1");
  const [selectedCampaignId, setSelectedCampaignId] = useState(
    () => localStorage.getItem(SELECTED_CAMPAIGN_KEY) || ""
  );

  const [campaign, setCampaign] = useState(null);

  const [progressById, setProgressById] = useState(() => readJson(PROGRESS_KEY, {}));

  const hasCampaign = !!selectedCampaignId && selectedCampaignId !== NONE_ID;
  const effectiveId = hasCampaign ? String(selectedCampaignId) : FALLBACK_ID;

  const progress = progressById[effectiveId] || { currentStep: "email", completed: {} };
  const currentStep = STEPS.some((s) => s.key === progress.currentStep) ? progress.currentStep : "email";
  const manualCompleted = progress.completed || {};

  const autoCompleted = useMemo(() => {
    if (!hasCampaign) return {};
    return {
      email: !!(campaign?.emailTemplate || campaign?.emailTemplateId),
      landing: !!(campaign?.landingPage || campaign?.landingPageId),
      sender: !!(campaign?.senderIdentity || campaign?.senderIdentityId),
      targets: recipientsCount(campaign) > 0,
      preflight: readPreflightDone(selectedCampaignId),
      launch: ["ACTIVE", "FINISHED", "COMPLETED", "CANCELED"].includes(String(campaign?.status || "").toUpperCase()),
w    };
  }, [hasCampaign, campaign, selectedCampaignId]);

  const completed = useMemo(() => {
    return {
      ...manualCompleted,
      ...autoCompleted,
    };
  }, [manualCompleted, autoCompleted]);

  const selectCampaign = useCallback((id) => {
    const raw = String(id ?? "");
    const nextId = raw === "" ? NONE_ID : raw;

    setSelectedCampaignId(nextId);
    localStorage.setItem(SELECTED_CAMPAIGN_KEY, nextId);

    // při "Žádná" vždy odemknout, ať se uživatel nezasekne
    if (nextId === NONE_ID) {
      localStorage.setItem(LOCK_KEY, "0");
      setLocked(false);
    }

    setProgressById((prev) => ensureBucket(prev, nextId === NONE_ID ? FALLBACK_ID : nextId));

    // pro posluchače: id="" znamená "žádná kampaň"
    const payload = { detail: { id: nextId === NONE_ID ? "" : nextId } };
    window.dispatchEvent(new CustomEvent(CAMPAIGN_CHANGED_EVENT, payload));
    window.dispatchEvent(new CustomEvent(CAMPAIGN_SELECTED_EVENT, payload));
  }, []);

  useEffect(() => {
    if (!hasCampaign) {
      setCampaign(null);
      return;
    }

    let alive = true;
    (async () => {
      try {
        const data = await getCampaign(Number(selectedCampaignId));
        if (alive) setCampaign(data);
      } catch {
        if (alive) setCampaign(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [hasCampaign, selectedCampaignId]);

  useEffect(() => {
    setProgressById((prev) => {
      const next = ensureBucket(prev, effectiveId);
      if (next !== prev) writeJson(PROGRESS_KEY, next);
      return next;
    });
  }, [effectiveId]);

  useEffect(() => {
    writeJson(PROGRESS_KEY, progressById);
  }, [progressById]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingCampaigns(true);
      try {
        const data = await listCampaigns();
        if (!alive) return;

        const arr = Array.isArray(data) ? data : [];
        setCampaigns(arr);

        if (!localStorage.getItem(SELECTED_CAMPAIGN_KEY) && arr.length) {
          selectCampaign(arr[0].id);
        }
      } finally {
        if (alive) setLoadingCampaigns(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectCampaign]);

  useEffect(() => {
    const onSelected = (e) => {
      const id = String(e?.detail?.id ?? "");
      if (!id) return;
      if (locked) return;
      selectCampaign(id);
    };

    const onUpdated = (e) => {
      const id = String(e?.detail?.id ?? "");
      if (!id) return;
      if (String(id) !== String(selectedCampaignId)) return;

      const step = String(e?.detail?.step ?? "");
      if (step === "preflight") {
        setCampaign((c) => c);
        return;
      }

      (async () => {
        try {
          const data = await getCampaign(Number(selectedCampaignId));
          setCampaign(data);
        } catch {
          // ignore
        }
      })();
    };

    window.addEventListener(CAMPAIGN_SELECTED_EVENT, onSelected);
    window.addEventListener(CAMPAIGN_UPDATED_EVENT, onUpdated);

    return () => {
      window.removeEventListener(CAMPAIGN_SELECTED_EVENT, onSelected);
      window.removeEventListener(CAMPAIGN_UPDATED_EVENT, onUpdated);
    };
  }, [locked, selectCampaign, selectedCampaignId]);

  const toggleLock = () => {
    setLocked((v) => {
      const nv = !v;
      localStorage.setItem(LOCK_KEY, nv ? "1" : "0");
      return nv;
    });
  };

  const setCurrentStep = (stepKey) => {
    setProgressById((prev) => {
      const next = ensureBucket(prev, effectiveId);
      return { ...next, [effectiveId]: { ...next[effectiveId], currentStep: stepKey } };
    });
  };

  const toggleCompleted = (stepKey) => {
    setProgressById((prev) => {
      const next = ensureBucket(prev, effectiveId);
      const cur = next[effectiveId];
      const done = !!cur.completed?.[stepKey];
      return {
        ...next,
        [effectiveId]: { ...cur, completed: { ...cur.completed, [stepKey]: !done } },
      };
    });
  };

  const goToStep = (stepKey) => {
    const def = STEPS.find((s) => s.key === stepKey);
    if (!def) return;
    start(def.to(hasCampaign ? selectedCampaignId : ""));
  };

  const MANUAL_TOGGLE_KEYS = new Set(["review", "launch"]);

  const handleStepClick = (stepKey) => {
    if (stepKey !== currentStep) {
      setCurrentStep(stepKey);
      goToStep(stepKey);
      return;
    }

    if (MANUAL_TOGGLE_KEYS.has(stepKey)) {
      toggleCompleted(stepKey);
      return;
    }

    goToStep(stepKey);
  };

  return (
    <header className="shrink-0 bg-transparent">
      <div className="flex items-center gap-3 px-4 py-1 md:px-6 min-h-[46px]">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/35 bg-white/20 hover:bg-white/35"
          aria-label="Otevřít menu"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" />
          </svg>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 text-[11px] font-semibold text-slate-700 dark:text-slate-200">Kampaň</span>

          <CampaignDropdown
            value={selectedCampaignId || NONE_ID}
            locked={hasCampaign ? locked : false}
            loading={loadingCampaigns}
            campaigns={campaigns}
            onChange={selectCampaign}
          />

          <div className="flex items-center gap-1 shrink-0">
            {hasCampaign && (
              <button
                type="button"
                onClick={() => selectCampaign(NONE_ID)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/35 bg-white/14 text-slate-700 hover:bg-white/24 dark:border-white/10 dark:bg-white/6 dark:text-slate-200"
                title="Zrušit aktuální kampaň"
                aria-label="Zrušit aktuální kampaň"
              >
                ×
              </button>
            )}

            <div className="relative h-6 w-6">
              <AnimatePresence initial={false}>
                {hasCampaign ? (
                  <motion.button
                    key="lock"
                    type="button"
                    onClick={toggleLock}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className={[
                      "absolute inset-0 inline-flex items-center justify-center",
                      "h-6 w-6 rounded-lg border",
                      locked
                        ? "bg-[var(--brand-strong)] border-[var(--brand-strong)] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]"
                        : "bg-white/14 border-white/35 text-[var(--brand-strong)] hover:bg-white/24",
                      "dark:border-white/10 dark:bg-white/6",
                    ].join(" ")}
                    title={locked ? "Odemknout výběr kampaně" : "Zamknout výběr kampaně"}
                    aria-label={locked ? "Odemknout" : "Zamknout"}
                  >
                    {locked ? (
                      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor">
                        <path d="M17 8h-1V6a4 4 0 10-8 0v2H7a2 2 0 00-2 2v9a2 2 0 002 2h10a2 2 0 002-2v-9a2 2 0 00-2-2zm-6 9.73V18a1 1 0 002 0v-.27a2 2 0 10-2 0zM10 8V6a2 2 0 114 0v2h-4z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor">
                        <path d="M17 8h-7V6a2 2 0 114 0 1 1 0 102 0 4 4 0 10-8 0v2H7a2 2 0 00-2 2v9a2 2 0 002 2h10a2 2 0 002-2v-9a2 2 0 00-2-2zm-4 9.73V18a1 1 0 002 0v-.27a2 2 0 10-2 0z" />
                      </svg>
                    )}
                  </motion.button>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="ml-auto flex-1 min-h-[38px] overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <AnimatePresence initial={false}>
            {hasCampaign ? (
              <motion.div
                key="stepper"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="min-w-max"
              >
                <div className="flex items-center justify-end gap-2 min-w-max pr-1">
                  {STEPS.map((s, idx) => {
                    const active = s.key === currentStep;
                    const done = !!completed[s.key];

                    const base =
                      `group relative flex ${s.key === "targets" ? "w-[92px]" : "w-[74px]"} shrink-0 flex-col items-center justify-center rounded-2xl border px-2 py-0.5 text-center transition`;
                    const state = active
                      ? "bg-white/22 dark:bg-white/5 border-white/35 dark:border-white/10 " +
                        "shadow-[inset_0_0_0_1px_rgba(46,36,211,0.35),inset_0_0_14px_rgba(71,101,238,0.18)]"
                      : "bg-white/12 dark:bg-white/4 border-white/20 dark:border-white/10 hover:bg-white/18";

                    const badge =
                      active || done
                        ? "bg-[var(--brand-soft)] ring-1 ring-[var(--brand-soft-dark)]"
                        : "bg-white/22 dark:bg-white/8";

                    const badgeTxt =
                      active || done
                        ? "text-[var(--brand-strong)]"
                        : "text-slate-700 dark:text-slate-200";

                    const labelTxt =
                      active ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-200";

                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => handleStepClick(s.key)}
                        className={[base, state].join(" ")}
                        title={s.title || (typeof s.label === "string" ? s.label : "")}
                      >
                        <div className={["flex h-6 w-6 items-center justify-center rounded-xl", badge].join(" ")}>
                          <span
                            className={[
                              "font-extrabold leading-none",
                              badgeTxt,
                              done ? "text-[14px]" : "text-[15px]",
                            ].join(" ")}
                          >
                            {done ? "✓" : idx + 1}
                          </span>
                        </div>

                        <div className={["mt-0.5 text-[9px] font-semibold leading-[10px]", labelTxt].join(" ")}>
                          {s.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
