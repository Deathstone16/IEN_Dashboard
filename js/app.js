// ============================================================
// STARTUPTOOLS — APP
// ============================================================
// Archivo único consolidado de todo el JavaScript del dashboard.
// Clases semánticas en español.
// ============================================================

// ============================================================
// 1. STATE
// ============================================================

function createStore(initialState) {
  let state = { ...initialState };
  const listeners = new Set();

  return {
    getState() {
      return state;
    },

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

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const initialState = {
  theme: 'dark',
  role: 'founder',
  periodo: '6m',
  sidebarOpen: true,
  rawData: [],
  loading: true,
  error: null,
  dateRangeStart: null,
  dateRangeEnd: null,
  planFilter: null,
};

const store = createStore(initialState);

// ============================================================
// 2. CONSTANTS
// ============================================================

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

const NOMBRES_MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const COLOR_SUSCRIPCION = {
  Basic: '#3B82F6',
  Pro: '#10B981',
  Enterprise: '#8B5CF6',
};

// ============================================================
// 3. UTILS
// ============================================================

function formatCurrency(value) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function formatPercentage(value) {
  const signo = value >= 0 ? '+' : '';
  return `${signo}${value.toFixed(1)}%`;
}

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

function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

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
// 4. COMPUTE
// ============================================================

function parseFecha(fechaStr) {
  const partes = fechaStr.split('/');
  return new Date(
    parseInt(partes[2]),
    parseInt(partes[0]) - 1,
    parseInt(partes[1])
  );
}

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

function ordenarClavesPorFecha(claves) {
  return [...claves].sort();
}

function obtenerDatosFiltrados() {
  const { rawData, dateRangeStart, dateRangeEnd, planFilter } = store.getState();
  if (!rawData || rawData.length === 0) return [];

  if (!dateRangeStart && !dateRangeEnd && !planFilter) {
    return rawData;
  }

  return rawData.filter((item) => {
    if (dateRangeStart || dateRangeEnd) {
      const fechaItem = parseFecha(item.fecha);
      if (dateRangeStart && fechaItem < dateRangeStart) return false;
      if (dateRangeEnd && fechaItem > dateRangeEnd) return false;
    }
    if (planFilter && item.tipo_suscripcion !== planFilter) return false;
    return true;
  });
}

function computeDashboard(role, period) {
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

  const porMes = agruparPorMes(data);
  const mesesOrdenados = ordenarClavesPorFecha(Object.keys(porMes));
  const periodCount = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 };
  const count = periodCount[period] || 6;
  const ultimosMeses = mesesOrdenados.slice(-count);

  const ventasPorMes = ultimosMeses.map((clave) =>
    porMes[clave].reduce((sum, r) => sum + r.monto_venta, 0)
  );

  const totalActivos = data.filter((r) => r.usuario_activo === true).length;
  const totalInactivos = data.filter((r) => r.usuario_activo === false).length;
  const ventasTotales = data.reduce((sum, r) => sum + r.monto_venta, 0);
  const totalRegistros = data.length;
  const ticketPromedio = totalRegistros > 0 ? Math.round(ventasTotales / totalRegistros) : 0;

  const mesActual = ultimosMeses[ultimosMeses.length - 1];
  const ventasMesActual = mesActual
    ? porMes[mesActual].reduce((sum, r) => sum + r.monto_venta, 0)
    : 0;
  const mesAnterior = ultimosMeses.length >= 2 ? ultimosMeses[ultimosMeses.length - 2] : null;
  const ventasMesAnterior = mesAnterior
    ? porMes[mesAnterior].reduce((sum, r) => sum + r.monto_venta, 0)
    : 0;

  let crecimiento = 0;
  let cambioDir = 'up';
  if (ventasMesAnterior > 0) {
    crecimiento = ((ventasMesActual - ventasMesAnterior) / ventasMesAnterior) * 100;
    cambioDir = crecimiento >= 0 ? 'up' : 'down';
  }

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

  const mrr =
    ventasPorMes.length > 0
      ? Math.round(ventasPorMes.reduce((a, b) => a + b, 0) / ventasPorMes.length)
      : 0;
  const arr = mrr * 12;
  const cac = Math.round(ticketPromedio * 0.3);
  const churn = totalRegistros > 0 ? (totalInactivos / totalRegistros) * 100 : 0;

  const basicCount = data.filter((r) => r.tipo_suscripcion === 'Basic').length;
  const proCount = data.filter((r) => r.tipo_suscripcion === 'Pro').length;
  const enterpriseCount = data.filter((r) => r.tipo_suscripcion === 'Enterprise').length;

  const planes = [
    { nombre: 'Basic', count: basicCount },
    { nombre: 'Pro', count: proCount },
    { nombre: 'Enterprise', count: enterpriseCount },
  ];
  const planTop = planes.reduce((max, p) => (p.count > max.count ? p : max), planes[0]);

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

function calcularYRenderizar() {
  const { role, periodo } = store.getState();
  const resultado = computeDashboard(role, periodo);
  renderKPIs(resultado.kpis, resultado.sparklines);
  renderCharts(resultado.salesData, resultado.donutData);
  renderActivity(resultado.activity);
  actualizarTooltips();
}

function renderKPIs(kpis, sparklines) {
  const cards = document.querySelectorAll('.tarjeta-kpi');

  cards.forEach((card, i) => {
    const kpi = kpis[i];
    if (!kpi) return;

    const labelEl = card.querySelector('.etiqueta-kpi');
    if (labelEl) labelEl.textContent = kpi.label;

    const valueEl = card.querySelector('.valor-kpi');
    if (valueEl) valueEl.textContent = kpi.value;

    const changeEl = card.querySelector('.cambio-kpi');
    if (changeEl) {
      changeEl.textContent = kpi.change;
      changeEl.classList.toggle('cambio-positivo', kpi.changeDir === 'up');
      changeEl.classList.toggle('cambio-negativo', kpi.changeDir !== 'up');
    }

    const sparkCanvas = card.querySelector('.minigrafico');
    if (sparkCanvas && sparklines && sparklines[i]) {
      const color =
        getComputedStyle(document.documentElement)
          .getPropertyValue(`--accent-${kpi.accent}`)
          .trim() || '#3B82F6';
      renderSparkline(sparkCanvas, sparklines[i], color);
    }
  });
}

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

function renderCharts(salesData, donutData) {
  renderLineChart(salesData);
  renderDonutChart(donutData);
}

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

  const fillPath =
    data
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(v)}`)
      .join(' ') +
    ` L${xScale(data.length - 1)},${pad.top + chartH}` +
    ` L${xScale(0)},${pad.top + chartH} Z`;

  container.innerHTML = `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="width:100%;height:100%">
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

function renderDonutChart(data) {
  const container = document.getElementById('donutChart');
  if (!container) return;

  const total = (data.activos || 0) + (data.inactivos || 0);
  if (total === 0) {
    container.innerHTML = '<p class="grafico-dona__vacio">Sin datos</p>';
    return;
  }

  const segmentos = [
    { label: 'Activos', value: data.activos || 0, color: '#10B981' },
    { label: 'Inactivos', value: data.inactivos || 0, color: '#64748B' },
  ];

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
      <text x="${cx}" y="${cy - 5}" text-anchor="middle" class="svg-texto-centro"
            font-size="28" font-weight="800">${total.toLocaleString()}</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="svg-texto-secundario"
            font-size="11">total</text>
    </svg>
    <div class="grafico-dona__leyenda">
      ${segmentos
        .map(
          (s) => `
        <div class="grafico-dona__leyenda-item">
          <span class="grafico-dona__punto" style="background:${s.color}"></span>
          <span class="grafico-dona__leyenda-texto">
            ${s.label}
            <span class="grafico-dona__porcentaje">${Math.round(
              (s.value / total) * 100
            )}%</span>
          </span>
        </div>
      `
        )
        .join('')}
    </div>`;
}

function renderActivity(activity) {
  const tbody = document.getElementById('activityBody');
  if (!tbody) return;

  if (!activity || activity.length === 0) {
    tbody.innerHTML = '<tr class="fila-vacia"><td colspan="3">No hay actividad reciente</td></tr>';
    return;
  }

  const rows = activity.map(item => {
    const dotClass = item.tipo === 'activo' ? 'punto-activo' : 'punto-inactivo';
    return `<tr class="fila-actividad" data-id="${item.id}">
      <td class="fila-actividad__celda">
        <div class="fila-actividad__transaccion">
          <span class="${dotClass}" aria-hidden="true"></span>
          <span class="fila-actividad__titulo">${item.titulo}</span>
        </div>
      </td>
      <td class="fila-actividad__celda fila-actividad__detalle">${item.detalle}</td>
      <td class="fila-actividad__celda fila-actividad__tiempo">${item.tiempo}</td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rows;
}

function actualizarTooltips() {
  document.querySelectorAll('.tarjeta-kpi').forEach((card) => {
    const labelEl = card.querySelector('.etiqueta-kpi');
    const trigger = card.querySelector('.disparador-tooltip');
    if (!labelEl || !trigger) return;
    const tip = trigger.querySelector('.contenido-tooltip');
    if (!tip) return;
    tip.textContent = tooltips[labelEl.textContent] || 'Información de esta métrica';
  });
}

// ============================================================
// 6. UI / EVENT LISTENERS
// ============================================================

function setTheme(theme) {
  store.setState({ theme });
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.classList.toggle('light', theme !== 'dark');

  const sun = document.querySelector('.icono-sol');
  const moon = document.querySelector('.icono-luna');
  if (theme === 'dark') {
    sun?.classList.add('oculto');
    moon?.classList.remove('oculto');
  } else {
    sun?.classList.remove('oculto');
    moon?.classList.add('oculto');
  }

  try {
    localStorage.setItem('startuptools_theme', theme);
  } catch (e) {
    // localStorage no disponible
  }

  const { role, periodo } = store.getState();
  const resultado = computeDashboard(role, periodo);
  renderCharts(resultado.salesData, resultado.donutData);
}

function setRole(role) {
  store.setState({ role });

  document.querySelectorAll('.boton-rol').forEach((btn) => {
    const activo = btn.dataset.role === role;
    btn.classList.toggle('rol-activo', activo);
    btn.classList.toggle('rol-inactivo', !activo);
  });

  const nombresRol = { founder: 'Fundador', team: 'Equipo', investor: 'Inversor' };
  const initialsRol = { founder: 'FD', team: 'EQ', investor: 'IN' };
  const titleEl = document.getElementById('dashboardTitle');
  const avatarEl = document.getElementById('avatarInitials');
  if (titleEl) titleEl.textContent = `Dashboard — ${nombresRol[role] || role}`;
  if (avatarEl) avatarEl.textContent = initialsRol[role] || 'ST';

  try {
    localStorage.setItem('startuptools_role', role);
  } catch (e) {
    // Sin fallback
  }

  calcularYRenderizar();
}

function toggleSidebar() {
  const { sidebarOpen } = store.getState();
  const nuevoEstado = !sidebarOpen;
  store.setState({ sidebarOpen: nuevoEstado });

  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (window.innerWidth < 1024) {
    if (sidebar) sidebar.classList.toggle('mobile-open', nuevoEstado);
    if (overlay) overlay.classList.toggle('oculto', !nuevoEstado);
    document.body.classList.toggle('overflow-hidden', nuevoEstado);
  }
}

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
      <div class="modal__fila">
        <span class="modal__fila-etiqueta">ID:</span>
        <span class="modal__fila-valor">#${item.id}</span>
      </div>
      <div class="modal__fila">
        <span class="modal__fila-etiqueta">Cliente:</span>
        <span class="modal__fila-valor">${clientes[item.id % clientes.length]}</span>
      </div>
      <div class="modal__fila">
        <span class="modal__fila-etiqueta">Fecha:</span>
        <span class="modal__fila-valor">${item.fecha}</span>
      </div>
      <div class="modal__fila">
        <span class="modal__fila-etiqueta">Plan:</span>
        <span class="color-suscripcion modal__fila-valor" data-plan="${item.tipo_suscripcion}">${item.tipo_suscripcion}</span>
      </div>
      <div class="modal__fila">
        <span class="modal__fila-etiqueta">Monto:</span>
        <span class="modal__fila-valor">$${item.monto_venta.toLocaleString()}</span>
      </div>
      <div class="modal__fila">
        <span class="modal__fila-etiqueta">Gateway:</span>
        <span class="modal__fila-valor">${gateways[item.id % gateways.length]}</span>
      </div>
      <div class="modal__fila">
        <span class="modal__fila-etiqueta">Usuario activo:</span>
        <span class="modal__fila-valor ${item.usuario_activo ? 'cambio-positivo' : 'cambio-negativo'}">${item.usuario_activo ? 'Sí' : 'No'}</span>
      </div>
    `;
  }

  const modal = document.getElementById('detailModal');
  if (modal) modal.classList.remove('oculto');
}

function closeModal() {
  const modal = document.getElementById('detailModal');
  if (modal) modal.classList.add('oculto');
}

function setupTooltips() {
  document.querySelectorAll('.disparador-tooltip').forEach((el) => {
    el.addEventListener('mouseenter', function () {
      const tip = this.querySelector('.contenido-tooltip');
      if (tip) tip.classList.add('tooltip-visible');
    });
    el.addEventListener('mouseleave', function () {
      const tip = this.querySelector('.contenido-tooltip');
      if (tip) tip.classList.remove('tooltip-visible');
    });
  });
}

function mostrarLoading(visible) {
  const loader = document.getElementById('loadingState');
  const content = document.getElementById('dashboardContent');
  if (loader) loader.classList.toggle('oculto', !visible);
  if (content) content.classList.toggle('oculto', visible);
}

function mostrarError(mensaje) {
  const errorEl = document.getElementById('errorState');
  const content = document.getElementById('dashboardContent');
  if (errorEl) {
    errorEl.classList.remove('oculto');
    const msgEl = errorEl.querySelector('.mensaje-error');
    if (msgEl) msgEl.textContent = mensaje;
  }
  if (content) content.classList.add('oculto');
}

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

  const dataForExport = data.map((item) => ({
    ...item,
    usuario_activo: item.usuario_activo ? 'Sí' : 'No',
  }));

  const csv = generateCSV(dataForExport, columns);
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadFile(csv, `startuptools_export_${timestamp}.csv`);
}

function filterByDateRange(start, end) {
  store.setState({
    dateRangeStart: start || null,
    dateRangeEnd: end || null,
  });
  calcularYRenderizar();
}

function filterByPlan(plan) {
  store.setState({ planFilter: plan || null });
  calcularYRenderizar();
}

function clearFilters() {
  store.setState({
    dateRangeStart: null,
    dateRangeEnd: null,
    planFilter: null,
  });
  calcularYRenderizar();
}

function setupDownloadReport() {
  const btn = document.getElementById('downloadReportBtn');
  if (!btn) return;

  btn.addEventListener('click', function () {
    const textoOriginal = this.textContent;
    this.textContent = 'Cargando...';
    this.disabled = true;

    setTimeout(() => {
      this.textContent = '✅ Descargado';

      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = 'Reporte semanal generado correctamente';
      document.body.appendChild(toast);

      setTimeout(() => {
        this.textContent = textoOriginal;
        this.disabled = false;
        toast.remove();
      }, 2000);
    }, 1500);
  });
}

function setupEventListeners(fetchDashboardData) {
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
    setTheme('dark');
    setRole('founder');
  }

  setupTooltips();

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const { theme } = store.getState();
      setTheme(theme === 'dark' ? 'light' : 'dark');
    });
  }

  const sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', toggleSidebar);
  }
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', toggleSidebar);
  }

  document.querySelectorAll('.boton-rol').forEach((btn) => {
    btn.addEventListener('click', () => setRole(btn.dataset.role));
  });

  const retryBtn = document.getElementById('retryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', fetchDashboardData);
  }

  const periodoSelector = document.getElementById('periodoSelector');
  if (periodoSelector) {
    periodoSelector.addEventListener('change', (e) => {
      setPeriodo(e.target.value);
    });
  }

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

  const activityBody = document.getElementById('activityBody');
  if (activityBody) {
    activityBody.addEventListener('click', (e) => {
      const row = e.target.closest('.fila-actividad');
      if (row && row.dataset.id) openModal(row.dataset.id);
    });
  }

  const exportBtn = document.getElementById('exportCsvBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToCSV);
  }

  setupDownloadReport();

  let resizeTimer;
  window.addEventListener('resize', () => {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth >= 1024) {
      if (sidebar) sidebar.classList.remove('mobile-open');
      const overlay = document.getElementById('sidebarOverlay');
      if (overlay) overlay.classList.add('oculto');
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

const API_URL = 'https://my.api.mockaroo.com/dashboard.json?key=c6b83760';

const MAX_RETRIES = 3;
const BASE_DELAY = 2000;

async function fetchConRetry(url, retries = MAX_RETRIES, baseDelay = BASE_DELAY) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const respuesta = await fetch(url);

      if (respuesta.ok) {
        return await respuesta.json();
      }

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

      throw new Error(
        `Error HTTP ${respuesta.status}: el servidor respondió con un código de error`
      );

    } catch (error) {
      lastError = error;

      if (attempt === retries) {
        throw error;
      }

      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.warn(
          `Intento ${attempt}/${retries}: Error de red. Reintentando en ${baseDelay * Math.pow(2, attempt - 1) / 1000}s...`
        );
      } else {
        console.warn(
          `Intento ${attempt}/${retries}: ${error.message}. Reintentando en ${baseDelay * Math.pow(2, attempt - 1) / 1000}s...`
        );
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Error desconocido al cargar los datos');
}

async function fetchDashboardData() {
  store.setState({ loading: true, error: null });
  mostrarLoading(true);

  try {
    const datosCrudos = await fetchConRetry(API_URL);

    if (!Array.isArray(datosCrudos) || datosCrudos.length === 0) {
      throw new Error('La API devolvió datos vacíos o con formato incorrecto');
    }

    store.setState({
      rawData: datosCrudos,
      loading: false,
      error: null,
    });

    mostrarLoading(false);

    try {
      calcularYRenderizar();
    } catch (renderError) {
      console.error('Error al renderizar:', renderError);
      throw new Error('Error al dibujar el dashboard: ' + renderError.message);
    }

  } catch (error) {
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
  setupEventListeners(fetchDashboardData);
  fetchDashboardData();
});
