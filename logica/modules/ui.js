// ============================================================
// ui.js — Event listeners e interacciones del dashboard
// Incluye: tema, rol, sidebar, modal, tooltips, loading/error,
//          localStorage, export CSV, filtros avanzados
// ============================================================

import { store } from './state.js';
import { computeDashboard, COLOR_SUSCRIPCION, obtenerDatosFiltrados } from './compute.js';
import { calcularYRenderizar, renderCharts } from './render.js';
import { generateCSV, downloadFile } from './utils.js';

// ============================================================
// TEMA (light/dark)
// ============================================================

/**
 * setTheme(theme)
 * Cambia entre modo oscuro y claro.
 * Persiste en localStorage y re-renderiza charts (cambian colores).
 */
export function setTheme(theme) {
  store.setState({ theme });
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.classList.toggle('light', theme !== 'dark');

  // Actualizar iconos de sol/luna
  const sun = document.querySelector('.sun-icon');
  const moon = document.querySelector('.moon-icon');
  if (theme === 'dark') {
    sun?.classList.add('hidden');
    moon?.classList.remove('hidden');
  } else {
    sun?.classList.remove('hidden');
    moon?.classList.add('hidden');
  }

  // Persistir en localStorage
  try {
    localStorage.setItem('startuptools_theme', theme);
  } catch (e) {
    // Sin fallback si localStorage no está disponible
  }

  // Re-renderizar gráficos porque los colores cambian
  const { role, periodo } = store.getState();
  const resultado = computeDashboard(role, periodo);
  renderCharts(resultado.salesData, resultado.donutData);
}

// ============================================================
// ROL
// ============================================================

/**
 * setRole(role)
 * Cambia el rol activo, actualiza UI y recalcula dashboard.
 */
export function setRole(role) {
  store.setState({ role });

  // Marcar botón activo visualmente
  document.querySelectorAll('.role-btn').forEach((btn) => {
    const activo = btn.dataset.role === role;
    btn.classList.toggle('active', activo);
    btn.classList.toggle('role-active', activo);
    btn.classList.toggle('role-inactive', !activo);
  });

  // Feedback visual: título e iniciales del avatar
  const nombresRol = { founder: 'Fundador', team: 'Equipo', investor: 'Inversor' };
  const initialsRol = { founder: 'FD', team: 'EQ', investor: 'IN' };
  const titleEl = document.getElementById('dashboardTitle');
  const avatarEl = document.getElementById('avatarInitials');
  if (titleEl) titleEl.textContent = `Dashboard — ${nombresRol[role] || role}`;
  if (avatarEl) avatarEl.textContent = initialsRol[role] || 'ST';

  // Persistir en localStorage
  try {
    localStorage.setItem('startuptools_role', role);
  } catch (e) {
    // Sin fallback
  }

  calcularYRenderizar();
}

// ============================================================
// SIDEBAR
// ============================================================

/**
 * toggleSidebar()
 * Abre/cierra la sidebar en mobile.
 */
export function toggleSidebar() {
  const { sidebarOpen } = store.getState();
  const nuevoEstado = !sidebarOpen;
  store.setState({ sidebarOpen: nuevoEstado });

  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (sidebar) sidebar.classList.toggle('collapsed', !nuevoEstado);

  if (window.innerWidth < 1024) {
    if (sidebar) sidebar.classList.toggle('mobile-open', nuevoEstado);
    if (overlay) overlay.classList.toggle('hidden', !nuevoEstado);
    document.body.classList.toggle('overflow-hidden', nuevoEstado);
  }
}

// ============================================================
// PERÍODO
// ============================================================

/**
 * setPeriodo(periodo)
 * Cambia el filtro temporal y recalcula dashboard.
 */
export function setPeriodo(periodo) {
  store.setState({ periodo });

  const labels = {
    '1m': 'Este mes',
    '3m': 'Último trimestre',
    '6m': 'Últimos 6 meses',
    '12m': 'Histórico',
  };
  const label = document.getElementById('chartPeriodLabel');
  if (label) label.textContent = labels[periodo] || 'Últimos 6 meses';

  calcularYRenderizar();
}

// ============================================================
// MODAL
// ============================================================

/**
 * openModal(id)
 * Muestra el modal con detalle de una transacción.
 */
