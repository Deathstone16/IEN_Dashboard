// ============================================================
// state.js — Store pattern (pub/sub)
// Estado global centralizado con notificación a suscriptores
// ============================================================

/**
 * createStore(initialState)
 * Crea un store simple con getState, setState y subscribe.
 * setState(partial) mergea parcialmente y notifica a todos los listeners.
 */
export function createStore(initialState) {
  let state = { ...initialState };
  const listeners = new Set();

  return {
    /** Devuelve una copia del estado actual */
    getState() {
      return state;
    },

    /** Mergea `partial` en el estado y notifica a suscriptores */
    setState(partial) {
      state = { ...state, ...partial };
      listeners.forEach((listener) => {
        try {
          listener(state);
        } catch (e) {
          console.error('Error en listener del store:', e);
        }
      });
    },

    /** Registra un listener que se ejecutará en cada setState().
     *  Devuelve una función para cancelar la suscripción. */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// --- Es
const initialState = {
  theme: 'dark',           // 'dark' | 'light'
  role: 'founder',         // 'founder' | 'team' | 'investor'
  periodo: '6m',           // '1m' | '3m' | '6m' | '12m'
  sidebarOpen: true,       // sidebar abierto/cerrado en mobile
  rawData: [],             // 1000 registros de la API
  loading: true,           // true mientras se descarga
  error: null,             // mensaje de error si falla el fetch

  // Filtros avanzados (se apilan AND)
  dateRangeStart: null,    // objeto Date | null
  dateRangeEnd: null,      // objeto Date | null
  planFilter: null,        // 'Basic' | 'Pro' | 'Enterprise' | null
};

/** Instancia única del store — importar en todos los módulos */
export const store = createStore(initialState);
