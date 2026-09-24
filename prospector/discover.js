#!/usr/bin/env node
// Paso 1 (opcional): busca negocios en Google Maps y los añade a prospector/leads.csv.
// Los que Google no tiene con web salen con la columna "web" vacia = prospecto "sin web".
//
//   GOOGLE_PLACES_API_KEY=xxx node prospector/discover.js --q "pediatras en Bayamón" --categoria medico
//   ... --solo-sin-web        (solo guarda los que NO tienen web)
//
// Necesita una API key de Google Places (API "Places API (New)") en Google Cloud.
// Google no da emails: para esos, revisa su Facebook/Instagram o llama.

const fs = require("fs");
const path = require("path");
const { ROOT, parseCsv, toCsv, parseArgs } = require("./lib/util");

const HEADERS = ["nombre", "categoria", "web", "email", "telefono", "whatsapp", "direccion", "ciudad", "horario", "servicios", "eslogan", "notas"];
const FIELD_MASK = [
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.primaryTypeDisplayName",
  "places.googleMapsUri",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "nextPageToken",
].join(",");

async function searchPlaces(query, apiKey, maxPages) {
  const places = [];
  let pageToken;
  for (let page = 0; page < maxPages; page++) {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: query, languageCode: "es", pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Google Places respondió ${response.status}: ${data.error?.message || JSON.stringify(data)}`);
    }
    places.push(...(data.places || []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return places;
}

function cityFromAddress(address = "") {
  // "123 Calle X, Bayamón, 00961, Puerto Rico" -> "Bayamón"
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const candidate = parts.find((p, i) => i > 0 && !/\d{5}/.test(p) && !/puerto rico|estados unidos|usa/i.test(p));
  return candidate || "";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!args.q) {
    console.error('Uso: node prospector/discover.js --q "dentistas en Caguas" --categoria dentista [--solo-sin-web] [--paginas 3]');
    process.exit(1);
  }
  if (!apiKey) {
    console.error("Falta GOOGLE_PLACES_API_KEY. Créala en Google Cloud (Places API (New)) y ponla en tu .env.");
    process.exit(1);
  }

  const places = await searchPlaces(args.q, apiKey, parseInt(args.paginas || "3", 10));
  const file = path.join(ROOT, "leads.csv");
  const existing = fs.existsSync(file) ? parseCsv(fs.readFileSync(file, "utf8")) : [];
  const seen = new Set(existing.map((l) => `${l.nombre}|${l.direccion}`.toLowerCase()));

  let added = 0;
  let withoutWeb = 0;
  for (const p of places) {
    if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
    const hasWeb = Boolean(p.websiteUri);
    if (!hasWeb) withoutWeb++;
    if (args["solo-sin-web"] && hasWeb) continue;

    const lead = {
      nombre: p.displayName?.text || "",
      categoria: args.categoria || p.primaryTypeDisplayName?.text || "",
      web: p.websiteUri || "",
      email: "",
      telefono: p.nationalPhoneNumber || "",
      whatsapp: "",
      direccion: p.formattedAddress || "",
      ciudad: cityFromAddress(p.formattedAddress),
      horario: (p.regularOpeningHours?.weekdayDescriptions || []).join("; "),
      servicios: "",
      eslogan: "",
      notas: [p.rating ? `${p.rating}★ (${p.userRatingCount || 0} reseñas)` : "", p.googleMapsUri || ""].filter(Boolean).join(" · "),
    };
    const key = `${lead.nombre}|${lead.direccion}`.toLowerCase();
    if (!lead.nombre || seen.has(key)) continue;
    seen.add(key);
    existing.push(lead);
    added++;
  }

  fs.writeFileSync(file, toCsv(existing, HEADERS));
  console.log(`Encontrados ${places.length} negocios (${withoutWeb} sin web). Añadidos ${added} nuevos a prospector/leads.csv.`);
  console.log("Siguiente paso: node prospector/audit.js");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
