// ============================================================
// render.js — Renderizado DOM y SVG del dashboard
// ============================================================

import { store } from './state.js';
import { computeDashboard, NOMBRES_MESES, tooltips, COLOR_SUSCRIPCION } from './compute.js';

// ============================================================
// ORQUESTADOR
// ============================================================

/**
 * calcularYRenderizar()
 * Lee rol y período del store, computa métricas y renderiza todo.
 */
export function calcularYRenderizar() {
  const { role, periodo } = store.getState();
  const resultado = computeDashboard(role, periodo);
  renderKPIs(resultado.kpis, resultado.sparklines);
  renderCharts(resultado.salesData, resultado.donutData);
  renderActivity(resultado.activity);
  actualizarTooltips();
}

// ============================================================
// KPI CARDS
// ============================================================

/**
 * renderKPIs(kpis, sparklines)
 * Actualiza textos y sparklines de las 4 tarjetas KPI.
 */
export function renderKPIs(kpis, sparklines) {
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

// ============================================================
// SPARKLINE (minigráfico SVG)
// ============================================================

/**
 * renderSparkline(canvas, data, color)
 * Dibuja un minigráfico SVG de línea dentro de un div.
 * @param {HTMLElement} canvas — el div contenedor
 * @param {number[]}    data   — array de valores numéricos
 * @param {string}      color  — color CSS de la línea
 */
export function renderSparkline(canvas, data, color) {
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

// ============================================================
// CHART — LINEA + DONUT
// ============================================================

/**
 * renderCharts(salesData, donutData)
 * Dibuja el gráfico de líneas y el donut.
 */
export function renderCharts(salesData, donutData) {
  renderLineChart(salesData);
  renderDonutChart(donutData);
}

/**
 * renderLineChart(data)
 * Dibuja el gráfico de líneas grande en "Ventas mensuales".
 */
export function renderLineChart(data) {
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
export function renderDonutChart(data) {
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
    <div class="donut-legend">
      ${segmentos
        .map(
          (s) => `
        <div class="donut-legend-item">
          <span class="legend-dot" style="background:${s.color}"></span>
          <span class="legend-label">
            ${s.label}
            <span class="legend-value">${Math.round(
              (s.value / total) * 100
            )}%</span>
          </span>
        </div>
      `
        )
        .join('')}
    </div>`;
}

// ============================================================
// ACTIVIDAD RECIENTE
// ============================================================

/**
 * renderActivity(activity)
 * Llena la lista <ul id="activityList"> con datos de la API.
 */
export function renderActivity(activity) {
  const container = document.getElementById('activityList');
  if (!container) return;

  if (!activity || activity.length === 0) {
    container.innerHTML = `
      <li class="activity-empty">
        No hay actividad reciente
      </li>`;
    return;
  }

  const colorPorTipo = {
    activo: 'var(--accent-green)',
    inactivo: 'var(--accent-orange)',
  };

  container.innerHTML = activity
    .map(
      (item) => `
    <li class="activity-row" data-id="${item.id}">
      <span class="status-dot"
            style="background:${colorPorTipo[item.tipo] || 'var(--accent-blue)'}"
            aria-hidden="true"></span>
      <div class="activity-details">
        <p class="activity-title">${item.titulo}</p>
        <p class="activity-meta">${item.detalle}</p>
      </div>
      <span class="activity-time">${item.tiempo}</span>
    </li>
  `
    )
    .join('');
}

// ============================================================
// TOOLTIPS — actualización de textos
// ============================================================

/**
 * actualizarTooltips()
 * Sincroniza el texto de los tooltips con la métrica que muestra cada KPI.
 */
export function actualizarTooltips() {
  document.querySelectorAll('.kpi-card').forEach((card) => {
    const labelEl = card.querySelector('.kpi-label-text');
    const trigger = card.querySelector('.tooltip-trigger');
    if (!labelEl || !trigger) return;
    const tip = trigger.querySelector('.tooltip-content');
    if (!tip) return;
    tip.textContent = tooltips[labelEl.textContent] || 'Información de esta métrica';
  });
}
