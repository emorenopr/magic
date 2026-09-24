#!/usr/bin/env node
// Paso 3: genera una landing de propuesta + email por cada prospecto, y un
// panel (propuestas/index.html) para revisarlos y copiar los emails.
//
//   node prospector/generate.js                  (textos por plantilla, gratis)
//   node prospector/generate.js --ia             (textos a la medida con Claude; necesita ANTHROPIC_API_KEY)
//   node prospector/generate.js --min 40         (solo prospectos con 40+ puntos; por defecto 30)
//   node prospector/generate.js --ia --refrescar (vuelve a pedir textos a Claude aunque ya existan)

const fs = require("fs");
const path = require("path");
const { ROOT, DATA_DIR, readJson, writeJson, escapeHtml: e, parseArgs } = require("./lib/util");
const { pickPreset } = require("./lib/presets");
const { defaultCopy, aiCopy, buildEmail } = require("./lib/copy");
const { renderLanding } = require("./lib/landing");

const OUT_DIR = path.resolve(ROOT, "..", "propuestas");

function renderDashboard(items, config) {
  const rows = items
    .map((it, i) => {
      const status = it.lead.audit.status;
      const badge = status === "sin-web" ? "Sin web" : status === "caida" ? "Web caída" : `${it.lead.audit.score} pts`;
      const mailto = it.lead.email
        ? `mailto:${encodeURIComponent(it.lead.email)}?subject=${encodeURIComponent(it.email.subject)}&body=${encodeURIComponent(it.email.body)}`
        : "";
      return `
      <article class="lead">
        <div class="top">
          <span class="badge ${status}">${e(badge)}</span>
          <h2>${e(it.lead.nombre)}</h2>
          <span class="meta">${e(it.preset.label)}${it.lead.ciudad ? ` · ${e(it.lead.ciudad)}` : ""} · textos: ${e(it.copy.source)}</span>
        </div>
        <ul class="reasons">${it.lead.audit.reasons.map((r) => `<li>${e(r)}</li>`).join("")}</ul>
        <div class="links">
          <a class="btn" href="${e(it.lead.slug)}/" target="_blank">Ver propuesta</a>
          ${it.lead.web ? `<a href="${e(it.lead.audit.finalUrl || it.lead.web)}" target="_blank" rel="noopener">Web actual</a>` : ""}
          ${it.lead.telefono ? `<a href="tel:${e(it.lead.telefono)}">📞 ${e(it.lead.telefono)}</a>` : ""}
          ${mailto ? `<a href="${e(mailto)}">✉️ Abrir email</a>` : `<span class="muted">sin email</span>`}
        </div>
        <details>
          <summary>Email: ${e(it.email.subject)}</summary>
          <pre id="mail-${i}">${e(it.email.body)}</pre>
          <button type="button" data-copy="mail-${i}">Copiar texto</button>
        </details>
      </article>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Panel de propuestas</title>
  <style>
    :root { --bg: #f4f5f7; --surface: #fff; --ink: #161a22; --muted: #5d6573; --line: #e2e5ea; --accent: #3b5bdb; }
    @media (prefers-color-scheme: dark) { :root { --bg: #111418; --surface: #1a1f26; --ink: #eef1f5; --muted: #9aa3b1; --line: #2a313b; --accent: #7c95f5; } }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: system-ui, sans-serif; line-height: 1.5; }
    .wrap { max-width: 900px; margin: 0 auto; padding: 32px 16px 80px; }
    h1 { margin: 0 0 4px; }
    .sub { color: var(--muted); margin: 0 0 24px; }
    .lead { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 18px; margin-bottom: 14px; }
    .top { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; }
    .top h2 { margin: 0; font-size: 1.15rem; }
    .meta, .muted { color: var(--muted); font-size: 0.9rem; }
    .badge { font-size: 0.75rem; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: #fff3bf; color: #5c4400; }
    .badge.sin-web { background: #d3f9d8; color: #1b5e20; }
    .badge.caida { background: #ffe3e3; color: #8a1c1c; }
    .reasons { margin: 10px 0; padding-left: 20px; color: var(--muted); font-size: 0.92rem; }
    .links { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; }
    .links a { color: var(--accent); font-weight: 600; }
    .btn { background: var(--accent); color: #fff !important; padding: 7px 14px; border-radius: 8px; text-decoration: none; }
    details { margin-top: 12px; }
    summary { cursor: pointer; color: var(--muted); font-size: 0.9rem; }
    pre { white-space: pre-wrap; background: var(--bg); padding: 12px; border-radius: 8px; font-size: 0.88rem; }
    button { font: inherit; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Propuestas (${items.length})</h1>
    <p class="sub">Ordenadas por oportunidad. Generado ${e(new Date().toLocaleString("es-PR"))} para ${e(config.nombre)}.</p>
    ${rows || "<p>No hay propuestas todavía.</p>"}
  </div>
  <script>
    document.addEventListener("click", async (ev) => {
      const id = ev.target.dataset && ev.target.dataset.copy;
      if (!id) return;
      try {
        await navigator.clipboard.writeText(document.getElementById(id).textContent);
        ev.target.textContent = "¡Copiado!";
      } catch {
        ev.target.textContent = "Selecciona y copia a mano";
      }
    });
  </script>
</body>
</html>
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = readJson(path.join(ROOT, "config.json"), {});
  const data = readJson(path.join(DATA_DIR, "leads.json"), null);
  if (!data) {
    console.error("No encontré prospector/data/leads.json. Corre primero: node prospector/audit.js");
    process.exit(1);
  }

  const minScore = parseInt(args.min || "30", 10);
  const leads = data.leads.filter((l) => l.audit.score >= minScore);
  const cacheFile = path.join(DATA_DIR, "copy-cache.json");
  const cache = readJson(cacheFile, {});
  const baseUrl = (config.baseUrl || "").replace(/\/?$/, "/");

  const items = [];
  for (const lead of leads) {
    const preset = pickPreset(lead.categoria, lead.nombre);
    lead.presetKey = preset.key;

    let copy = defaultCopy(lead, preset);
    if (args.ia) {
      if (cache[lead.slug] && !args.refrescar) {
        copy = cache[lead.slug];
      } else {
        try {
          process.stdout.write(`  Escribiendo textos con IA para ${lead.nombre}... `);
          copy = await aiCopy(lead, preset);
          cache[lead.slug] = copy;
          writeJson(cacheFile, cache);
          console.log("listo");
        } catch (error) {
          console.log(`falló (${error.message}); uso plantilla`);
        }
      }
    }

    const html = renderLanding({ lead, preset, copy, config });
    const dir = path.join(OUT_DIR, lead.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html);

    const proposalUrl = `${baseUrl}${lead.slug}/`;
    const email = buildEmail(lead, copy, proposalUrl, config);
    fs.writeFileSync(path.join(dir, "email.txt"), `Para: ${lead.email || "(sin email)"}\nAsunto: ${email.subject}\n\n${email.body}\n`);

    items.push({ lead, preset, copy, email });
    console.log(`  ✓ ${lead.nombre} → propuestas/${lead.slug}/`);
  }

  fs.writeFileSync(path.join(OUT_DIR, "index.html"), renderDashboard(items, config));
  console.log(`\n${items.length} propuestas listas. Abre propuestas/index.html para revisarlas y enviar los emails.`);
}

main();
