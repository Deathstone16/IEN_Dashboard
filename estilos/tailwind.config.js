// StartupTools — Configuración de Tailwind CSS
// Se carga después del CDN (tailwind ya existe como global).
// Asignación segura por si el CDN tardara en cargar.
var tw = window.tailwind || {};
tw.config = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
};
window.tailwind = tw;
