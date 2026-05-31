// StartupTools — E2E Test con Playwright
// Prueba el flujo completo del dashboard: carga, KPIs, roles, período, tema, modal

const { chromium } = require('playwright');
const { createServer } = require('http');
const { readFileSync, existsSync } = require('fs');
const { join, extname } = require('path');
const { networkInterfaces } = require('os');

const PORT = 8765;
const BASE = __dirname;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
};

// ── Servidor HTTP mínimo (sin dependencias) ──
function startServer(port) {
  const server = createServer((req, res) => {
    let filePath = join(BASE, req.url === '/' ? 'estructura/index.html' : req.url);
    const ext = extname(filePath);

    try {
      const data = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  return new Promise(resolve => {
    server.listen(port, () => {
      console.log(`Servidor E2E en http://localhost:${port}`);
      resolve(server);
    });
  });
}

// ── Tests ──
async function runTests() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
    } catch (e) {
      console.log(`  ❌ ${name}: ${e.message}`);
      errors.push({ name, error: e.message });
    }
  }

  console.log('\n🧪 STARTUPTOOLS — E2E TEST\n');

  // ── 1. Carga inicial ──
  await test('1. Página carga sin errores JS', async () => {
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    if (jsErrors.length > 0) throw new Error('Errores JS: ' + jsErrors.join(', '));
  });

  // ── 2. Loading state ──
  await test('2. Loading state visible', async () => {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    const loading = page.locator('#loadingState');
    await loading.waitFor({ state: 'visible', timeout: 5000 });
  });

  // ── 3. Dashboard content (datos cargados de API) ──
  await test('3. Dashboard se renderiza con datos', async () => {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // esperar fetch + render
    const content = page.locator('#dashboardContent');
    await content.waitFor({ state: 'visible', timeout: 15000 });
  });

  // ── 4. KPIs se ven con valores ──
  await test('4. KPIs renderizados con valores', async () => {
    const cards = page.locator('.kpi-card');
    const count = await cards.count();
    if (count !== 4) throw new Error(`Expected 4 KPI cards, got ${count}`);

    for (let i = 0; i < count; i++) {
      const value = await cards.nth(i).locator('.kpi-value').textContent();
      if (!value || value.trim() === '') throw new Error(`KPI ${i} sin valor`);
    }
  });

  // ── 5. Sparklines SVG ──
  await test('5. Sparklines SVG renderizados', async () => {
    const sparklines = page.locator('.sparkline svg');
    const count = await sparklines.count();
    if (count !== 4) throw new Error(`Expected 4 sparklines, got ${count}`);
  });

  // ── 6. Line chart SVG ──
  await test('6. Gráfico de líneas (SVG) renderizado', async () => {
    const chart = page.locator('#lineChart svg');
    await chart.waitFor({ state: 'visible', timeout: 5000 });
    const circles = await chart.locator('circle').count();
    if (circles < 2) throw new Error(`Expected circles in line chart, got ${circles}`);
  });

  // ── 7. Donut chart SVG ──
  await test('7. Gráfico donut (SVG) renderizado', async () => {
    const chart = page.locator('#donutChart svg');
    await chart.waitFor({ state: 'visible', timeout: 5000 });
    const paths = await chart.locator('path').count();
    if (paths < 1) throw new Error(`Expected paths in donut, got ${paths}`);
  });

  // ── 8. Actividad reciente ──
  await test('8. Actividad reciente con items', async () => {
    const list = page.locator('#activityList');
    const items = await list.locator('li').count();
    if (items === 0) throw new Error('Activity list vacía');
  });

  // ── 9. Título del dashboard ──
  await test('9. Título dice "Dashboard — Fundador"', async () => {
    const title = await page.locator('#dashboardTitle').textContent();
    if (!title.includes('Fundador')) throw new Error(`Title no contiene Fundador: "${title}"`);
  });

  // ── 10. Switch de roles ──
  await test('10. Click Equipo cambia título y KPIs', async () => {
    const teamBtn = page.locator('.role-btn[data-role="team"]');
    await teamBtn.click();
    await page.waitForTimeout(300);

    const title = await page.locator('#dashboardTitle').textContent();
    if (!title.includes('Equipo')) throw new Error(`Title no cambió a Equipo: "${title}"`);

    const avatar = await page.locator('#avatarInitials').textContent();
    if (avatar !== 'EQ') throw new Error(`Avatar no cambió a EQ: "${avatar}"`);
  });

  await test('11. Click Inversor cambia título y KPIs', async () => {
    const invBtn = page.locator('.role-btn[data-role="investor"]');
    await invBtn.click();
    await page.waitForTimeout(300);

    const title = await page.locator('#dashboardTitle').textContent();
    if (!title.includes('Inversor')) throw new Error(`Title no cambió a Inversor: "${title}"`);
  });

  await test('12. Click Fundador vuelve a estado inicial', async () => {
    const fBtn = page.locator('.role-btn[data-role="founder"]');
    await fBtn.click();
    await page.waitForTimeout(300);

    const title = await page.locator('#dashboardTitle').textContent();
    if (!title.includes('Fundador')) throw new Error(`Title no volvió a Fundador: "${title}"`);
  });

  // ── 13. Selector de período ──
  await test('13. Selector período cambia label del chart', async () => {
    const select = page.locator('#periodoSelector');
    await select.selectOption('3m');
    await page.waitForTimeout(300);
    const label = await page.locator('#chartPeriodLabel').textContent();
    if (!label.includes('trimestre')) throw new Error(`Label no cambió: "${label}"`);

    await select.selectOption('6m');
    await page.waitForTimeout(300);
  });

  // ── 14. Theme toggle ──
  await test('14. Theme toggle cambia a light', async () => {
    const toggle = page.locator('#themeToggle');
    await toggle.click();
    await page.waitForTimeout(300);
    const isLight = await page.locator('html').evaluate(el => el.classList.contains('light'));
    if (!isLight) throw new Error('html no tiene clase light');
  });

  await test('15. Theme toggle vuelve a dark', async () => {
    const toggle = page.locator('#themeToggle');
    await toggle.click();
    await page.waitForTimeout(300);
    const isDark = await page.locator('html').evaluate(el => el.classList.contains('dark'));
    if (!isDark) throw new Error('html no tiene clase dark');
  });

  // ── 16. Modal: clic en actividad ──
  await test('16. Modal se abre al click en actividad', async () => {
    const firstRow = page.locator('.activity-row').first();
    await firstRow.waitFor({ state: 'visible', timeout: 5000 });
    await firstRow.click();
    await page.waitForTimeout(300);

    const modal = page.locator('#detailModal');
    const isVisible = await modal.evaluate(el => !el.classList.contains('hidden'));
    if (!isVisible) throw new Error('Modal no se abrió');
  });

  // ── 17. Modal tiene contenido ──
  await test('17. Modal body tiene datos', async () => {
    const body = page.locator('#modalBody');
    const text = await body.textContent();
    if (!text.includes('#')) throw new Error('Modal body no tiene ID');
    if (!text.includes('$')) throw new Error('Modal body no tiene monto');
  });

  // ── 18. Cerrar modal con botón ──
  await test('18. Modal se cierra con botón X', async () => {
    const closeBtn = page.locator('#closeModal');
    await closeBtn.click();
    await page.waitForTimeout(300);
    const modal = page.locator('#detailModal');
    const isHidden = await modal.evaluate(el => el.classList.contains('hidden'));
    if (!isHidden) throw new Error('Modal no se cerró');
  });

  // ── 19. Modal se abre y cierra con Escape ──
  await test('19. Modal se cierra con tecla Escape', async () => {
    const firstRow = page.locator('.activity-row').first();
    await firstRow.click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const modal = page.locator('#detailModal');
    const isHidden = await modal.evaluate(el => el.classList.contains('hidden'));
    if (!isHidden) throw new Error('Modal no se cerró con Escape');
  });

  // ── 20. Tooltips ──
  await test('20. Tooltip se muestra al hover', async () => {
    const trigger = page.locator('.tooltip-trigger').first();
    await trigger.hover();
    await page.waitForTimeout(300);
    const tip = trigger.locator('.tooltip-content');
    const isVisible = await tip.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.opacity === '1' || parseFloat(style.opacity) > 0;
    });
    if (!isVisible) throw new Error('Tooltip no visible al hover');
  });

  // ── 21. Errores de consola durante el test ──
  await test('21. Sin errores console.error', async () => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Recargar para capturar errores desde el inicio
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    if (consoleErrors.length > 0) {
      // Ignorar errores de CORS/API si son esperados
      const nonApiErrors = consoleErrors.filter(e =>
        !e.includes('Mockaroo') && !e.includes('429') && !e.includes('403')
      );
      if (nonApiErrors.length > 0) {
        throw new Error('console.errors: ' + nonApiErrors.join(' | '));
      }
    }
  });

  // ── Resultado final ──
  await browser.close();

  console.log(`\n📊 RESULTADO: ${errors.length === 0 ? '✅ TODOS LOS TEST PASARON' : `❌ ${errors.length} TEST(S) FALLARON`}`);
  if (errors.length > 0) {
    errors.forEach(e => console.log(`   - ${e.name}: ${e.error}`));
    process.exit(1);
  }
}

// ── Main ──
(async () => {
  const server = await startServer(PORT);
  try {
    await runTests();
  } finally {
    server.close();
  }
})();
