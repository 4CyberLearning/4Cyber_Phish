// src/components/MonoIcon.jsx
import icons from "../assets/icons";

/**
 * Monochromní ikona přes CSS masku (ideální pro jednobarevné PNG s průhledným pozadím).
 * Barva se určuje přes backgroundColor.
 */
export function MonoIcon({ name, className = "", color }) {
  const src = new URL(`../assets/icons/${name}.png`, import.meta.url).toString();

  // pokud přijde `color`, necháme původní chování (jednobarevné)
  if (color) {
    return <img src={src} className={className} style={{ filter: `drop-shadow(0 0 0 ${color})` }} alt="" />;
  }

  // bez `color` -> gradient přes masku
  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        background: "linear-gradient(135deg, var(--brand-strong), var(--brand))",
        WebkitMaskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "contain",
        maskImage: `url(${src})`,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
      }}
      aria-hidden="true"
    />
  );
}

/**
 * Klasický <img> varianta, pokud bys nechtěl masku.
 */
export function IconImg({ name, className = "h-4 w-4", alt = "" }) {
  const src = icons[name];
  if (!src) return null;
  return <img src={src} alt={alt || name} className={className} />;
}
