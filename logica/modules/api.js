// ============================================================
// api.js — Fetch de datos con retry (exponential backoff)
// ============================================================

import { store } from './state.js';
import { mostrarLoading, mostrarError } from './ui.js';
import { calcularYRenderizar } from './render.js';

// URL de la API de Mockaroo
const API_URL = 'https://my.api.mockaroo.com/dashboard.json?key=c6b83760';

// Configuración de reintentos
const MAX_RETRIES = 3;
const BASE_DELAY = 2000; // 2 segundos

/**
 * fetchConRetry(url, retries, baseDelay)
 * Función interna que realiza el fetch con reintentos y backoff exponencial.
 *
 * Estrategia: 3 intentos con esperas de 2s, 4s y 8s.
 * Diferenciación de errores: 429 (cuota), 403 (key), network / HTTP.
 *
 * @param {string}  url       — URL del recurso
 * @param {number}  retries   — cantidad máxima de reintentos
 * @param {number}  baseDelay — milisegundos base para el backoff
 * @returns {Promise<Array>}  — datos parseados como JSON
 */
async function fetchConRetry(url, retries = MAX_RETRIES, baseDelay = BASE_DELAY) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const respuesta = await fetch(url);

      // Si la respuesta es exitosa (200-299), devolvemos los datos
      if (respuesta.ok) {
        return await respuesta.json();
      }

      // Errores HTTP con mensajes específicos
      if (respuesta.status === 429) {
        throw new Error(
          'Límite de consultas diarias alcanzado (429). Esperá al próximo día o usá otra API key.'
        );
      }
      if (respuesta.status === 403) {
        throw new Error(
          'API key inválida o sin permisos (403). Revisá la key de Mockaroo.'
        );
      }

      // Otros errores HTTP (500, 404, etc.)
      throw new Error(
        `Error HTTP ${respuesta.status}: el servidor respondió con un código de error`
      );

    } catch (error) {
      lastError = error;

      // Si es el último intento, no esperamos — lanzamos el error directamente
      if (attempt === retries) {
        throw error;
      }

      // Diferenciar entre error de red y error HTTP para el mensaje
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.warn(
          `Intento ${attempt}/${retries}: Error de red. Reintentando en ${baseDelay * Math.pow(2, attempt - 1) / 1000}s...`
        );
      } else {
        console.warn(
          `Intento ${attempt}/${retries}: ${error.message}. Reintentando en ${baseDelay * Math.pow(2, attempt - 1) / 1000}s...`
        );
      }

      // Espera exponencial: 2s, 4s, 8s
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Nunca debería llegar acá, pero por si acaso:
  throw lastError || new Error('Error desconocido al cargar los datos');
}

/**
 * fetchDashboardData()
 * Obtiene datos de Mockaroo, los guarda en el store,
 * y dispara el render completo del dashboard.
 *
 * Maneja tres estados: loading → success (render) / error (pantalla de error).
 * El botón "Reintentar" está vinculado a esta función desde ui.js.
 */
export async function fetchDashboardData() {
  // Mostrar pantalla de carga
  store.setState({ loading: true, error: null });
  mostrarLoading(true);

  try {
    const datosCrudos = await fetchConRetry(API_URL);

    // Validar que los datos sean un array no vacío
    if (!Array.isArray(datosCrudos) || datosCrudos.length === 0) {
      throw new Error('La API devolvió datos vacíos o con formato incorrecto');
    }

    // Guardar en el store
    store.setState({
      rawData: datosCrudos,
      loading: false,
      error: null,
    });

    // Ocultar loading
    mostrarLoading(false);

    // Calcular todo y renderizar
    try {
      calcularYRenderizar();
    } catch (renderError) {
      console.error('Error al renderizar:', renderError);
      throw new Error('Error al dibujar el dashboard: ' + renderError.message);
    }

  } catch (error) {
    // Si algo sale mal (sin internet, CORS, API caída, etc.)
    console.error('Error al cargar datos:', error);

    store.setState({
      loading: false,
      error: error.message,
    });

    mostrarLoading(false);
    mostrarError(error.message);
  }
}
