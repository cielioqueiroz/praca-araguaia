// Print e auditoria das telas — desktop e CELULAR DE VERDADE.
//
// Por que existe: o Chrome headless no Windows tem largura mínima de ~500px, então
// "testar mobile" com --window-size mente (corta o layout e inventa overflow). Aqui a
// emulação é a do Playwright (iPhone 13: 390px, touch, DPR 3), que é o que o público
// deste site usa — 100% dele chega pelo celular.
//
// Não baixa navegador: usa o Chromium que já está no cache do ms-playwright.
//
//   node scripts/telas.mjs "/,/cotacoes,/termometro" mobile
//   node scripts/telas.mjs "/" desktop
//
// Além do print, ele acusa os dois defeitos que só aparecem no telefone: página que
// rola na horizontal e alvo de toque baixo demais para o dedo.

import { mkdirSync } from 'node:fs';
import { chromium, devices } from 'playwright-core';

const EXE = 'C:/Users/Cliente/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const BASE = 'http://localhost:3100';
const OUT = process.env.TELAS_OUT ?? '.telas';

const alvos = process.argv[2] ? process.argv[2].split(',') : ['/', '/cotacoes', '/termometro', '/praca/redencao'];
const perfil = process.argv[3] ?? 'mobile';

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext(
  perfil === 'mobile' ? devices['iPhone 13'] : { viewport: { width: 1440, height: 950 } },
);
const page = await ctx.newPage();

const problemas = [];
for (const rota of alvos) {
  const nome = (rota === '/' ? 'home' : rota.replace(/\//g, '-').replace(/^-/, '')) + `-${perfil}`;
  // 'load', não 'networkidle': o /boletim desenha um PNG de ~8s na própria rota e a
  // rede nunca fica ociosa — com networkidle o print morria de timeout numa página
  // que, no navegador, abre normalmente.
  await page.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
  // Rolar até o fim: as entradas com whileInView (framer) só disparam ao rolar, e um
  // print sem rolagem mostra bloco branco que não existe no navegador de verdade.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);

  // O defeito clássico do mobile: algo mais largo que a tela.
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const culpados = [];
    if (doc.scrollWidth > doc.clientWidth + 1) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width > doc.clientWidth + 1 || r.right > doc.clientWidth + 1) {
          culpados.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} (${Math.round(r.width)}px, right ${Math.round(r.right)})`);
        }
        if (culpados.length > 6) break;
      }
    }
    return { largura: doc.scrollWidth, tela: doc.clientWidth, culpados };
  });
  if (overflow.largura > overflow.tela + 1) {
    problemas.push(`${rota}: rola na horizontal (${overflow.largura}px em tela de ${overflow.tela}px) → ${overflow.culpados.join(' | ')}`);
  }

  // Alvos de toque pequenos demais (WCAG: 24px; recomendado 44px).
  const alvosPequenos = await page.evaluate(() => {
    const ruins = [];
    for (const el of document.querySelectorAll('a, button, input, select')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 24) ruins.push(`${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 24)}" ${Math.round(r.height)}px`);
    }
    return ruins.slice(0, 8);
  });
  if (alvosPequenos.length) problemas.push(`${rota}: alvo de toque baixo → ${alvosPequenos.join(' | ')}`);

  await page.screenshot({ path: `${OUT}/${nome}.png`, fullPage: perfil === 'mobile' });
  console.log(`ok ${rota} → ${nome}.png`);
}

await browser.close();
console.log(problemas.length ? 'PROBLEMAS:\n' + problemas.join('\n') : 'sem overflow horizontal nem alvo de toque baixo');
