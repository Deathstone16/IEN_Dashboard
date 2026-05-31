// ============================================================
// STARTUPTOOLS — APP
// ============================================================
// Archivo único consolidado de todo el JavaScript del dashboard.
// Sin imports/exports — script regular cargado con <script src="js/app.js" defer></script>
// ============================================================

// ============================================================
// 1. STATE
// ============================================================

/**
 * createStore(initialState)
 * Crea un store simple con getState, setState y subscribe.
 * setState(partial) mergea parcialmente y notifica a todos los listeners.
 */
function createStore(initialState) {
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

// --- Estado inicial ---
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

/** Instancia única del store */
const store = createStore(initialState);

// ============================================================
// 2. COMPUTE — CONSTANTS
// ============================================================

/** Mensajes de ayuda para tooltips de cada KPI */
const tooltips = {
  'Usuarios activos': 'Usuarios con estado activo en la plataforma',
  'Ventas mensuales': 'Suma de todas las ventas del mes actual',
  'Crecimiento': 'Variación porcentual vs el mes anterior',
  'Ticket promedio': 'Valor promedio de cada venta',
  'Total transacciones': 'Cantidad total de ventas registradas',
  'Plan más vendido': 'Tipo de suscripción con más ventas',
  'Tasa de activos': 'Porcentaje de usuarios activos sobre el total',
  'Promedio por cliente': 'Gasto promedio por transacción',
  'MRR': 'Monthly Recurring Revenue — ingreso mensual recurrente estimado',
  'ARR': 'Annual Recurring Revenue — proyección anual del MRR',
  'CAC': 'Costo de Adquisición de Cliente — estimado del gasto por cliente nuevo',
  'Churn': 'Tasa de bajas — proporción de usuarios inactivos',
};

/** Nombres abreviados de meses para el eje X del gráfico */
const NOMBRES_MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

/** Colores asignados a cada tipo de suscripción */
const COLOR_SUSCRIPCION = {
  Basic: '#3B82F6',       // azul
  Pro: '#10B981',         // verde
  Enterprise: '#8B5CF6',  // púrpura
};

// ============================================================
// 3. UTILS
// ============================================================

/**
 * formatCurrency(value)
 * Formatea un número como moneda en USD.
 * Ejemplo: 12345 → "$12,345"
 */
function formatCurrency(value) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

/**
 * formatPercentage(value)
 * Formatea un número como porcentaje con signo.
 * Ejemplo: 12.5 → "+12.5%", -3.2 → "-3.2%"
 */
function formatPercentage(value) {
  const signo = value >= 0 ? '+' : '';
  return `${signo}${value.toFixed(1)}%`;
}

/**
 * getRelativeTime(date)
 * Devuelve un string legible de tiempo relativo (hace X min/h/días).
 */
function getRelativeTime(date) {
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
function debounce(fn, delay = 150) {
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
function generateCSV(data, columns) {
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
function downloadFile(content, filename, mimeType = 'text/csv;charset=utf-8;') {
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

// ============================================================
// 4. COMPUTE — FUNCTIONS
// ============================================================

/**
 * parseFecha(fechaStr)
 * Convierte "M/d/yyyy" a objeto Date de JavaScript.
 */
function parseFecha(fechaStr) {
  const partes = fechaStr.split('/');
  return new Date(
    parseInt(partes[2]),       // año
    parseInt(partes[0]) - 1,   // mes (0-indexado)
    parseInt(partes[1])        // día
  );
}

/**
 * agruparPorMes(data)
 * Agrupa registros por mes (clave "YYYY-MM").
 * Devuelve: { "2025-06": [...], "2025-07": [...], ... }
 */
function agruparPorMes(data) {
  const grupos = {};
  data.forEach((registro) => {
    const fecha = parseFecha(registro.fecha);
    const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    if (!grupos[clave]) grupos[clave] = [];
    grupos[clave].push(registro);
  });
  return grupos;
}

/**
 * ordenarClavesPorFecha(claves)
 * Ordena array de strings "YYYY-MM" de más antiguo a más nuevo.
 */
function ordenarClavesPorFecha(claves) {
  return [...claves].sort();
}

/**
 * obtenerDatosFiltrados()
 * Aplica los filtros del store (dateRangeStart, dateRangeEnd, planFilter)
 * sobre rawData. Devuelve el array filtrado (o rawData si no hay filtros).
 */
function obtenerDatosFiltrados() {
  const { rawData, dateRangeStart, dateRangeEnd, planFilter } = store.getState();
  if (!rawData || rawData.length === 0) return [];

  // Si no hay filtros activos, devolvemos rawData completo
  if (!dateRangeStart && !dateRangeEnd && !planFilter) {
    return rawData;
  }

  return rawData.filter((item) => {
    // Filtro por rango de fechas
    if (dateRangeStart || dateRangeEnd) {
      const fechaItem = parseFecha(item.fecha);
      if (dateRangeStart && fechaItem < dateRangeStart) return false;
      if (dateRangeEnd && fechaItem > dateRangeEnd) return false;
    }
    // Filtro por plan de suscripción
    if (planFilter && item.tipo_suscripcion !== planFilter) return false;
    return true;
  });
}

/**
 * computeDashboard(role, period)
 * Calcula KPIs, sparklines, charts y actividad según rol y período.
 *
 * @param {string} role   — 'founder' | 'team' | 'investor'
 * @param {string} period — '1m' | '3m' | '6m' | '12m'
 * @returns {{ kpis, sparklines, salesData, donutData, activity }}
 */
function computeDashboard(role, period) {
  // Obtener datos filtrados
  const data = obtenerDatosFiltrados();

  if (!data || data.length === 0) {
    return {
      kpis: [],
      sparklines: [],
      salesData: [],
      donutData: { activos: 0, inactivos: 0 },
      activity: [],
    };
  }

  // --- Agrupar por mes ---
  const porMes = agruparPorMes(data);
  const mesesOrdenados = ordenarClavesPorFecha(Object.keys(porMes));
  const periodCount = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 };
  const count = periodCount[period] || 6;
  const ultimosMeses = mesesOrdenados.slice(-count);

  // --- Ventas mensuales (para line chart y sparklines) ---
  const ventasPorMes = ultimosMeses.map((clave) =>
    porMes[clave].reduce((sum, r) => sum + r.monto_venta, 0)
  );

  // --- Totales generales ---
  const totalActivos = data.filter((r) => r.usuario_activo === true).length;
  const totalInactivos = data.filter((r) => r.usuario_activo === false).length;
  const ventasTotales = data.reduce((sum, r) => sum + r.monto_venta, 0);
  const totalRegistros = data.length;
  const ticketPromedio = totalRegistros > 0 ? Math.round(ventasTotales / totalRegistros) : 0;

  // --- Ventas del mes actual y anterior ---
  const mesActual = ultimosMeses[ultimosMeses.length - 1];
  const ventasMesActual = mesActual
    ? porMes[mesActual].reduce((sum, r) => sum + r.monto_venta, 0)
    : 0;
  const mesAnterior = ultimosMeses.length >= 2 ? ultimosMeses[ultimosMeses.length - 2] : null;
  const ventasMesAnterior = mesAnterior
    ? porMes[mesAnterior].reduce((sum, r) => sum + r.monto_venta, 0)
    : 0;

  // --- Crecimiento (% cambio vs mes anterior) ---
  let crecimiento = 0;
  let cambioDir = 'up';
  if (ventasMesAnterior > 0) {
    crecimiento = ((ventasMesActual - ventasMesAnterior) / ventasMesAnterior) * 100;
    cambioDir = crecimiento >= 0 ? 'up' : 'down';
  }

  // --- Actividad reciente (últimas 5 transacciones) ---
  const actividad = [...data]
    .sort((a, b) => parseFecha(b.fecha) - parseFecha(a.fecha))
    .slice(0, 5)
    .map((r) => {
      const fecha = parseFecha(r.fecha);
      const ahora = new Date();
      const diffMs = ahora - fecha;
      const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutos = Math.floor(diffMs / (1000 * 60));

      let tiempoTexto;
      if (diffMinutos < 60) {
        tiempoTexto = `hace ${diffMinutos} min`;
      } else if (diffHoras < 24) {
        tiempoTexto = `hace ${diffHoras} h`;
      } else {
        const diffDias = Math.floor(diffHoras / 24);
        tiempoTexto = `hace ${diffDias} día${diffDias > 1 ? 's' : ''}`;
      }

      const detalle = `Plan ${r.tipo_suscripcion} · $${r.monto_venta}`;

      return {
        id: r.id,
        titulo: `Venta #${r.id} — ${r.tipo_suscripcion}`,
        detalle,
        tiempo: tiempoTexto,
        tipo: r.usuario_activo ? 'activo' : 'inactivo',
      };
    });

  // --- MRR, ARR, CAC, Churn ---
  const mrr =
    ventasPorMes.length > 0
      ? Math.round(ventasPorMes.reduce((a, b) => a + b, 0) / ventasPorMes.length)
      : 0;
  const arr = mrr * 12;
  const cac = Math.round(ticketPromedio * 0.3);
  const churn = totalRegistros > 0 ? (totalInactivos / totalRegistros) * 100 : 0;

  // --- Desglose por suscripción ---
  const basicCount = data.filter((r) => r.tipo_suscripcion === 'Basic').length;
  const proCount = data.filter((r) => r.tipo_suscripcion === 'Pro').length;
  const enterpriseCount = data.filter((r) => r.tipo_suscripcion === 'Enterprise').length;

  const planes = [
    { nombre: 'Basic', count: basicCount },
    { nombre: 'Pro', count: proCount },
    { nombre: 'Enterprise', count: enterpriseCount },
  ];
  const planTop = planes.reduce((max, p) => (p.count > max.count ? p : max), planes[0]);

  // --- KPIs, sparklines, donut según ROL ---
  let kpis, sparklines, donutData, salesData;

  if (role === 'founder') {
    kpis = [
      {
        label: 'Usuarios activos',
        value: totalActivos.toLocaleString(),
        change: `${Math.round((totalActivos / totalRegistros) * 100)}%`,
        changeDir: 'up',
        accent: 'blue',
      },
      {
        label: 'Ventas mensuales',
        value: `$${(ventasMesActual / 1000).toFixed(1)}K`,
        change: `${crecimiento >= 0 ? '+' : ''}${crecimiento.toFixed(1)}%`,
        changeDir: cambioDir,
        accent: 'green',
      },
      {
        label: 'Crecimiento',
        value: `${((totalActivos / totalRegistros) * 100).toFixed(1)}%`,
        change: `${crecimiento >= 0 ? '+' : ''}${crecimiento.toFixed(1)}%`,
        changeDir: cambioDir,
        accent: 'purple',
      },
      {
        label: 'Ticket promedio',
        value: `$${ticketPromedio.toLocaleString()}`,
        change: '+0%',
        changeDir: 'up',
        accent: 'orange',
      },
    ];

    sparklines = [1, 2, 3, 4].map(() => ventasPorMes.map((v) => Math.round(v / 1000)));
    donutData = { nuevos: 0, activos: totalActivos, inactivos: totalInactivos };
    salesData = ventasPorMes;
  } else if (role === 'team') {
    kpis = [
      {
        label: 'Total transacciones',
        value: totalRegistros.toLocaleString(),
        change: `${
          ultimosMeses.length > 0 ? '+' : ''
        }${Math.round(
          ventasPorMes.reduce((a, b) => a + b, 0) / (ultimosMeses.length || 1) / 100
        ).toFixed(0)}%`,
        changeDir: 'up',
        accent: 'blue',
      },
      {
        label: 'Plan más vendido',
        value: planTop.nombre,
        change: `${planTop.count} ventas`,
        changeDir: 'up',
        accent: 'green',
      },
      {
        label: 'Tasa de activos',
        value: `${Math.round((totalActivos / totalRegistros) * 100)}%`,
        change: `${(
          ((totalActivos - totalInactivos) / totalRegistros) *
          100
        ).toFixed(0)}%`,
        changeDir: totalActivos > totalInactivos ? 'up' : 'down',
        accent: 'purple',
      },
      {
        label: 'Promedio por cliente',
        value: `$${ticketPromedio.toLocaleString()}`,
        change: '+0%',
        changeDir: 'up',
        accent: 'orange',
      },
    ];

    sparklines = [
      ultimosMeses.map((clave) => porMes[clave].filter((r) => r.tipo_suscripcion === 'Basic').length),
      ultimosMeses.map((clave) => porMes[clave].filter((r) => r.tipo_suscripcion === 'Pro').length),
      ultimosMeses.map((clave) => porMes[clave].filter((r) => r.tipo_suscripcion === 'Enterprise').length),
      ventasPorMes.map((v) => Math.round(v / 100)),
    ];

    donutData = { nuevos: basicCount, activos: proCount, inactivos: enterpriseCount };
    salesData = ventasPorMes;
  } else {
    // investor
    kpis = [
      {
        label: 'MRR',
        value: `$${(mrr / 1000).toFixed(1)}K`,
        change: `$${mrr.toLocaleString()}`,
        changeDir: 'up',
        accent: 'blue',
      },
      {
        label: 'ARR',
        value: `$${(arr / 1000).toFixed(1)}K`,
        change: `+${Math.round(crecimiento)}%`,
        changeDir: 'up',
        accent: 'green',
      },
      {
        label: 'CAC',
        value: `$${cac}`,
        change: `-${Math.round(Math.random() * 5 + 3)}%`,
        changeDir: 'up',
        accent: 'purple',
      },
      {
        label: 'Churn',
        value: `${churn.toFixed(1)}%`,
        change: `+${churn.toFixed(1)}%`,
        changeDir: 'down',
        accent: 'orange',
      },
    ];

    sparklines = [
      ventasPorMes.map((v) => Math.round(v / 1000)),
      ventasPorMes.map((v) => Math.round((v * 12) / 1000)),
      ventasPorMes.map((v) => Math.round((v * 0.3) / 100)),
      ventasPorMes.map((v, i) => {
        const mes = ultimosMeses[i];
        const inactivosMes = mes ? porMes[mes].filter((r) => !r.usuario_activo).length : 0;
        const totalMes = mes ? porMes[mes].length : 1;
        return parseFloat(((inactivosMes / totalMes) * 100).toFixed(1));
      }),
    ];

    donutData = { nuevos: 0, activos: totalActivos, inactivos: totalInactivos };
    salesData = ventasPorMes;
  }

  return { kpis, sparklines, salesData, donutData, activity: actividad };
}

// ============================================================
// 5. RENDER
// ============================================================

/**
 * calcularYRenderizar()
 * Lee rol y período del store, computa métricas y renderiza todo.
 */
function calcularYRenderizar() {
  const { role, periodo } = store.getState();
  const resultado = computeDashboard(role, periodo);
  renderKPIs(resultado.kpis, resultado.sparklines);
  renderCharts(resultado.salesData, resultado.donutData);
  renderActivity(resultado.activity);
  actualizarTooltips();
}

/**
 * renderKPIs(kpis, sparklines)
 * Actualiza textos y sparklines de las 4 tarjetas KPI.
 */
function renderKPIs(kpis, sparklines) {
  const cards = document.querySelectorAll('.kpi-card');

  cards.forEach((card, i) => {
    const kpi = kpis[i];
    if (!kpi) return;

    const labelEl = card.querySelector('.kpi-label-text');
    if (labelEl) labelEl.textContent = kpi.label;

    const valueEl = card.querySelector('.kpi-value');
    if (valueEl) valueEl.textContent = kpi.value;

    const changeEl = card.querySelector('.kpi-change');
    if (changeEl) {
      changeEl.textContent = kpi.change;
      changeEl.classList.toggle('change-up', kpi.changeDir === 'up');
      changeEl.classList.toggle('change-down', kpi.changeDir !== 'up');
    }

    const sparkCanvas = card.querySelector('.sparkline');
    if (sparkCanvas && sparklines && sparklines[i]) {
      const color =
        getComputedStyle(document.documentElement)
          .getPropertyValue(`--accent-${kpi.accent}`)
          .trim() || '#3B82F6';
      renderSparkline(sparkCanvas, sparklines[i], color);
    }
  });
}

/**
 * renderSparkline(canvas, data, color)
 * Dibuja un minigráfico SVG de línea dentro de un div.
 * @param {HTMLElement} canvas — el div contenedor
 * @param {number[]}    data   — array de valores numéricos
 * @param {string}      color  — color CSS de la línea
 */
function renderSparkline(canvas, data, color) {
  if (!canvas || !data || data.length < 2) return;

  const w = canvas.clientWidth || 80;
  const h = canvas.clientHeight || 40;

  const max = Math.max(...data) * 1.2;
  const min = Math.min(...data) * 0.8;
  const range = max - min || 1;

  const padX = 2;
  const xScale = (i) => padX + (i / (data.length - 1)) * (w - padX * 2);
  const yScale = (v) => h - ((v - min) / range) * (h - 4) - 2;

  const points = data
    .map((v, i) => `${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`)
    .join(' ');

  const gradId = `sgrad_${color.replace('#', '')}_${Math.random().toString(36).slice(2, 6)}`;

  canvas.innerHTML = `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <path d="M${points} L${xScale(data.length - 1)},${h} L${xScale(0)},${h} Z"
            fill="url(#${gradId})"/>
      <path d="M${points}" fill="none" stroke="${color}" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

/**
 * renderCharts(salesData, donutData)
 * Dibuja el gráfico de líneas y el donut.
 */
function renderCharts(salesData, donutData) {
  renderLineChart(salesData);
  renderDonutChart(donutData);
}

/**
 * renderLineChart(data)
 * Dibuja el gráfico de líneas grande en "Ventas mensuales".
 */
function renderLineChart(data) {
  const container = document.getElementById('lineChart');
  if (!container || !data || data.length < 2) return;

  const w = container.clientWidth || 600;
  const h = 240;
  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const max = Math.max(...data) * 1.15;
  const min = Math.min(...data) * 0.85;
  const range = max - min || 1;

  const isDark = document.documentElement.classList.contains('dark');
  const gridColor = isDark ? '#334155' : '#E2E8F0';
  const textColor = isDark ? '#94A3B8' : '#64748B';
  const labelColor = isDark ? '#F8FAFC' : '#0F172A';
  const accent =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-blue')
      .trim() || '#3B82F6';

  const xScale = (i) => pad.left + (i / (data.length - 1)) * chartW;
  const yScale = (v) => pad.top + chartH - ((v - min) / range) * chartH;

  // Área rellena
  const fillPath =
    data
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(v)}`)
      .join(' ') +
    ` L${xScale(data.length - 1)},${pad.top + chartH}` +
    ` L${xScale(0)},${pad.top + chartH} Z`;

  container.innerHTML = `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="w-full h-full">
      <defs>
        <linearGradient id="lineFillDyn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${[0.25, 0.5, 0.75]
        .map((f) => {
          const yy = pad.top + chartH * (1 - f);
          return `<line x1="${pad.left}" y1="${yy}" x2="${w - pad.right}" y2="${yy}"
                    stroke="${gridColor}" stroke-width="1"/>`;
        })
        .join('')}
      <path d="${fillPath}" fill="url(#lineFillDyn)"/>
      <path d="M${data.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' ')}"
            fill="none" stroke="${accent}" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round"/>
      ${data
        .map(
          (v, i) =>
            `<circle cx="${xScale(i)}" cy="${yScale(v)}" r="3.5" fill="${accent}"
                     stroke="${isDark ? '#1E293B' : '#FFFFFF'}" stroke-width="2"/>`
        )
        .join('')}
      ${data
        .map(
          (_, i) =>
            `<text x="${xScale(i)}" y="${pad.top + chartH + 18}" text-anchor="middle"
                    fill="${textColor}" font-size="11">${NOMBRES_MESES[i] || ''}</text>`
        )
        .join('')}
      ${data
        .map(
          (v, i) =>
            `<text x="${xScale(i)}" y="${yScale(v) - 10}" text-anchor="middle"
                    fill="${labelColor}" font-size="10" font-weight="600">
              $${(v / 1000).toFixed(1)}K</text>`
        )
        .join('')}
    </svg>`;
}

/**
 * renderDonutChart(data)
 * Dibuja el gráfico de dona en "Usuarios".
 * data = { nuevos, activos, inactivos }
 */
function renderDonutChart(data) {
  const container = document.getElementById('donutChart');
  if (!container) return;

  const total = (data.activos || 0) + (data.inactivos || 0);
  if (total === 0) {
    container.innerHTML = '<p class="text-sm text-muted">Sin datos</p>';
    return;
  }

  const segmentos = [
    { label: 'Activos', value: data.activos || 0, color: '#10B981' },
    { label: 'Inactivos', value: data.inactivos || 0, color: '#64748B' },
  ];

  // Agregar "Nuevos" si existe
  if (data.nuevos && data.nuevos > 0) {
    segmentos.unshift({ label: 'Básicos', value: data.nuevos, color: '#3B82F6' });
  }

  const cx = 100, cy = 100, r = 70, sw = 25;
  let anguloAcumulado = -Math.PI / 2;

  const arcos = segmentos.map((seg) => {
    const fraccion = seg.value / total;
    const angulo = fraccion * 2 * Math.PI;
    const anguloInicio = anguloAcumulado;
    const anguloFin = anguloAcumulado + angulo;
    anguloAcumulado = anguloFin;

    const x1 = cx + r * Math.cos(anguloInicio);
    const y1 = cy + r * Math.sin(anguloInicio);
    const x2 = cx + r * Math.cos(anguloFin);
    const y2 = cy + r * Math.sin(anguloFin);
    const arcoGrande = angulo > Math.PI ? 1 : 0;

    return { ...seg, x1, y1, x2, y2, arcoGrande, color: seg.color };
  });

  container.innerHTML = `
    <svg width="200" height="200" viewBox="0 0 200 200">
      ${arcos
        .map(
          (a) => `
        <path d="M ${a.x1} ${a.y1} A ${r} ${r} 0 ${a.arcoGrande} 1 ${a.x2} ${a.y2}"
              fill="none" stroke="${a.color}" stroke-width="${sw}" stroke-linecap="round"/>
      `
        )
        .join('')}
      <text x="${cx}" y="${cy - 5}" text-anchor="middle" class="svg-text-center"
            font-size="28" font-weight="800">${total.toLocaleString()}</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="svg-text-muted"
            font-size="11">total</text>
    </svg>
    <div class="flex gap-4 mt-2 flex-wrap justify-center">
      ${segmentos
        .map(
          (s) => `
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full" style="background:${s.color}"></span>
          <span class="text-muted text-xs">
            ${s.label}
            <span class="svg-text-center font-medium">${Math.round(
              (s.value / total) * 100
            )}%</span>
          </span>
        </div>
      `
        )
        .join('')}
    </div>`;
}

/**
 * renderActivity(activity)
 * Llena la lista <ul id="activityList"> con datos de la API.
 * Soporta tanto #activityBody (tabla) como #activityList (ul).
 */
function renderActivity(activity) {
  // Intentar con tabla primero, luego ul como fallback
  const tbody = document.getElementById('activityBody');
  const ul = document.getElementById('activityList');
  
  if (!tbody && !ul) return;

  const emptyMsg = `
    <tr class="text-center"><td colspan="3" class="px-6 py-8 text-sm text-muted">No hay actividad reciente</td></tr>`;

  if (!activity || activity.length === 0) {
    if (tbody) tbody.innerHTML = emptyMsg;
    return;
  }

  const rows = activity.map(item => {
    return `<tr class="activity-row cursor-pointer" data-id="${item.id}">
      <td class="px-6 py-4">
        <div class="flex items-center gap-3">
          <span class="w-2 h-2 rounded-full flex-shrink-0 activity-dot-${item.tipo}" aria-hidden="true"></span>
          <span class="font-medium text-sm truncate">${item.titulo}</span>
        </div>
      </td>
      <td class="px-6 py-4 text-sm text-muted">${item.detalle}</td>
      <td class="px-6 py-4 text-sm text-muted text-right whitespace-nowrap">${item.tiempo}</td>
    </tr>`;
  }).join('');

  if (tbody) tbody.innerHTML = rows;
  if (ul) {
    ul.innerHTML = activity.map(item => `
      <li class="activity-row flex items-center gap-4 px-6 py-4 cursor-pointer" data-id="${item.id}">
        <span class="w-2 h-2 rounded-full flex-shrink-0 activity-dot-${item.tipo}" aria-hidden="true"></span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">${item.titulo}</p>
          <p class="text-xs text-muted">${item.detalle}</p>
        </div>
        <span class="text-xs flex-shrink-0 text-muted">${item.tiempo}</span>
      </li>
    `).join('');
  }
}

/**
 * actualizarTooltips()
 * Sincroniza el texto de los tooltips con la métrica que muestra cada KPI.
 */
function actualizarTooltips() {
  document.querySelectorAll('.kpi-card').forEach((card) => {
    const labelEl = card.querySelector('.kpi-label-text');
    const trigger = card.querySelector('.tooltip-trigger');
    if (!labelEl || !trigger) return;
    const tip = trigger.querySelector('.tooltip-content');
    if (!tip) return;
    tip.textContent = tooltips[labelEl.textContent] || 'Información de esta métrica';
  });
}

// ============================================================
// 6. UI / EVENT LISTENERS
// ============================================================

/**
 * setTheme(theme)
 * Cambia entre modo oscuro y claro.
 * Persiste en localStorage y re-renderiza charts (cambian colores).
 */
function setTheme(theme) {
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

/**
 * setRole(role)
 * Cambia el rol activo, actualiza UI y recalcula dashboard.
 */
function setRole(role) {
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

/**
 * toggleSidebar()
 * Abre/cierra la sidebar en mobile.
 */
function toggleSidebar() {
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

/**
 * setPeriodo(periodo)
 * Cambia el filtro temporal y recalcula dashboard.
 */
function setPeriodo(periodo) {
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

/**
 * openModal(id)
 * Muestra el modal con detalle de una transacción.
 */
function openModal(id) {
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
        <span class="font-medium subscription-color" data-plan="${item.tipo_suscripcion}">${item.tipo_suscripcion}</span>
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
function closeModal() {
  const modal = document.getElementById('detailModal');
  if (modal) modal.classList.add('hidden');
}

/**
 * setupTooltips()
 * Conecta eventos mouseenter/mouseleave a los tooltips.
 */
function setupTooltips() {
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

/**
 * mostrarLoading(visible)
 * Muestra/oculta la pantalla de carga.
 */
function mostrarLoading(visible) {
  const loader = document.getElementById('loadingState');
  const content = document.getElementById('dashboardContent');
  if (loader) loader.classList.toggle('hidden', !visible);
  if (content) content.classList.toggle('hidden', visible);
}

/**
 * mostrarError(mensaje)
 * Muestra pantalla de error con mensaje.
 */
function mostrarError(mensaje) {
  const errorEl = document.getElementById('errorState');
  const content = document.getElementById('dashboardContent');
  if (errorEl) {
    errorEl.classList.remove('hidden');
    const msgEl = errorEl.querySelector('.error-message');
    if (msgEl) msgEl.textContent = mensaje;
  }
  if (content) content.classList.add('hidden');
}

/**
 * exportToCSV()
 * Genera y descarga un archivo CSV con los datos actuales.
 * Usa los mismos filtros que computeDashboard (vía obtenerDatosFiltrados).
 */
function exportToCSV() {
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

/**
 * filterByDateRange(start, end)
 * Filtra los datos por un rango de fechas.
 * @param {Date|null} start — fecha de inicio (incluída)
 * @param {Date|null} end   — fecha de fin (incluída)
 */
function filterByDateRange(start, end) {
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
function filterByPlan(plan) {
  store.setState({ planFilter: plan || null });
  calcularYRenderizar();
}

/**
 * clearFilters()
 * Limpia todos los filtros avanzados.
 */
function clearFilters() {
  store.setState({
    dateRangeStart: null,
    dateRangeEnd: null,
    planFilter: null,
  });
  calcularYRenderizar();
}

/**
 * setupDownloadReport()
 * Simula la descarga de un reporte semanal con feedback visual en el botón
 * y un toast de confirmación.
 */
function setupDownloadReport() {
  const btn = document.getElementById('downloadReportBtn');
  if (!btn) return;

  btn.addEventListener('click', function () {
    // 1. Cambiar estado a "Cargando..."
    const textoOriginal = this.textContent;
    this.textContent = 'Cargando...';
    this.disabled = true;

    // 2. Simular carga de 1.5s
    setTimeout(() => {
      // 3. Mostrar mensaje de éxito
      this.textContent = '✅ Descargado';
      
      // 4. Crear toast de éxito
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50 modal-body border border-theme';
      toast.textContent = 'Reporte semanal generado correctamente';
      document.body.appendChild(toast);

      // 5. Restaurar botón después de 2s
      setTimeout(() => {
        this.textContent = textoOriginal;
        this.disabled = false;
        toast.remove();
      }, 2000);
    }, 1500);
  });
}

/**
 * setupEventListeners(fetchDashboardData)
 * Configura todos los event listeners del dashboard.
 * Recibe fetchDashboardData como parámetro para evitar
 * dependencia circular entre módulos.
 *
 * @param {Function} fetchDashboardData — función de fetch con retry
 */
function setupEventListeners(fetchDashboardData) {
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

  // --- Modal: clic en actividad reciente (tabla o lista) ---
  ['activityList', 'activityBody'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        const row = e.target.closest('.activity-row');
        if (row && row.dataset.id) openModal(row.dataset.id);
      });
    }
  });

  // --- Botón de exportar CSV (preparado para cuando exista en HTML) ---
  const exportBtn = document.getElementById('exportCsvBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToCSV);
  }

  // --- Botón de descargar reporte semanal ---
  setupDownloadReport();

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

// ============================================================
// 7. API / FETCH
// ============================================================

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
async function fetchDashboardData() {
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

// ============================================================
// 8. INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Configurar todos los event listeners del dashboard
  //    Pasamos fetchDashboardData para evitar dep. circular
  setupEventListeners(fetchDashboardData);

  // 2. Iniciar carga de datos desde Mockaroo
  fetchDashboardData();
});
