// Načte všechny .png v tomto adresáři a vrátí mapu { name: url }
const modules = import.meta.glob("./*.png", { eager: true });

const icons = {};
for (const path in modules) {
  const file = path.split("/").pop();         // např. "users.png"
  const name = file.replace(/\.png$/i, "");   // "users"
  icons[name] = modules[path].default;        // URL generovaná Vite
}
export default icons;
