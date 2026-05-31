// ============================================================
// STARTUPTOOLS — DASHBOARD (Entry Point)
// ============================================================
// Punto de entrada único. Carga con type="module" defer.
// Solo importa e inicia: event listeners + fetch de datos.
// ============================================================

import { setupEventListeners } from './modules/ui.js';
import { fetchDashboardData } from './modules/api.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Configurar todos los event listeners del dashboard
  //    Pasamos fetchDashboardData para evitar dep. circular
  setupEventListeners(fetchDashboardData);

  // 2. Iniciar carga de datos desde Mockaroo
  fetchDashboardData();
});
