#!/usr/bin/env node
// Solicitudes que llegan (no prospección en frío): lee cada
// prospector/solicitudes/<cliente>.json y crea una maqueta del sitio (si trae
// "maqueta"), un borrador de cotización imprimible y el email de respuesta.
//
//   node prospector/cotizar.js                       (todas las solicitudes, como BORRADOR)
//   node prospector/cotizar.js --solo fundacion-multinational
//   node prospector/cotizar.js --final               (sin la franja de borrador ni notas internas)

const fs = require("fs");
const path = require("path");
const { ROOT, readJson, escapeHtml: e, parseArgs } = require("./lib/util");
const { renderMaqueta } = require("./lib/maqueta");

const SOLICITUDES_DIR = path.join(ROOT, "solicitudes");
const OUT_DIR = path.resolve(ROOT, "..", "propuestas", "cotizaciones");

const money = (n) =>
  `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

function formatDate(iso) {
  const d = iso ? new Date(`${iso}T12:00:00`) : new Date();
  return d.toLocaleDateString("es-PR", { day: "numeric", month: "long", year: "numeric" });
}

function addDays(iso, days) {
  const d = iso ? new Date(`${iso}T12:00:00`) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function totals(sol) {
  const fases = sol.fases.map((f) => ({ ...f, subtotal: f.items.reduce((sum, it) => sum + Number(it.precio || 0), 0) }));
  const subtotal = fases.reduce((sum, f) => sum + f.subtotal, 0);
  const pct = Number(sol.descuento?.porcentaje || 0);
  const descuento = Math.round(subtotal * pct) / 100;
  return { fases, subtotal, descuento, total: subtotal - descuento };
}

function renderQuote(sol, config, { final, maquetaHref }) {
  const t = totals(sol);
  const folio = `COT-${(sol.fecha || "").replace(/-/g, "")}-${sol.slug.slice(0, 4).toUpperCase()}`;
  const venceIso = addDays(sol.fecha, sol.validez_dias || 30);

  const fases = t.fases
    .map(
      (f) => `
      <section class="phase">
        <div class="phase-head">
          <h3>${e(f.nombre)}</h3>
          ${f.entrega ? `<span class="pill">Entrega: ${e(f.entrega)}</span>` : ""}
        </div>
        <table>
          <tbody>
            ${f.items
              .map(
                (it) => `
            <tr>
              <td>
                <strong>${e(it.nombre)}</strong>
                ${it.detalle ? `<span class="detail">${e(it.detalle)}</span>` : ""}
              </td>
              <td class="num">${money(it.precio)}</td>
            </tr>`,
              )
              .join("")}
          </tbody>
          <tfoot>
            <tr><td>Subtotal ${e(f.nombre.split("—")[0].trim())}</td><td class="num">${money(f.subtotal)}</td></tr>
          </tfoot>
        </table>
      </section>`,
    )
    .join("");

  const recurrentes = (sol.recurrentes || [])
    .map(
      (r) => `
            <tr>
              <td><strong>${e(r.nombre)}</strong>${r.detalle ? `<span class="detail">${e(r.detalle)}</span>` : ""}</td>
              <td class="num">${money(r.precio)} / ${e(r.periodo)}</td>
            </tr>`,
    )
    .join("");

  const list = (items) => items.map((x) => `<li>${e(x)}</li>`).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Cotización — ${e(sol.cliente)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Karla:wght@400;500;700&display=swap">
  <style>
    :root { --bg: #f4f5f7; --paper: #ffffff; --ink: #161a22; --muted: #5d6573; --line: #e2e5ea; --accent: #3b5bdb; --soft: #e8edfc; --warn: #fff3bf; --warn-ink: #5c4400; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: "Karla", system-ui, sans-serif; line-height: 1.5; }
    .draft { background: var(--warn); color: var(--warn-ink); padding: 12px 16px; font-size: 0.92rem; }
    .draft-inner { max-width: 820px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; justify-content: space-between; }
    .draft button { font: inherit; font-weight: 700; padding: 6px 14px; border-radius: 8px; border: 1px solid currentColor; background: transparent; color: inherit; cursor: pointer; }
    .paper { max-width: 820px; margin: 24px auto 60px; background: var(--paper); border: 1px solid var(--line); border-radius: 14px; padding: clamp(20px, 5vw, 48px); }
    header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; border-bottom: 3px solid var(--accent); padding-bottom: 20px; }
    h1, h2, h3 { font-family: "Bricolage Grotesque", sans-serif; margin: 0; }
    h1 { font-size: clamp(1.7rem, 5vw, 2.3rem); font-weight: 800; }
    h2 { font-size: 1.15rem; margin: 32px 0 10px; }
    h3 { font-size: 1.05rem; }
    .from, .meta { color: var(--muted); font-size: 0.92rem; }
    .meta { text-align: right; }
    .meta strong { color: var(--ink); }
    .to { margin-top: 20px; }
    .to strong { font-size: 1.1rem; }
    .summary { background: var(--soft); border-radius: 10px; padding: 14px 16px; margin-top: 16px; }
    .summary a { color: var(--accent); font-weight: 700; }
    .phase { margin-top: 24px; }
    .phase-head { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
    .pill { font-size: 0.8rem; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: var(--soft); color: var(--accent); }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 10px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
    td.num { text-align: right; white-space: nowrap; padding-left: 16px; font-variant-numeric: tabular-nums; }
    .detail { display: block; color: var(--muted); font-size: 0.9rem; }
    tfoot td { font-weight: 700; border-bottom: none; }
    .totals { margin-top: 28px; margin-left: auto; max-width: 360px; }
    .totals td { padding: 6px 0; }
    .totals .grand td { font-size: 1.25rem; font-weight: 800; border-top: 2px solid var(--ink); border-bottom: none; padding-top: 10px; }
    .discount td { color: #1b7a3a; }
    ul { padding-left: 20px; margin: 0; }
    li { margin: 4px 0; }
    .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0 32px; }
    footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid var(--line); color: var(--muted); font-size: 0.9rem; }
    @media print {
      body { background: #fff; }
      .draft { display: none; }
      .paper { margin: 0; border: none; border-radius: 0; padding: 0; max-width: none; }
      .phase, .totals, tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${
    final
      ? ""
      : `<div class="draft"><div class="draft-inner">
    <span><strong>BORRADOR</strong> — revisa precios y datos antes de enviar.${sol.notas_internas ? ` ${e(sol.notas_internas)}` : ""}</span>
    <button type="button" onclick="window.print()">Imprimir / guardar PDF</button>
  </div></div>`
  }
  <main class="paper">
    <header>
      <div>
        <h1>Cotización</h1>
        <div class="from">${e(config.nombre)}<br>${[config.telefono, config.email].filter(Boolean).map(e).join(" · ")}</div>
      </div>
      <div class="meta">
        <div>Núm. <strong>${e(folio)}</strong></div>
        <div>Fecha: <strong>${e(formatDate(sol.fecha))}</strong></div>
        <div>Válida hasta: <strong>${e(formatDate(venceIso))}</strong></div>
      </div>
    </header>

    <div class="to">
      <div class="from">Preparada para</div>
      <strong>${e(sol.cliente)}</strong>
      ${[sol.contacto, sol.email, sol.telefono].filter(Boolean).length ? `<div class="from">${[sol.contacto, sol.email, sol.telefono].filter(Boolean).map(e).join(" · ")}</div>` : ""}
    </div>

    <div class="summary">${e(sol.resumen || sol.solicitud)}${maquetaHref ? ` <a href="${e(maquetaHref)}">Ver la maqueta del sitio →</a>` : ""}</div>

    <h2>Alcance y precios</h2>
    ${fases}

    <table class="totals">
      <tbody>
        <tr><td>Subtotal</td><td class="num">${money(t.subtotal)}</td></tr>
        ${t.descuento ? `<tr class="discount"><td>${e(sol.descuento.nombre)}</td><td class="num">−${money(t.descuento)}</td></tr>` : ""}
        <tr class="grand"><td>Total</td><td class="num">${money(t.total)}</td></tr>
      </tbody>
    </table>

    ${
      recurrentes
        ? `<h2>Costos recurrentes (aparte)</h2>
    <table><tbody>${recurrentes}</tbody></table>`
        : ""
    }

    <div class="cols">
      ${sol.necesitamos?.length ? `<div><h2>Lo que necesitamos de ustedes</h2><ul>${list(sol.necesitamos)}</ul></div>` : ""}
      ${sol.condiciones?.length ? `<div><h2>Condiciones</h2><ul>${list(sol.condiciones)}</ul></div>` : ""}
    </div>

    ${sol.preguntas?.length ? `<h2>Para afinar la cotización</h2><ul>${list(sol.preguntas)}</ul>` : ""}

    <footer>
      Para aprobar esta cotización basta con responder el email o llamar al ${e(config.telefono || "")}. ¡Gracias por la oportunidad!
    </footer>
  </main>
</body>
</html>
`;
}

