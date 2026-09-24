const { escapeHtml: e } = require("./util");
const { CURRENT_YEAR } = require("./analyze");

function digits(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length === 10 ? `1${d}` : d;
}

function renderLanding({ lead, preset, copy, config }) {
  const c = preset.colors;
  const phone = lead.telefono;
  const whatsapp = digits(lead.whatsapp || "");
  const address = lead.direccion || lead.ciudad;
  const hours = (lead.horario || "").split(/[;|\n]/).map((h) => h.trim()).filter(Boolean);
  const mapQuery = encodeURIComponent(`${lead.nombre} ${address || ""}`.trim());
  const social = lead.audit?.extracted?.social || {};

  const ctaHref = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, quisiera información de ${lead.nombre}`)}`
    : phone
      ? `tel:${digits(phone)}`
      : lead.email
        ? `mailto:${lead.email}`
        : "#contacto";

  const services = copy.services
    .map(
      (s) => `
        <div class="card">
          <h3>${e(s.name)}</h3>
          ${s.description ? `<p>${e(s.description)}</p>` : ""}
        </div>`,
    )
    .join("");

  const contactRows = [
    phone && `<a class="contact-row" href="tel:${digits(phone)}"><span>📞</span>${e(phone)}</a>`,
    whatsapp && `<a class="contact-row" href="https://wa.me/${whatsapp}"><span>💬</span>WhatsApp</a>`,
    lead.email && `<a class="contact-row" href="mailto:${e(lead.email)}"><span>✉️</span>${e(lead.email)}</a>`,
    social.facebook && `<a class="contact-row" href="${e(social.facebook)}"><span>👍</span>Facebook</a>`,
    social.instagram && `<a class="contact-row" href="${e(social.instagram)}"><span>📸</span>Instagram</a>`,
  ]
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${e(lead.nombre)}${lead.ciudad ? ` — ${e(lead.ciudad)}` : ""}</title>
  <meta name="description" content="${e(copy.tagline)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Karla:wght@400;500;700&display=swap">
  <style>
    :root {
      --bg: ${c.bg}; --surface: ${c.surface}; --ink: ${c.ink}; --muted: ${c.muted};
      --accent: ${c.accent}; --accent-ink: ${c.accentInk}; --soft: ${c.soft};
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: "Karla", system-ui, sans-serif; line-height: 1.6; }
    a { color: inherit; }
    .preview-bar { background: #111; color: #fff; font-size: 0.85rem; padding: 10px 16px; text-align: center; }
    .preview-bar a { color: #ffd166; font-weight: 700; }
    .wrap { max-width: 1040px; margin: 0 auto; padding: 0 20px; }
    nav { display: flex; justify-content: space-between; align-items: center; padding: 18px 0; gap: 12px; }
    .brand { font-family: "Bricolage Grotesque", sans-serif; font-weight: 800; font-size: 1.15rem; }
    .btn { display: inline-flex; align-items: center; gap: 8px; background: var(--accent); color: var(--accent-ink); text-decoration: none; font-weight: 700; padding: 12px 20px; border-radius: 999px; white-space: nowrap; }
    .btn.ghost { background: transparent; color: var(--ink); border: 2px solid var(--accent); }
    .hero { padding: 56px 0 72px; display: grid; gap: 20px; }
    .eyebrow { color: var(--accent); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; font-size: 0.8rem; }
    h1 { font-family: "Bricolage Grotesque", sans-serif; font-size: clamp(2.3rem, 6vw, 4rem); line-height: 1.05; margin: 0; }
    .lead { font-size: 1.25rem; color: var(--muted); max-width: 40ch; margin: 0; }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
    section { padding: 56px 0; }
    h2 { font-family: "Bricolage Grotesque", sans-serif; font-size: 1.9rem; margin: 0 0 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .card { background: var(--surface); border-radius: 16px; padding: 22px; border: 1px solid var(--soft); }
    .card h3 { margin: 0 0 6px; font-size: 1.1rem; }
    .card p { margin: 0; color: var(--muted); }
    .about { background: var(--soft); border-radius: 24px; padding: 40px; font-size: 1.15rem; }
    .about p { margin: 0; max-width: 60ch; }
    .visit { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; align-items: start; }
    .hours { list-style: none; padding: 0; margin: 0; }
    .hours li { padding: 8px 0; border-bottom: 1px solid var(--soft); }
    iframe { width: 100%; height: 300px; border: 0; border-radius: 16px; }
    .contact-row { display: flex; gap: 12px; align-items: center; background: var(--surface); padding: 16px 18px; border-radius: 14px; text-decoration: none; font-weight: 700; margin-bottom: 10px; border: 1px solid var(--soft); }
    footer { padding: 32px 0 96px; color: var(--muted); font-size: 0.9rem; text-align: center; }
    .float-cta { position: fixed; right: 16px; bottom: 16px; box-shadow: 0 8px 24px rgba(0,0,0,.2); }
    @media (max-width: 600px) { nav .btn { display: none; } .about { padding: 26px; } }
  </style>
</head>
<body>
  <div class="preview-bar">
    Vista previa de diseño preparada para <strong>${e(lead.nombre)}</strong> por ${e(config.nombre)}.
    ${config.telefono ? `¿Le gusta? <a href="tel:${digits(config.telefono)}">Llame al ${e(config.telefono)}</a>` : config.email ? `¿Le gusta? <a href="mailto:${e(config.email)}">Escríbanos</a>` : ""}
  </div>

  <div class="wrap">
    <nav>
      <span class="brand">${preset.icon} ${e(lead.nombre)}</span>
      <a class="btn" href="${e(ctaHref)}">${e(preset.cta)}</a>
    </nav>

    <header class="hero">
      <span class="eyebrow">${e(preset.label)}${lead.ciudad ? ` · ${e(lead.ciudad)}` : ""}</span>
      <h1>${e(lead.nombre)}</h1>
      <p class="lead">${e(copy.tagline)}</p>
      <div class="actions">
        <a class="btn" href="${e(ctaHref)}">${e(preset.cta)}</a>
        ${phone ? `<a class="btn ghost" href="tel:${digits(phone)}">📞 ${e(phone)}</a>` : ""}
      </div>
    </header>

    <section>
      <h2>Servicios</h2>
      <div class="grid">${services}
      </div>
    </section>

    <section>
      <div class="about">
        <h2>Sobre nosotros</h2>
        <p>${e(copy.about)}</p>
      </div>
    </section>

    ${
      address || hours.length
        ? `<section>
      <h2>Visítanos</h2>
      <div class="visit">
        <div>
          ${address ? `<p><strong>📍 ${e(address)}</strong></p>` : ""}
          ${hours.length ? `<ul class="hours">${hours.map((h) => `<li>${e(h)}</li>`).join("")}</ul>` : ""}
        </div>
        ${address ? `<iframe loading="lazy" title="Mapa" src="https://www.google.com/maps?q=${mapQuery}&output=embed"></iframe>` : ""}
      </div>
    </section>`
        : ""
    }

    <section id="contacto">
      <h2>Contacto</h2>
      ${contactRows || `<p>Añade aquí teléfono, WhatsApp o email.</p>`}
    </section>

    <footer>© ${CURRENT_YEAR} ${e(lead.nombre)}. Todos los derechos reservados.</footer>
  </div>

  <a class="btn float-cta" href="${e(ctaHref)}">${whatsapp ? "💬 WhatsApp" : phone ? "📞 Llamar" : preset.cta}</a>
</body>
</html>
`;
}

module.exports = { renderLanding };
