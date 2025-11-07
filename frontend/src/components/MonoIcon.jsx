// src/components/MonoIcon.jsx
import icons from "../assets/icons";

/**
 * Monochromní ikona přes CSS masku (ideální pro jednobarevné PNG s průhledným pozadím).
 * Barva se určuje přes backgroundColor.
 */
export function MonoIcon({
  name,
  className = "h-4 w-4",
  color = "var(--brand)",
  title,
}) {
  const src = icons[name];
  if (!src) return null;

  return (
    <span
      className={["inline-block align-middle", className].join(" ")}
      style={{
        backgroundColor: color,
        mask: `url(${src}) no-repeat center / contain`,
        WebkitMask: `url(${src}) no-repeat center / contain`,
      }}
      aria-hidden
      title={title}
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
