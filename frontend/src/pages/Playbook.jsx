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
        <h3 className="text-cyan-700 font-semibold text-[17px] md:text-[18px] leading-tight">
          {step.label}
        </h3>
      </motion.div>

      {/* řádek 1: tečka uprostřed */}
      <div className="hidden lg:block lg:col-[2] lg:row-[1] place-self-center">
        <span className="block h-3 w-3 rounded-full bg-cyan-400" />
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
        <span className="rounded-full bg-cyan-500 text-white text-[13px] px-3 py-1 font-medium shadow-sm whitespace-nowrap">
          {step.chip}
        </span>
      </div>

      {/* řádek 2: text – těsnější řádkování a menší písmo */}
      <motion.div
        variants={variants}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
        className={[
          "mt-2 space-y-1 text-gray-700 leading-tight text-[14px] md:text-[15px]",
          isLeft
            ? "lg:col-[1] lg:row-[2] lg:text-right lg:pr-12"
            : "lg:col-[3] lg:row-[2] lg:text-left lg:pl-12",
        ].join(" ")}
      >
        {(step.paragraphs || []).map((p, i) => <p key={i}>{p}</p>)}
      </motion.div>
    </li>
  );
}

export default function Playbook() {
  const { t } = useTranslation();
  const steps = t("playbook.steps", { returnObjects: true });

  return (
    <div className="space-y-8">
      {/* header centrovaný, necháváme stejně */}
      <header className="max-w-3xl mx-auto text-center">
        <h1 className="text-[26px] md:text-[28px] font-semibold tracking-tight text-gray-900">
          {t("playbook.title")}
        </h1>
        <p className="mt-2 text-gray-600 text-[15px] leading-relaxed">
          {t("playbook.intro")}
        </p>
      </header>

      <div className="relative mt-10">
        {/* centrální osa */}
        <div className="hidden lg:block absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-gray-300" />
        <div className="lg:hidden absolute left-4 top-20 h-full w-px bg-gray-200" />

        {/* větší rozestupy mezi kroky */}
        <ol className="relative space-y-20 md:space-y-18 lg:space-y-18">
          {steps.map((s, i) => (
            <Step key={i} step={s} side={i % 2 === 0 ? "left" : "right"} />
          ))}
        </ol>
      </div>

      <aside className="rounded-md border border-cyan-200 bg-cyan-50 p-4 text-cyan-900 text-sm">
        {t("playbook.safetyNote")}
      </aside>
    </div>
  );
}
