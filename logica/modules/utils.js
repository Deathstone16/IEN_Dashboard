// ============================================================
// utils.js — Helpers generales
// ============================================================

/**
 * formatCurrency(value)
 * Formatea un número como moneda en USD.
 * Ejemplo: 12345 → "$12,345"
 */
export function formatCurrency(value) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

/**
 * formatPercentage(value)
 * Formatea un número como porcentaje con signo.
 * Ejemplo: 12.5 → "+12.5%", -3.2 → "-3.2%"
 */
export function formatPercentage(value) {
  const signo = value >= 0 ? '+' : '';
  return `${signo}${value.toFixed(1)}%`;
}

/**
 * getRelativeTime(date)
 * Devuelve un string legible de tiempo relativo (hace X min/h/días).
 */
export function getRelativeTime(date) {
  const ahora = new Date();
  const diffMs = ahora - date;
  const diffMinutos = Math.floor(diffMs / (1000 * 60));
  const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDias = Math.floor(diffHoras / 24);

  if (diffMinutos < 60) return `hace ${diffMinutos} min`;
  if (diffHoras < 24) return `hace ${diffHoras} h`;
  return `hace ${diffDias} día${diffDias > 1 ? 's' : ''}`;
}

/**
 * debounce(fn, delay)
 * Wrapper que retrasa la ejecución hasta que pasen `delay` ms
 * desde la última invocación.
 */
export function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * generateCSV(data, columns)
 * Genera un string CSV a partir de un array de objetos.
 * columns = [{ key, label }]
 */
export function generateCSV(data, columns) {
  const header = columns.map((c) => c.label).join(',');
  const rows = data.map((item) =>
    columns.map((c) => {
      const val = item[c.key];
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

/**
 * downloadFile(content, filename, mimeType)
 * Dispara la descarga de un archivo en el navegador.
 */
export function downloadFile(content, filename, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