export function openModal(id) {
  const { rawData } = store.getState();
  const item = rawData.find((r) => r.id == id);
  if (!item) return;

  const clientes = [
    'Ana Gómez', 'Carlos Ruiz', 'María López', 'Pedro Martínez',
    'Laura Sánchez', 'Diego Fernández', 'Sofía Castro', 'Juan Pérez',
  ];
  const gateways = ['Stripe', 'Mercado Pago', 'PayPal', 'OpenPay'];

  const body = document.getElementById('modalBody');
  if (body) {
    body.innerHTML = `
      <div class="flex justify-between py-1">
        <span class="text-muted">ID:</span>
        <span class="text-primary font-medium">#${item.id}</span>
      </div>
      <div class="flex justify-between py-1">
        <span class="text-muted">Cliente:</span>
        <span class="text-primary font-medium">${clientes[item.id % clientes.length]}</span>
      </div>
      <div class="flex justify-between py-1">
        <span class="text-muted">Fecha:</span>
        <span class="text-primary font-medium">${item.fecha}</span>
      </div>
      <div class="flex justify-between py-1">
        <span class="text-muted">Plan:</span>
        <span class="font-medium" style="color:${COLOR_SUSCRIPCION[item.tipo_suscripcion] || '#3B82F6'}">${item.tipo_suscripcion}</span>
      </div>
      <div class="flex justify-between py-1">
        <span class="text-muted">Monto:</span>
        <span class="text-primary font-medium">$${item.monto_venta.toLocaleString()}</span>
      </div>
      <div class="flex justify-between py-1">
        <span class="text-muted">Gateway:</span>
        <span class="text-primary font-medium">${gateways[item.id % gateways.length]}</span>
      </div>
      <div class="flex justify-between py-1">
        <span class="text-muted">Usuario activo:</span>
        <span class="font-medium ${item.usuario_activo ? 'text-accent-green' : 'text-accent-orange'}">${item.usuario_activo ? 'Sí' : 'No'}</span>
      </div>
    `;
  }

  const modal = document.getElementById('detailModal');
  if (modal) modal.classList.remove('hidden');
}

/**
 * closeModal()
 * Cierra el modal de detalle.
 */
export function closeModal() {
  const modal = document.getElementById('detailModal');
  if (modal) modal.classList.add('hidden');
}

// ============================================================
// TOOLTIPS — setup de eventos hover
// ============================================================

/**
 * setupTooltips()
 * Conecta eventos mouseenter/mouseleave a los tooltips.
 */
export function setupTooltips() {
  document.querySelectorAll('.tooltip-trigger').forEach((el) => {
    el.addEventListener('mouseenter', function () {
      const tip = this.querySelector('.tooltip-content');
      if (tip) tip.classList.add('tooltip-visible');
    });
    el.addEventListener('mouseleave', function () {
      const tip = this.querySelector('.tooltip-content');
      if (tip) tip.classList.remove('tooltip-visible');
    });
  });
}

// ============================================================
// LOADING / ERROR
// ============================================================

/**
 * mostrarLoading(visible)
 * Muestra/oculta la pantalla de carga.
 */
export function mostrarLoading(visible) {
  const loader = document.getElementById('loadingState');
  const content = document.getElementById('dashboardContent');
  if (loader) loader.classList.toggle('hidden', !visible);
  if (content) content.classList.toggle('hidden', visible);
}

/**
 * mostrarError(mensaje)
 * Muestra pantalla de error con mensaje.
 */
export function mostrarError(mensaje) {
  const errorEl = document.getElementById('errorState');
  const content = document.getElementById('dashboardContent');
  if (errorEl) {
    errorEl.classList.remove('hidden');
    const msgEl = errorEl.querySelector('.error-message');
    if (msgEl) msgEl.textContent = mensaje;
  }
  if (content) content.classList.add('hidden');
}

// ============================================================
// EXPORTAR A CSV
// ============================================================

/**
 * exportToCSV()
 * Genera y descarga un archivo CSV con los datos actuales.
 * Usa los mismos filtros que computeDashboard (vía obtenerDatosFiltrados).
 */
export function exportToCSV() {
  const data = obtenerDatosFiltrados();

  if (!data || data.length === 0) {
    console.warn('No hay datos para exportar');
    return;
  }

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'fecha', label: 'Fecha' },
    { key: 'monto_venta', label: 'Monto' },
    { key: 'tipo_suscripcion', label: 'Plan' },
    { key: 'usuario_activo', label: 'Activo' },
  ];

  // Mapear boolean a texto
  const dataForExport = data.map((item) => ({
    ...item,
    usuario_activo: item.usuario_activo ? 'Sí' : 'No',
  }));

  const csv = generateCSV(dataForExport, columns);
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadFile(csv, `startuptools_export_${timestamp}.csv`);
}

