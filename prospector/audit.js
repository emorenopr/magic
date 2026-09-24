#!/usr/bin/env node
// Paso 2: revisa la web de cada prospecto y le da una puntuacion de oportunidad.
//
//   node prospector/audit.js                       (lee prospector/leads.csv)
//   node prospector/audit.js --in otra-lista.csv
//
// Resultado: prospector/data/leads.json (lo usa generate.js)

const fs = require("fs");
const path = require("path");
const { analyzeHtml } = require("./lib/analyze");
const { ROOT, DATA_DIR, parseCsv, slugify, normalizeUrl, fetchPage, mapLimit, writeJson, parseArgs } = require("./lib/util");

async function auditLead(lead) {
  const url = normalizeUrl(lead.web);
  const base = { ...lead, slug: slugify(`${lead.nombre}-${lead.ciudad || ""}`) };

  if (!url) {
    return {
      ...base,
      audit: {
        status: "sin-web",
        score: 100,
        reasons: ["No tiene página web"],
        extracted: {},
      },
    };
  }

  try {
    let page = await fetchPage(url);
    // Si http:// falla, prueba https:// (y al reves) antes de declararla caida.
    if (!page.ok) {
      const alt = url.startsWith("https://") ? url.replace("https://", "http://") : url.replace("http://", "https://");
      try {
        const altPage = await fetchPage(alt);
        if (altPage.ok) page = altPage;
      } catch {
        // nos quedamos con el primer resultado
      }
    }
    if (!page.ok) {
      return {
        ...base,
        audit: { status: "caida", score: 90, reasons: [`La web responde con error ${page.status}`], extracted: {} },
      };
    }
    const result = analyzeHtml(page);
    return { ...base, audit: { status: "ok", finalUrl: page.finalUrl, ...result } };
  } catch (error) {
    const reason = error.name === "TimeoutError" ? "La web no carga (tarda demasiado)" : "La web no abre / dominio no responde";
    return { ...base, audit: { status: "caida", score: 90, reasons: [reason], error: String(error.message || error), extracted: {} } };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = path.resolve(args.in || path.join(ROOT, "leads.csv"));
  if (!fs.existsSync(input)) {
    console.error(`No encontré ${input}.\nCopia prospector/leads.example.csv a prospector/leads.csv y llénalo (o corre discover.js).`);
    process.exit(1);
  }

  const leads = parseCsv(fs.readFileSync(input, "utf8")).filter((l) => l.nombre);
  console.log(`Revisando ${leads.length} prospectos...\n`);

  const results = await mapLimit(leads, 5, async (lead) => {
    const r = await auditLead(lead);
    const tag = r.audit.status === "sin-web" ? "SIN WEB " : r.audit.status === "caida" ? "CAÍDA   " : `${String(r.audit.score).padStart(3)} pts `;
    console.log(`  ${tag} ${r.nombre}${r.web ? ` (${r.web})` : ""}`);
    for (const reason of r.audit.reasons) console.log(`           - ${reason}`);
    return r;
  });

  // Fusiona emails/telefonos encontrados en la web con los del CSV.
  for (const r of results) {
    const ex = r.audit.extracted || {};
    if (!r.email && ex.emails?.length) r.email = ex.emails[0];
    if (!r.telefono && ex.phones?.length) r.telefono = ex.phones[0];
  }

  results.sort((a, b) => b.audit.score - a.audit.score);
  const out = path.join(DATA_DIR, "leads.json");
  writeJson(out, { generatedAt: new Date().toISOString(), leads: results });

  const good = results.filter((r) => r.audit.score >= 40).length;
  console.log(`\n${good} de ${results.length} son buenos prospectos (40+ pts).`);
  console.log(`Guardado en ${path.relative(process.cwd(), out)}. Siguiente paso: node prospector/generate.js`);
}

main();
