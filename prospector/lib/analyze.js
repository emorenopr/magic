// Analiza el HTML de una pagina y devuelve señales de "web vieja" + datos
// utiles (telefono, email, redes) para reusar en la propuesta.

const CURRENT_YEAR = new Date().getFullYear();

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&copy;|&#169;|&#xa9;/gi, "©")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(html, regex) {
  const m = html.match(regex);
  return m ? decodeEntities(m[1].replace(/\s+/g, " ").trim()) : "";
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function metaContent(html, name) {
  const re1 = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i");
  return firstMatch(html, re1) || firstMatch(html, re2);
}

// Busca el año del copyright: "© 2014", "Copyright 2009-2016", "&copy; 2012 Clinica..."
function findCopyrightYear(text) {
  const years = [];
  const re = /(?:©|\(c\)|copyright|derechos reservados)[^0-9]{0,40}((?:19|20)\d{2})(?:\s*[-–—]\s*((?:19|20)\d{2}))?/gi;
  let m;
  while ((m = re.exec(text))) {
    const y = parseInt(m[2] || m[1], 10);
    if (y >= 1995 && y <= CURRENT_YEAR + 1) years.push(y);
  }
  return years.length ? Math.max(...years) : null;
}

// Si el año se pone con JavaScript (new Date().getFullYear()) no es señal de vejez.
function hasDynamicYear(html) {
  return /getFullYear\s*\(/.test(html) || /\{\{\s*year\s*\}\}/i.test(html);
}

function findPhones(html, text) {
  const phones = new Set();
  for (const m of html.matchAll(/href=["']tel:([^"']+)["']/gi)) {
    phones.add(decodeURIComponent(m[1]).trim());
  }
  for (const m of text.matchAll(/(?:\+?1[\s.-]?)?\(?\b(787|939|[2-9]\d{2})\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g)) {
    phones.add(m[0].trim());
  }
  return [...phones].slice(0, 3);
}

function findEmails(html) {
  const emails = new Set();
  for (const m of html.matchAll(/href=["']mailto:([^"'?]+)/gi)) {
    emails.add(decodeURIComponent(m[1]).trim().toLowerCase());
  }
  for (const m of html.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
    const e = m[0].toLowerCase();
    if (!/\.(png|jpe?g|gif|webp|svg)$/.test(e) && !e.includes("example.") && !e.includes("sentry")) {
      emails.add(e);
    }
  }
  return [...emails].slice(0, 3);
}

function findSocial(html) {
  const social = {};
  const patterns = {
    facebook: /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.\-/]+/i,
    instagram: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.\-/]+/i,
    whatsapp: /https?:\/\/(?:wa\.me|api\.whatsapp\.com)\/[^"'\s<]+/i,
  };
  for (const [key, re] of Object.entries(patterns)) {
    const m = html.match(re);
    if (m) social[key] = m[0];
  }
  return social;
}

// Devuelve { score, reasons[], extracted{} }. Score 0-100: mas alto = mejor prospecto.
function analyzeHtml(page) {
  const { html, finalUrl, headers = {}, ms } = page;
  const text = stripTags(html);
  const reasons = [];
  let score = 0;

  const add = (points, reason) => {
    score += points;
    reasons.push(reason);
  };

  const copyrightYear = hasDynamicYear(html) ? null : findCopyrightYear(text);
  if (copyrightYear) {
    const age = CURRENT_YEAR - copyrightYear;
    if (age >= 6) add(40, `Copyright © ${copyrightYear} (hace ${age} años)`);
    else if (age >= 3) add(25, `Copyright © ${copyrightYear} (hace ${age} años)`);
    else if (age >= 2) add(10, `Copyright © ${copyrightYear}`);
  }

  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
    add(25, "No se adapta a celulares (sin meta viewport)");
  }
  if (finalUrl.startsWith("http://")) {
    add(15, "Sin candado de seguridad (no usa https)");
  }
  if (/\.swf\b|<embed[^>]+flash|shockwave/i.test(html)) {
    add(15, "Usa Flash (ya no funciona en navegadores)");
  }
  const fontTags = (html.match(/<font\b/gi) || []).length;
  const tables = (html.match(/<table\b/gi) || []).length;
  if (fontTags > 3 || (tables > 4 && !/<(?:header|nav|main|section)\b/i.test(html))) {
    add(10, "Diseño con tecnología antigua (tablas / <font>)");
  }
  if (/<frameset|<marquee|<blink/i.test(html)) {
    add(10, "Usa frames/marquee (estilo de los 2000)");
  }
  const jq = html.match(/jquery[.-]?(\d+)\.(\d+)(?:\.\d+)?(?:\.min)?\.js/i);
  if (jq && parseInt(jq[1], 10) < 3) {
    add(5, `jQuery ${jq[1]}.${jq[2]} (desactualizado)`);
  }
  const generator = metaContent(html, "generator");
  const wp = generator.match(/WordPress\s+(\d+)\.(\d+)/i);
  if (wp && parseInt(wp[1], 10) < 6) {
    add(10, `WordPress ${wp[1]}.${wp[2]} desactualizado`);
  }
  const description = metaContent(html, "description");
  if (!description) {
    add(5, "Sin descripción para Google (meta description)");
  }
  if (typeof ms === "number" && ms > 6000) {
    add(5, `Carga lenta (${(ms / 1000).toFixed(1)}s)`);
  }
  const lastModified = headers["last-modified"];
  if (lastModified) {
    const lmYear = new Date(lastModified).getFullYear();
    if (lmYear && CURRENT_YEAR - lmYear >= 3) {
      add(10, `Última modificación: ${lmYear}`);
    }
  }

  return {
    score: Math.min(score, 100),
    reasons,
    copyrightYear,
    extracted: {
      title: firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
      description,
      h1: stripTags(firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)),
      phones: findPhones(html, text),
      emails: findEmails(html),
      social: findSocial(html),
      ogImage: metaContent(html, "og:image"),
      // Un pedazo del texto de la web para que la IA (opcional) entienda el negocio.
      textSample: text.slice(0, 2500),
    },
  };
}

module.exports = { analyzeHtml, findCopyrightYear, CURRENT_YEAR };