function buildReply(sol, config, quoteUrl, maquetaUrl) {
  const t = totals(sol);
  const saludo = sol.contacto ? `Saludos, ${sol.contacto}:` : `Saludos, equipo de ${sol.cliente}:`;
  const fases = t.fases.map((f) => `  • ${f.nombre}: ${money(f.subtotal)}${f.entrega ? ` (${f.entrega})` : ""}`);

  const body = [
    saludo,
    "",
    `Gracias por pensar en nosotros para la página web de ${sol.cliente}.`,
    "",
    ...(maquetaUrl
      ? [
          "Para que no tengan que imaginárselo, preparé una maqueta de cómo se vería: la landing inicial y el sitio completo (arriba pueden cambiar entre las dos fases):",
          maquetaUrl,
          "",
          "Y aquí está la cotización:",
        ]
      : ["Les preparé la cotización:"]),
    quoteUrl,
    "",
    "En resumen:",
    ...fases,
    t.descuento ? `  • ${sol.descuento.nombre}: −${money(t.descuento)}` : "",
    `  • Total: ${money(t.total)}`,
    "",
    "La idea es salir rápido con la landing para que ya tengan presencia en línea, y mientras tanto ir reuniendo el contenido para el sitio completo.",
    "",
    sol.preguntas?.length ? "Para afinar los detalles, me ayudaría saber:" : "",
    ...(sol.preguntas || []).map((p) => `  • ${p}`),
    "",
    "¿Les parece si hablamos 15 minutos esta semana para repasarla?",
    "",
    config.nombre,
    [config.telefono, config.email].filter(Boolean).join(" · "),
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");

  return { subject: `Cotización página web — ${sol.cliente}`, body };
}

function renderIndex(items, { final }) {
  const rows = items
    .map(
      (it) => `
      <article>
        <h2>${e(it.sol.cliente)}</h2>
        <p class="muted">${e(formatDate(it.sol.fecha))} · Total ${money(totals(it.sol).total)}${final ? "" : " · borrador"}</p>
        <p>${e(it.sol.solicitud)}</p>
        ${it.sol.maqueta ? `<a class="btn" href="${e(it.sol.slug)}/" target="_blank">Ver maqueta</a>` : ""}
        <a ${it.sol.maqueta ? "" : 'class="btn" '}href="${e(it.sol.slug)}/cotizacion/" target="_blank">Ver cotización</a>
        <a href="${e(it.sol.slug)}/respuesta.txt" target="_blank">Email de respuesta</a>
      </article>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Cotizaciones</title>
  <style>
    :root { --bg: #f4f5f7; --surface: #fff; --ink: #161a22; --muted: #5d6573; --line: #e2e5ea; --accent: #3b5bdb; }
    @media (prefers-color-scheme: dark) { :root { --bg: #111418; --surface: #1a1f26; --ink: #eef1f5; --muted: #9aa3b1; --line: #2a313b; --accent: #7c95f5; } }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: system-ui, sans-serif; line-height: 1.5; }
    .wrap { max-width: 900px; margin: 0 auto; padding: 32px 16px 80px; }
    article { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 18px; margin-bottom: 14px; }
    h2 { margin: 0; font-size: 1.15rem; }
    .muted { color: var(--muted); font-size: 0.9rem; margin: 2px 0 8px; }
    a { color: var(--accent); font-weight: 600; margin-right: 14px; }
    .btn { background: var(--accent); color: #fff; padding: 7px 14px; border-radius: 8px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Cotizaciones (${items.length})</h1>
    ${rows || "<p>No hay solicitudes todavía. Añade un .json en prospector/solicitudes/.</p>"}
  </div>
</body>
</html>
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = readJson(path.join(ROOT, "config.json"), {});
  const baseUrl = (config.baseUrl || "").replace(/\/?$/, "/");
  const final = Boolean(args.final);

  const files = fs.existsSync(SOLICITUDES_DIR)
    ? fs.readdirSync(SOLICITUDES_DIR).filter((f) => f.endsWith(".json")).sort()
    : [];

  const items = [];
  for (const file of files) {
    const slug = path.basename(file, ".json");
    if (args.solo && args.solo !== slug) continue;
    const sol = { ...readJson(path.join(SOLICITUDES_DIR, file), {}), slug };
    if (!sol.cliente || !Array.isArray(sol.fases)) {
      console.warn(`  ⚠ ${file}: falta "cliente" o "fases"; lo salto`);
      continue;
    }

    // <slug>/ = maqueta del sitio (si la hay), <slug>/cotizacion/ = la cotización.
    const dir = path.join(OUT_DIR, slug);
    const quoteDir = path.join(dir, "cotizacion");
    fs.mkdirSync(quoteDir, { recursive: true });
    if (sol.maqueta) fs.writeFileSync(path.join(dir, "index.html"), renderMaqueta(sol, config));
    fs.writeFileSync(path.join(quoteDir, "index.html"), renderQuote(sol, config, { final, maquetaHref: sol.maqueta ? "../" : "" }));

    const url = `${baseUrl}cotizaciones/${slug}/`;
    const reply = buildReply(sol, config, `${url}cotizacion/`, sol.maqueta ? url : "");
    fs.writeFileSync(path.join(dir, "respuesta.txt"), `Para: ${sol.email || "(sin email)"}\nAsunto: ${reply.subject}\n\n${reply.body}\n`);

    items.push({ sol });
    console.log(`  ✓ ${sol.cliente} → propuestas/cotizaciones/${slug}/ (total ${money(totals(sol).total)})`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "index.html"), renderIndex(items, { final }));
  console.log(`\n${items.length} cotización(es)${final ? "" : " en borrador"}. Abre propuestas/cotizaciones/index.html.`);
}

main();
