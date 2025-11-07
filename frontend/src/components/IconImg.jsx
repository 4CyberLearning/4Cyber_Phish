import icons from "../assets/icons";

export function IconImg({ name, className = "", alt = "" }) {
  const src = icons[name];
  if (!src) return null;
  return <img src={src} alt={alt || name} className={className} />;
}