// ============================================================
// FILTROS AVANZADOS
// ============================================================

/**
 * filterByDateRange(start, end)
 * Filtra los datos por un rango de fechas.
 * @param {Date|null} start — fecha de inicio (incluída)
 * @param {Date|null} end   — fecha de fin (incluída)
 */
export function filterByDateRange(start, end) {
  store.setState({
    dateRangeStart: start || null,
    dateRangeEnd: end || null,
  });
  calcularYRenderizar();
}

/**
 * filterByPlan(plan)
 * Filtra los datos por tipo de suscripción.
 * @param {string|null} plan — 'Basic', 'Pro', 'Enterprise' o null para quitar filtro
 */
export function filterByPlan(plan) {
  store.setState({ planFilter: plan || null });
  calcularYRenderizar();
}

/**
 * clearFilters()
 * Limpia todos los filtros avanzados.
 */
export function clearFilters() {
  store.setState({
    dateRangeStart: null,
    dateRangeEnd: null,
    planFilter: null,
  });
  calcularYRenderizar();
}

// ============================================================
// CONFIGURACIÓN DE EVENT LISTENERS
// ============================================================

/**
 * setupEventListeners(fetchDashboardData)
 * Configura todos los event listeners del dashboard.
 * Recibe fetchDashboardData como parámetro para evitar
 * dependencia circular entre módulos.
 *
 * @param {Function} fetchDashboardData — función de fetch con retry
 */
export function setupEventListeners(fetchDashboardData) {
  // --- Restaurar de localStorage ---
  try {
    const savedTheme = localStorage.getItem('startuptools_theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
    } else {
      setTheme('dark');
    }

    const savedRole = localStorage.getItem('startuptools_role');
    if (savedRole === 'founder' || savedRole === 'team' || savedRole === 'investor') {
      setRole(savedRole);
    } else {
      setRole('founder');
    }
  } catch (e) {
    // localStorage no disponible, valores por defecto
    setTheme('dark');
    setRole('founder');
  }

  // --- Tooltips (hover) ---
  setupTooltips();

  // --- Toggle de tema ---
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const { theme } = store.getState();
      setTheme(theme === 'dark' ? 'light' : 'dark');
    });
  }

  // --- Sidebar hamburguesa ---
  const sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', toggleSidebar);
  }
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', toggleSidebar);
  }

  // --- Botones de rol ---
  document.querySelectorAll('.role-btn').forEach((btn) => {
    btn.addEventListener('click', () => setRole(btn.dataset.role));
  });

  // --- Botón Reintentar (error state) ---
  const retryBtn = document.getElementById('retryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', fetchDashboardData);
  }

  // --- Selector de período ---
  const periodoSelector = document.getElementById('periodoSelector');
  if (periodoSelector) {
    periodoSelector.addEventListener('change', (e) => {
      setPeriodo(e.target.value);
    });
  }

  // --- Modal: cerrar ---
  const closeModalBtn = document.getElementById('closeModal');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
  }

  const detailModal = document.getElementById('detailModal');
  if (detailModal) {
    detailModal.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // --- Modal: clic en actividad reciente ---
  const activityList = document.getElementById('activityList');
  if (activityList) {
    activityList.addEventListener('click', (e) => {
      const row = e.target.closest('.activity-row');
      if (row && row.dataset.id) openModal(row.dataset.id);
    });
  }

  // --- Botón de exportar CSV (preparado para cuando exista en HTML) ---
  const exportBtn = document.getElementById('exportCsvBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToCSV);
  }

  // --- Window resize: cerrar sidebar mobile y re-renderizar charts ---
  let resizeTimer;
  window.addEventListener('resize', () => {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth >= 1024) {
      if (sidebar) sidebar.classList.remove('mobile-open');
      const overlay = document.getElementById('sidebarOverlay');
      if (overlay) overlay.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }

    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const { role, periodo } = store.getState();
      const resultado = computeDashboard(role, periodo);
      renderCharts(resultado.salesData, resultado.donutData);
    }, 150);
  });
}
