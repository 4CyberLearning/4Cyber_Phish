import { useTranslation } from "react-i18next";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

function Step({ step, side }) {
  const isLeft = side === "left";
  const ref = useRef(null);
  const inView = useInView(ref, { margin: "-10% 0px -10% 0px", amount: 0.4 });
  const variants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } };

  return (
    <li
      ref={ref}
      className="
        relative
        lg:grid lg:grid-cols-[1fr_0px_1fr]
        lg:items-start
      "
    >
      {/* řádek 1: nadpis */}
      <motion.div
        variants={variants}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={[
          "flex items-center",
          isLeft
            ? "lg:col-[1] lg:row-[1] lg:justify-end lg:text-right lg:pr-12"
            : "lg:col-[3] lg:row-[1] lg:justify-start lg:text-left lg:pl-12",
        ].join(" ")}
      >
        <h3 className="font-semibold text-[17px] md:text-[18px] leading-tight text-[var(--brand-strong)]">
          {step.label}
        </h3>
      </motion.div>

      {/* řádek 1: tečka uprostřed */}
      <div className="hidden lg:block lg:col-[2] lg:row-[1] place-self-center">
        <span
          className="block h-3 w-3 rounded-full"
          style={{
            background: "var(--brand-strong)",
            boxShadow: "0 0 0 3px var(--brand-soft)",
          }}
        />
      </div>

      {/* řádek 1: pilulka 30px od osy */}
      <div
        className={[
          "hidden lg:block lg:row-[1] place-self-center",
          isLeft
            ? "lg:col-[3] lg:justify-self-start lg:ml-[30px]"
            : "lg:col-[1] lg:justify-self-end lg:mr-[30px]",
        ].join(" ")}
      >
        <span
          className={[
            "rounded-full text-[13px] px-3 py-1 font-semibold whitespace-nowrap",
            "border",
            "bg-white/65 dark:bg-white/8",
            "border-white/70 dark:border-white/10",
            "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]",
          ].join(" ")}
          style={{
            color: "var(--brand-strong)",
            boxShadow:
              "inset 0 0 0 1px rgba(255,255,255,0.35), 0 10px 24px rgba(15,23,42,0.08)",
          }}
        >
          {step.chip}
        </span>
      </div>

      {/* řádek 2: text */}
      <motion.div
        variants={variants}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
        className={[
          "mt-2 space-y-1 leading-tight text-[14px] md:text-[15px]",
          "text-slate-700 dark:text-slate-200",
          isLeft
            ? "lg:col-[1] lg:row-[2] lg:text-right lg:pr-12"
            : "lg:col-[3] lg:row-[2] lg:text-left lg:pl-12",
        ].join(" ")}
      >
        {(step.paragraphs || []).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </motion.div>
    </li>
  );
}

export default function Playbook() {
  const { t } = useTranslation();
  const steps = t("playbook.steps", { returnObjects: true });

  return (
    <div className="space-y-8">
      {/* header */}
      <header className="max-w-3xl mx-auto text-center">
        <h1 className="text-[26px] md:text-[28px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {t("playbook.title")}
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300 text-[15px] leading-relaxed">
          {t("playbook.intro")}
        </p>
      </header>

      <div className="relative mt-10">
        {/* centrální osa */}
        <div
          className="hidden lg:block absolute inset-y-0 left-1/2 -translate-x-1/2 w-px"
          style={{
            background:
              "linear-gradient(to bottom, rgba(46,36,211,0.00), rgba(46,36,211,0.20), rgba(46,36,211,0.00))",
          }}
        />
        <div
          className="lg:hidden absolute left-4 top-20 h-full w-px"
          style={{
            background:
              "linear-gradient(to bottom, rgba(46,36,211,0.00), rgba(46,36,211,0.18), rgba(46,36,211,0.00))",
          }}
        />

        <ol className="relative space-y-20 md:space-y-18 lg:space-y-18">
          {steps.map((s, i) => (
            <Step key={i} step={s} side={i % 2 === 0 ? "left" : "right"} />
          ))}
        </ol>
      </div>

      <aside
        className={[
          "rounded-2xl p-4 text-sm",
          "border border-white/70 dark:border-white/10",
          "bg-white/60 dark:bg-white/6",
          "shadow-[0_12px_36px_rgba(15,23,42,0.08)]",
        ].join(" ")}
        style={{
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.35), 0 14px 40px rgba(15,23,42,0.08)",
        }}
      >
        <span className="font-semibold" style={{ color: "var(--brand-strong)" }}>
          {t("playbook.safetyNote")}
        </span>
      </aside>
    </div>
  );
}
