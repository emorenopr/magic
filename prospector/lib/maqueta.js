// Maqueta de sitio para una solicitud de fundación / organización sin fines de
// lucro: la landing de la fase 1 y el sitio completo (Quiénes Somos, Noticias,
// Dona Aquí) en una sola página, con una barra para cambiar entre las dos fases.
// Los textos vienen de "maqueta" en prospector/solicitudes/<cliente>.json.

const { escapeHtml: e } = require("./util");
const { CURRENT_YEAR } = require("./analyze");

const DEFAULT_COLORS = { bg: "#f7f6f2", surface: "#ffffff", ink: "#14213d", muted: "#5b6478", accent: "#e4572e", accentInk: "#ffffff", deep: "#14213d", soft: "#fde8e1" };

function initials(name) {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-ZÁÉÍÓÚÑ]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

function shortDate(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-PR", { day: "numeric", month: "short", year: "numeric" });
}

function renderMaqueta(sol, config) {
  const m = sol.maqueta || {};
  const c = { ...DEFAULT_COLORS, ...(m.colores || {}) };
  const q = m.quienes || {};
  const name = sol.cliente;
  const logo = initials(name) || "★";
  const montos = m.montos || [25, 50, 100];
  const redes = (m.redes || []).map((r) => `<a href="#" onclick="return false">${e(r)}</a>`).join("");

  const noticias = (m.noticias || [])
    .map(
      (n, i) => `
        <article class="news-card">
          <div class="news-img" aria-hidden="true">Foto ${i + 1}</div>
          <div class="news-body">
            <time>${e(shortDate(n.fecha))}</time>
            <h3>${e(n.titulo)}</h3>
            <p>${e(n.resumen)}</p>
            <a href="#" onclick="return false">Leer más →</a>
          </div>
        </article>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${e(name)} — propuesta de página web</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Karla:wght@400;500;700&display=swap">
  <style>
    :root {
      --bg: ${c.bg}; --surface: ${c.surface}; --ink: ${c.ink}; --muted: ${c.muted};
      --accent: ${c.accent}; --accent-ink: ${c.accentInk}; --deep: ${c.deep}; --soft: ${c.soft};
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: "Karla", system-ui, sans-serif; line-height: 1.6; }
    h1, h2, h3 { font-family: "Bricolage Grotesque", sans-serif; line-height: 1.15; margin: 0; }
    a { color: inherit; }
    .container { max-width: 1080px; margin: 0 auto; padding: 0 16px; }

    /* Barra de la propuesta (no es parte del sitio) */
    .proposal-bar { position: sticky; top: 0; z-index: 20; background: #111; color: #fff; font-size: 0.88rem; }
    .proposal-bar .container { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; justify-content: space-between; padding-top: 8px; padding-bottom: 8px; }
    .seg { display: inline-flex; background: #2a2a2a; border-radius: 999px; padding: 3px; }
    .seg button { font: inherit; font-weight: 700; border: 0; background: transparent; color: #bbb; padding: 5px 12px; border-radius: 999px; cursor: pointer; }
    .seg button[aria-pressed="true"] { background: #fff; color: #111; }
    .proposal-bar .quote { color: #fff; font-weight: 700; }

    .btn { display: inline-block; background: var(--accent); color: var(--accent-ink); font-weight: 700; padding: 12px 22px; border-radius: 999px; text-decoration: none; border: 0; font: inherit; font-weight: 700; cursor: pointer; }
    .btn.ghost { background: transparent; color: inherit; border: 2px solid currentColor; }
    .eyebrow { text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.78rem; font-weight: 700; color: var(--accent); margin: 0 0 8px; }
    .logo { display: inline-flex; align-items: center; gap: 10px; font-family: "Bricolage Grotesque", sans-serif; font-weight: 800; font-size: 1.1rem; text-decoration: none; }
    .logo span { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: var(--accent); color: var(--accent-ink); font-size: 0.95rem; }

    /* ---------- Fase 1: landing ---------- */
    .landing { min-height: calc(100vh - 44px); display: grid; place-items: center; text-align: center; padding: 48px 16px; background: radial-gradient(circle at 20% 10%, color-mix(in srgb, var(--accent) 35%, transparent), transparent 55%), var(--deep); color: #fff; }
    .landing .logo span { width: 64px; height: 64px; font-size: 1.5rem; }
    .landing .logo { flex-direction: column; font-size: 1.4rem; }
    .landing h1 { font-size: clamp(2rem, 7vw, 3.4rem); margin: 28px 0 14px; max-width: 18ch; margin-inline: auto; }
    .landing p { max-width: 52ch; margin: 0 auto 26px; opacity: 0.85; font-size: 1.08rem; }
    .soon { display: inline-block; font-size: 0.82rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; border: 1px solid rgba(255,255,255,0.4); padding: 4px 12px; border-radius: 999px; }
    .landing form { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 460px; margin: 0 auto 22px; }
    .landing input { flex: 1; min-width: 200px; padding: 12px 16px; border-radius: 999px; border: 0; font: inherit; }
    .landing .socials { display: flex; gap: 18px; justify-content: center; opacity: 0.8; font-size: 0.95rem; }

    /* ---------- Fase 2: sitio completo ---------- */
    .site-nav { background: var(--surface); border-bottom: 1px solid rgba(0,0,0,0.07); }
    .site-nav .container { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 12px; padding-bottom: 12px; flex-wrap: wrap; }
    .site-nav nav { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; font-weight: 600; }
    .site-nav nav a { text-decoration: none; }
    .site-nav .btn { padding: 8px 18px; }

    .hero { background: linear-gradient(120deg, var(--deep) 0%, var(--deep) 55%, var(--accent) 140%); color: #fff; padding: clamp(56px, 10vw, 110px) 0; }
    .hero h1 { font-size: clamp(2.1rem, 6vw, 3.6rem); max-width: 16ch; }
    .hero p { max-width: 52ch; font-size: 1.1rem; opacity: 0.88; margin: 16px 0 28px; }
    .hero .actions { display: flex; flex-wrap: wrap; gap: 12px; }

    .impact { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: -36px; }
    .impact div { background: var(--surface); border-radius: 16px; padding: 20px; box-shadow: 0 8px 28px rgba(20,33,61,0.08); }
    .impact strong { display: block; font-family: "Bricolage Grotesque", sans-serif; font-size: 2rem; color: var(--accent); }

    section.block { padding: clamp(56px, 8vw, 88px) 0; }
    section.block h2 { font-size: clamp(1.7rem, 4.5vw, 2.4rem); margin-bottom: 14px; }
    .lead { color: var(--muted); max-width: 60ch; font-size: 1.05rem; }

    .values { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-top: 28px; }
    .values div { background: var(--surface); border-radius: 16px; padding: 22px; border-top: 4px solid var(--accent); }
    .values h3 { margin-bottom: 6px; }
    .values p { margin: 0; color: var(--muted); }
    .team { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin-top: 28px; }
    .team div { text-align: center; }
    .avatar { width: 96px; height: 96px; border-radius: 50%; margin: 0 auto 10px; background: var(--soft); color: var(--accent); display: grid; place-items: center; font-size: 0.8rem; font-weight: 700; }
    .team small { display: block; color: var(--muted); }

    .alt { background: var(--surface); }
    .news { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; margin-top: 28px; }
    .news-card { background: var(--bg); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; }
    .news-img { aspect-ratio: 16 / 9; background: repeating-linear-gradient(45deg, var(--soft), var(--soft) 12px, transparent 12px, transparent 24px), var(--surface); display: grid; place-items: center; color: var(--muted); font-weight: 700; font-size: 0.85rem; }
    .news-body { padding: 18px; }
    .news-body time { color: var(--muted); font-size: 0.85rem; }
    .news-body h3 { margin: 4px 0 8px; font-size: 1.15rem; }
    .news-body p { margin: 0 0 10px; color: var(--muted); }
    .news-body a { color: var(--accent); font-weight: 700; text-decoration: none; }

    .donate { background: var(--deep); color: #fff; }
    .donate .lead { color: rgba(255,255,255,0.8); }
    .donate-box { background: var(--surface); color: var(--ink); border-radius: 20px; padding: clamp(20px, 4vw, 32px); max-width: 520px; margin-top: 28px; }
    .freq { display: flex; gap: 8px; margin-bottom: 14px; }
    .amounts { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 8px; margin-bottom: 14px; }
    .chip { font: inherit; font-weight: 700; padding: 12px; border-radius: 12px; border: 2px solid var(--soft); background: var(--surface); color: var(--ink); cursor: pointer; }
    .chip[aria-pressed="true"] { border-color: var(--accent); background: var(--soft); }
    .donate-box .btn { width: 100%; padding: 14px; font-size: 1.05rem; }
    .methods { margin-top: 12px; font-size: 0.85rem; color: var(--muted); text-align: center; }
    .donate-box .msg { margin: 10px 0 0; font-size: 0.9rem; color: var(--muted); text-align: center; min-height: 1.4em; }

    footer.site-footer { background: #0c1426; color: rgba(255,255,255,0.75); padding: 32px 0; font-size: 0.92rem; }
    footer.site-footer .container { display: flex; flex-wrap: wrap; gap: 12px 24px; justify-content: space-between; }
    footer.site-footer .socials { display: flex; gap: 16px; }

    .sample-note { background: #fff3bf; color: #5c4400; font-size: 0.85rem; text-align: center; padding: 8px 16px; }

    body[data-fase="1"] #sitio, body[data-fase="2"] #landing { display: none; }
  </style>
</head>
<body data-fase="2">
  <div class="proposal-bar">
    <div class="container">
      <span>Propuesta para <strong>${e(name)}</strong></span>
      <div class="seg" role="group" aria-label="Ver fase">
        <button type="button" data-fase="1">Fase 1 · Landing inicial</button>
        <button type="button" data-fase="2">Fase 2 · Sitio completo</button>
      </div>
      <a class="quote" href="cotizacion/">Ver cotización →</a>
    </div>
  </div>
  <div class="sample-note">Maqueta con textos, fotos y cifras de ejemplo: se reemplazan con el contenido real de la fundación.</div>

  <!-- ===== Fase 1 ===== -->
  <main id="landing" class="landing">
    <div>
      <span class="logo"><span>${e(logo)}</span>${e(name)}</span>
      <h1>${e(m.lema || "")}</h1>
      <p>${e(m.mision || "")}</p>
      <p><span class="soon">Nuestro sitio completo viene pronto</span></p>
      <form onsubmit="event.preventDefault(); this.querySelector('button').textContent = '¡Gracias!';">
        <input type="email" aria-label="Email" placeholder="Tu email para enterarte primero" required>
        <button class="btn" type="submit">Avísame</button>
      </form>
      <div class="socials">${redes}</div>
    </div>
  </main>

  <!-- ===== Fase 2 ===== -->
  <div id="sitio">
    <header class="site-nav">
      <div class="container">
        <a class="logo" href="#inicio"><span>${e(logo)}</span>${e(name)}</a>
        <nav>
          <a href="#quienes">Quiénes Somos</a>
          <a href="#noticias">Noticias</a>
          <a class="btn" href="#dona">Dona Aquí</a>
        </nav>
      </div>
    </header>

    <section class="hero" id="inicio">
      <div class="container">
        <p class="eyebrow">${e(name)}</p>
        <h1>${e(m.lema || "")}</h1>
        <p>${e(m.mision || "")}</p>
        <div class="actions">
          <a class="btn" href="#dona">Dona Aquí</a>
          <a class="btn ghost" href="#quienes">Conócenos</a>
        </div>
      </div>
    </section>

    ${
      m.impacto?.length
        ? `<div class="container"><div class="impact">${m.impacto.map((i) => `<div><strong>${e(i.numero)}</strong>${e(i.texto)}</div>`).join("")}</div></div>`
        : ""
    }

    <section class="block" id="quienes">
      <div class="container">
        <p class="eyebrow">Quiénes Somos</p>
        <h2>Una fundación hecha de personas</h2>
        <p class="lead">${e(q.historia || "")}</p>
        ${q.valores?.length ? `<div class="values">${q.valores.map((v) => `<div><h3>${e(v.titulo)}</h3><p>${e(v.texto)}</p></div>`).join("")}</div>` : ""}
        ${q.equipo?.length ? `<div class="team">${q.equipo.map((p) => `<div><div class="avatar">Foto</div><strong>${e(p.nombre)}</strong><small>${e(p.cargo)}</small></div>`).join("")}</div>` : ""}
      </div>
    </section>

    <section class="block alt" id="noticias">
      <div class="container">
        <p class="eyebrow">Noticias</p>
        <h2>Lo más reciente</h2>
        <p class="lead">La fundación publica sus noticias desde un panel sencillo, sin depender de nadie.</p>
        <div class="news">${noticias}</div>
      </div>
    </section>

    <section class="block donate" id="dona">
      <div class="container">
        <p class="eyebrow">Dona Aquí</p>
        <h2>Tu donación hace la diferencia</h2>
        <p class="lead">Cada aportación va directo a nuestros programas. Pago seguro, y recibes tu recibo por email.</p>
        <div class="donate-box">
          <div class="freq" role="group" aria-label="Frecuencia">
            <button type="button" class="chip" data-group="freq" aria-pressed="true">Una vez</button>
            <button type="button" class="chip" data-group="freq" aria-pressed="false">Mensual</button>
          </div>
          <div class="amounts" role="group" aria-label="Monto">
            ${montos.map((a, i) => `<button type="button" class="chip" data-group="amount" data-amount="${Number(a)}" aria-pressed="${i === 1}">$${Number(a)}</button>`).join("")}
            <button type="button" class="chip" data-group="amount" data-amount="" aria-pressed="false">Otro</button>
          </div>
          <button type="button" class="btn" id="donateBtn">Donar $${Number(montos[1] ?? montos[0])}</button>
          <p class="methods">PayPal · Tarjeta · ATH Móvil</p>
          <p class="msg" id="donateMsg" aria-live="polite"></p>
        </div>
      </div>
    </section>

    <footer class="site-footer">
      <div class="container">
        <span>© ${CURRENT_YEAR} ${e(name)}. Organización sin fines de lucro.</span>
        <div class="socials">${redes}</div>
      </div>
    </footer>
  </div>

  <script>
    const segButtons = document.querySelectorAll(".seg button");
    function setFase(f) {
      document.body.dataset.fase = f;
      segButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.fase === f)));
      if (location.hash !== "#fase" + f) history.replaceState(null, "", "#fase" + f);
      window.scrollTo(0, 0);
    }
    segButtons.forEach((b) => b.addEventListener("click", () => setFase(b.dataset.fase)));
    setFase(location.hash === "#fase1" ? "1" : "2");

    const donateBtn = document.getElementById("donateBtn");
    const donateMsg = document.getElementById("donateMsg");
    document.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        document.querySelectorAll('.chip[data-group="' + chip.dataset.group + '"]').forEach((c) => c.setAttribute("aria-pressed", "false"));
        chip.setAttribute("aria-pressed", "true");
        const amount = document.querySelector('.chip[data-group="amount"][aria-pressed="true"]').dataset.amount;
        const monthly = document.querySelector('.chip[data-group="freq"][aria-pressed="true"]').textContent === "Mensual";
        donateBtn.textContent = amount ? "Donar $" + amount + (monthly ? " al mes" : "") : "Donar otra cantidad";
      });
    });
    donateBtn.addEventListener("click", () => {
      donateMsg.textContent = "Demo: aquí se abre el pago seguro (PayPal, Stripe o ATH Móvil).";
    });
  </script>
</body>
</html>
`;
}

module.exports = { renderMaqueta };
