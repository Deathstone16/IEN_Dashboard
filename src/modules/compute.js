// ============================================================
// compute.js — Cómputo de métricas del dashboard
// Transforma datos crudos en KPIs, gráficos y actividad
// ============================================================

import { store } from './state.js';

// ---- CONSTANTES ----

/** Mensajes de ayuda para tooltips de cada KPI */
export const tooltips = {
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
export const NOMBRES_MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

/** Colores asignados a cada tipo de suscripción */
export const COLOR_SUSCRIPCION = {
  Basic: '#3B82F6',       // azul
  Pro: '#10B981',         // verde
  Enterprise: '#8B5CF6',  // púrpura
};

// ---- HELPERS DE FECHAS ----

/**
 * parseFecha(fechaStr)
 * Convierte "M/d/yyyy" a objeto Date de JavaScript.
 */
export function parseFecha(fechaStr) {
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
export function agruparPorMes(data) {
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
export function ordenarClavesPorFecha(claves) {
  return [...claves].sort();
}

/**
 * obtenerDatosFiltrados()
 * Aplica los filtros del store (dateRangeStart, dateRangeEnd, planFilter)
 * sobre rawData. Devuelve el array filtrado (o rawData si no hay filtros).
 */
export function obtenerDatosFiltrados() {
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

// ---- CÓMPUTO PRINCIPAL ----

/**
 * computeDashboard(role, period)
 * Calcula KPIs, sparklines, charts y actividad según rol y período.
 *
 * @param {string} role   — 'founder' | 'team' | 'investor'
 * @param {string} period — '1m' | '3m' | '6m' | '12m'
 * @returns {{ kpis, sparklines, salesData, donutData, activity }}
 */
export function computeDashboard(role, period) {
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
