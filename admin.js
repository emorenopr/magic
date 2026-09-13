const gate = document.getElementById("gate");
const stats = document.getElementById("stats");
const listHeading = document.getElementById("listHeading");
const list = document.getElementById("list");
const passwordInput = document.getElementById("passwordInput");
const enterBtn = document.getElementById("enterBtn");
const gateError = document.getElementById("gateError");
const statTotal = document.getElementById("statTotal");
const statToday = document.getElementById("statToday");
const dayChart = document.getElementById("dayChart");
const hourChart = document.getElementById("hourChart");
const keywordList = document.getElementById("keywordList");

const DAY_LABELS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function renderBarChart(container, values, labelFn, tooltipFn) {
  const max = Math.max(1, ...values.map((v) => (typeof v === "number" ? v : v.count)));
  container.innerHTML = values
    .map((v, i) => {
      const count = typeof v === "number" ? v : v.count;
      const pct = Math.round((count / max) * 100);
      const label = labelFn(v, i);
      const tooltip = escapeHtml(tooltipFn(v, i));
      return `
        <div class="bar-col">
          <div class="bar" style="height:${pct}%" title="${tooltip}"></div>
          <span class="bar-label">${label}</span>
        </div>`;
    })
    .join("");
}

function renderStats(s) {
  if (!s) {
    stats.hidden = true;
    return;
  }

  statTotal.textContent = s.total;
  statToday.textContent = s.today;

  renderBarChart(
    dayChart,
    s.byDate,
    (d) => d.date.slice(8, 10),
    (d) => {
      const day = new Date(d.date + "T12:00:00");
      return `${DAY_LABELS[day.getDay()]} ${d.date}: ${d.count} conversaciones`;
    },
  );

  renderBarChart(
    hourChart,
    s.byHour,
    (_count, hour) => (hour % 3 === 0 ? hour + "h" : ""),
    (count, hour) => `${hour}:00 - ${count} conversaciones`,
  );

  if (!s.topKeywords || s.topKeywords.length === 0) {
    keywordList.innerHTML = '<li class="keyword-empty">Aún no hay suficientes datos.</li>';
  } else {
    keywordList.innerHTML = s.topKeywords
      .map(
        (k) => `
        <li>
          <span class="word">${escapeHtml(k.word)}</span>
          <span class="count">${k.count}</span>
        </li>`,
      )
      .join("");
  }

  stats.hidden = false;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderConversations(conversations) {
  if (!conversations || conversations.length === 0) {
    list.innerHTML = '<p class="empty">Todavía no hay conversaciones guardadas.</p>';
    return;
  }

  list.innerHTML = conversations
    .map((c) => {
      const when = c.at ? new Date(c.at).toLocaleString("es-PR") : "";
      return `
        <div class="entry">
          <div class="meta">${escapeHtml(when)}</div>
          <div class="q"><strong>Cliente:</strong> ${escapeHtml(c.question || "")}</div>
          <div class="a"><strong>Bot:</strong> ${escapeHtml(c.answer || "")}</div>
        </div>`;
    })
    .join("");
}

async function loadConversations(password) {
  gateError.hidden = true;
  enterBtn.disabled = true;

  try {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.status === 401) {
      sessionStorage.removeItem("adminPassword");
      gateError.textContent = "Contraseña incorrecta.";
      gateError.hidden = false;
      return;
    }

    if (!res.ok) {
      gateError.textContent = "Ocurrió un error al cargar las conversaciones.";
      gateError.hidden = false;
      return;
    }

    const data = await res.json();
    sessionStorage.setItem("adminPassword", password);
    renderStats(data.stats);
    renderConversations(data.conversations);
    gate.hidden = true;
    listHeading.hidden = false;
    list.hidden = false;
  } catch {
    gateError.textContent = "No se pudo conectar con el servidor.";
    gateError.hidden = false;
  } finally {
    enterBtn.disabled = false;
  }
}

enterBtn.addEventListener("click", () => {
  const password = passwordInput.value;
  if (!password) return;
  loadConversations(password);
});

passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") enterBtn.click();
});

const savedPassword = sessionStorage.getItem("adminPassword");
if (savedPassword) {
  loadConversations(savedPassword);
}
