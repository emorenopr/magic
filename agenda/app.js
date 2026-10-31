const WEEK_START = 0; // 0 = la semana empieza el domingo, 1 = el lunes
const OVERDUE_DAYS = 60;
const REFRESH_MS = 60000;
const MAX_CELL_ITEMS = 3;
const MAX_CHAT_HISTORY = 10;

const $ = (id) => document.getElementById(id);
const els = {
  gate: $("gate"),
  gateForm: $("gateForm"),
  gateInput: $("gateInput"),
  gateBtn: $("gateBtn"),
  gateError: $("gateError"),
  app: $("app"),
  monthTitle: $("monthTitle"),
  weekdays: $("weekdays"),
  grid: $("grid"),
  dayTitle: $("dayTitle"),
  dayCount: $("dayCount"),
  dayList: $("dayList"),
  overdueBlock: $("overdueBlock"),
  overdueList: $("overdueList"),
  addForm: $("addForm"),
  addTitle: $("addTitle"),
  addTime: $("addTime"),
  claudeForm: $("claudeForm"),
  claudeInput: $("claudeInput"),
  claudeBtn: $("claudeBtn"),
  claudeLog: $("claudeLog"),
  claudeMessages: $("claudeMessages"),
  connectDialog: $("connectDialog"),
  toast: $("toast"),
};

const now = new Date();
const state = {
  year: now.getFullYear(),
  month: now.getMonth(),
  today: Agenda.today(),
  selected: Agenda.today(),
  items: [],
  overdue: [],
  editingId: null,
  chat: [],
  claudeBusy: false,
};

const { escapeHtml, formatDate, formatTime, capitalize } = Agenda;

function formatTimeShort(time) {
  const [h, m] = time.split(":");
  const hour = Number(h);
  return `${hour % 12 || 12}${m === "00" ? "" : ":" + m}${hour < 12 ? "am" : "pm"}`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.hidden = true;
  }, 3500);
}

function gridRange() {
  const first = new Date(state.year, state.month, 1);
  const offset = (first.getDay() - WEEK_START + 7) % 7;
  const start = Agenda.addDays(Agenda.toDateStr(first), -offset);
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  return { start, end: Agenda.addDays(start, weeks * 7 - 1), days: weeks * 7 };
}

async function load() {
  const { start, end } = gridRange();
  const [items, past] = await Promise.all([
    Agenda.fetchRange(start, end),
    Agenda.fetchRange(Agenda.addDays(state.today, -OVERDUE_DAYS), Agenda.addDays(state.today, -1)),
  ]);
  state.items = items;
  state.overdue = past.filter((item) => !item.done);
  render();
}

function reload() {
  return load().catch((error) => {
    if (error.status === 401) return logout("Tu contraseña cambió. Entra de nuevo.");
    showToast(error.message || "No se pudo actualizar la agenda.");
  });
}

function itemsOn(date) {
  return state.items.filter((item) => item.date === date);
}

function findItem(id) {
  return state.items.find((item) => item.id === id) || state.overdue.find((item) => item.id === id);
}

function patchLocal(id, changes) {
  for (const list of [state.items, state.overdue]) {
    const item = list.find((i) => i.id === id);
    if (item) Object.assign(item, changes);
  }
}

// ---------- render ----------

function renderWeekdays() {
  // 2023-01-01 fue domingo: de ahí sacamos los nombres cortos de los días.
  els.weekdays.innerHTML = Array.from({ length: 7 }, (_, i) =>
    `<span>${formatDate(Agenda.addDays("2023-01-01", WEEK_START + i), { weekday: "short" }).replace(".", "")}</span>`,
  ).join("");
}

function renderMonth() {
  const monthStart = `${state.year}-${String(state.month + 1).padStart(2, "0")}-01`;
  els.monthTitle.textContent = capitalize(formatDate(monthStart, { month: "long", year: "numeric" }));

  const { start, days } = gridRange();
  const cells = [];
  for (let i = 0; i < days; i += 1) {
    const date = Agenda.addDays(start, i);
    const dayItems = itemsOn(date);
    const pending = dayItems.filter((item) => !item.done).length;
    const classes = ["cell"];
    if (Number(date.slice(5, 7)) - 1 !== state.month) classes.push("outside");
    if (date === state.today) classes.push("is-today");
    if (date === state.selected) classes.push("is-selected");
    if (date < state.today) classes.push("past");

    const preview = dayItems
      .slice(0, MAX_CELL_ITEMS)
      .map(
        (item) =>
          `<span class="cell-item${item.done ? " done" : ""}">${
            item.time ? `<b>${formatTimeShort(item.time)}</b> ` : ""
          }${escapeHtml(item.title)}</span>`,
      )
      .join("");
    const more = dayItems.length > MAX_CELL_ITEMS ? `<span class="cell-more">+${dayItems.length - MAX_CELL_ITEMS} más</span>` : "";
    const dots = dayItems
      .slice(0, 4)
      .map((item) => `<i class="${item.done ? "done" : ""}"></i>`)
      .join("");
    const label = `${formatDate(date, { weekday: "long", day: "numeric", month: "long" })}${
      dayItems.length ? `, ${pending} pendientes de ${dayItems.length}` : ""
    }`;

    cells.push(`
      <button type="button" class="${classes.join(" ")}" data-date="${date}" aria-label="${escapeHtml(label)}"
        aria-pressed="${date === state.selected}">
        <span class="cell-num">${Number(date.slice(8))}</span>
        <span class="cell-items">${preview}${more}</span>
        <span class="cell-dots">${dots}</span>
      </button>`);
  }
  els.grid.innerHTML = cells.join("");
}

function itemHtml(item, { overdue = false } = {}) {
  if (state.editingId === item.id) return editHtml(item);
  return `
    <li class="item${item.done ? " done" : ""}${overdue ? " late" : ""}" data-id="${item.id}">
      <button type="button" class="check" data-action="toggle" aria-pressed="${item.done}"
        aria-label="${item.done ? "Marcar como pendiente" : "Marcar como hecha"}"></button>
      <div class="item-body">
        <div class="item-line">
          ${item.time ? `<span class="item-time">${formatTime(item.time)}</span>` : ""}
          <span class="item-title">${escapeHtml(item.title)}</span>
        </div>
        ${overdue ? `<span class="item-from">Era para el ${formatDate(item.date, { weekday: "long", day: "numeric", month: "short" })}</span>` : ""}
        ${item.notes ? `<p class="item-notes">${escapeHtml(item.notes)}</p>` : ""}
      </div>
      <div class="item-actions">
        ${overdue ? `<button type="button" class="mini-btn" data-action="to-today">Pasar a hoy</button>` : ""}
        <button type="button" class="icon-btn" data-action="edit" aria-label="Editar">✎</button>
        <button type="button" class="icon-btn" data-action="delete" aria-label="Borrar">✕</button>
      </div>
    </li>`;
}

function editHtml(item) {
  return `
    <li class="item editing" data-id="${item.id}">
      <form class="edit-form" data-id="${item.id}">
        <input type="text" name="title" value="${escapeHtml(item.title)}" maxlength="200" required aria-label="Título">
        <div class="edit-row">
          <input type="date" name="date" value="${item.date}" required aria-label="Fecha">
          <input type="time" name="time" value="${item.time || ""}" aria-label="Hora">
        </div>
        <textarea name="notes" rows="2" maxlength="1000" placeholder="Notas (opcional)" aria-label="Notas">${escapeHtml(item.notes || "")}</textarea>
        <div class="edit-actions">
          <button type="button" class="ghost-btn" data-action="cancel">Cancelar</button>
          <button type="submit">Guardar</button>
        </div>
      </form>
    </li>`;
}

function renderDay() {
  const isToday = state.selected === state.today;
  const title = capitalize(formatDate(state.selected, { weekday: "long", day: "numeric", month: "long" }));
  els.dayTitle.innerHTML = `${escapeHtml(title)}${isToday ? ' <span class="today-tag">Hoy</span>' : ""}`;

  const dayItems = itemsOn(state.selected);
  const done = dayItems.filter((item) => item.done).length;
  els.dayCount.textContent = dayItems.length ? `${done} de ${dayItems.length} hechas` : "";

  els.dayList.innerHTML = dayItems.length
    ? dayItems.map((item) => itemHtml(item)).join("")
    : `<li class="empty">${isToday ? "Nada anotado para hoy." : "Nada anotado para este día."}</li>`;

  const showOverdue = isToday && state.overdue.length > 0;
  els.overdueBlock.hidden = !showOverdue;
  els.overdueList.innerHTML = showOverdue ? state.overdue.map((item) => itemHtml(item, { overdue: true })).join("") : "";
}

function render() {
  renderMonth();
  renderDay();
}

// ---------- navegación ----------

function selectDate(date) {
  state.selected = date;
  state.editingId = null;
  const [y, m] = date.split("-").map(Number);
  const monthChanged = y !== state.year || m - 1 !== state.month;
  state.year = y;
  state.month = m - 1;
  render();
  if (monthChanged) reload();
}

function shiftMonth(delta) {
  const d = new Date(state.year, state.month + delta, 1);
  state.year = d.getFullYear();
  state.month = d.getMonth();
  state.editingId = null;
  const todayInView = state.today.startsWith(`${state.year}-${String(state.month + 1).padStart(2, "0")}`);
  state.selected = todayInView ? state.today : Agenda.toDateStr(d);
  render();
  reload();
}

$("prevBtn").addEventListener("click", () => shiftMonth(-1));
$("nextBtn").addEventListener("click", () => shiftMonth(1));
$("todayBtn").addEventListener("click", () => selectDate(state.today));

els.grid.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (cell) selectDate(cell.dataset.date);
});

// ---------- acciones sobre tareas ----------

async function saveChanges(id, changes) {
  await Agenda.api(`/api/agenda?id=${id}`, { method: "PATCH", body: changes });
}

async function handleItemAction(event) {
  const button = event.target.closest("[data-action]");
  const row = event.target.closest(".item");
  if (!button || !row) return;
  const id = row.dataset.id;
  const item = findItem(id);
  if (!item) return;

  try {
    switch (button.dataset.action) {
      case "toggle": {
        const done = !item.done;
        patchLocal(id, { done });
        if (done) state.overdue = state.overdue.filter((i) => i.id !== id);
        render();
        try {
          await saveChanges(id, { done });
        } catch (error) {
          await reload();
          throw error;
        }
        break;
      }
      case "to-today":
        await saveChanges(id, { date: state.today });
        await reload();
        showToast(`“${item.title}” pasó a hoy.`);
        break;
      case "edit":
        state.editingId = id;
        renderDay();
        document.querySelector(".edit-form input[name=title]").focus();
        break;
      case "cancel":
        state.editingId = null;
        renderDay();
        break;
      case "delete":
        if (!confirm(`¿Borrar “${item.title}”?`)) return;
        await Agenda.api(`/api/agenda?id=${id}`, { method: "DELETE" });
        await reload();
        break;
    }
  } catch (error) {
    showToast(error.message || "No se pudo guardar el cambio.");
  }
}

async function handleEditSubmit(event) {
  const form = event.target.closest(".edit-form");
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  try {
    await saveChanges(form.dataset.id, {
      title: data.get("title"),
      date: data.get("date"),
      time: data.get("time") || null,
      notes: data.get("notes"),
    });
    state.editingId = null;
    await reload();
  } catch (error) {
    showToast(error.message || "No se pudo guardar el cambio.");
  }
}

for (const list of [els.dayList, els.overdueList]) {
  list.addEventListener("click", handleItemAction);
  list.addEventListener("submit", handleEditSubmit);
}

els.addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = els.addTitle.value.trim();
  if (!title) return;
  const button = els.addForm.querySelector("button");
  button.disabled = true;
  try {
    await Agenda.api("/api/agenda", {
      method: "POST",
      body: { title, date: state.selected, time: els.addTime.value || null },
    });
    els.addTitle.value = "";
    els.addTime.value = "";
    await reload();
    els.addTitle.focus();
  } catch (error) {
    showToast(error.message || "No se pudo agregar.");
  } finally {
    button.disabled = false;
  }
});

// ---------- Claude ----------

function appendBubble(role, text) {
  const bubble = document.createElement("p");
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;
  els.claudeMessages.appendChild(bubble);
  while (els.claudeMessages.children.length > 8) els.claudeMessages.firstElementChild.remove();
  els.claudeLog.hidden = false;
  els.claudeMessages.scrollTop = els.claudeMessages.scrollHeight;
  return bubble;
}

els.claudeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = els.claudeInput.value.trim();
  if (!message || state.claudeBusy) return;

  state.claudeBusy = true;
  els.claudeBtn.disabled = true;
  els.claudeInput.value = "";
  appendBubble("user", message);
  const answer = appendBubble("assistant pending", "Claude está pensando…");

  try {
    const data = await Agenda.api("/api/agenda-claude", {
      method: "POST",
      body: {
        message,
        history: state.chat.slice(-MAX_CHAT_HISTORY),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
    answer.textContent = data.text;
    answer.classList.remove("pending");
    state.chat.push({ role: "user", content: message }, { role: "assistant", content: data.text });
    if (data.changed) await reload();
  } catch (error) {
    answer.textContent = error.message || "Claude no pudo contestar.";
    answer.classList.remove("pending");
    answer.classList.add("error");
    if (error.data && error.data.changed) await reload();
  } finally {
    state.claudeBusy = false;
    els.claudeBtn.disabled = false;
    els.claudeMessages.scrollTop = els.claudeMessages.scrollHeight;
  }
});

$("claudeClear").addEventListener("click", () => {
  state.chat = [];
  els.claudeMessages.innerHTML = "";
  els.claudeLog.hidden = true;
});

// ---------- TV y conector de Claude ----------

$("connectBtn").addEventListener("click", () => {
  const key = encodeURIComponent(Agenda.getKey());
  $("tvShortUrl").textContent = `${location.origin}/tv`;
  $("tvKeyUrl").textContent = `${location.origin}/agenda/tv.html#k=${key}`;
  $("mcpUrl").textContent = `${location.origin}/api/mcp?key=${key}`;
  els.connectDialog.showModal();
});

els.connectDialog.addEventListener("click", async (event) => {
  const button = event.target.closest(".copy-btn");
  if (!button) return;
  const text = $(button.dataset.copy).textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "¡Copiado!";
  } catch {
    window.getSelection().selectAllChildren($(button.dataset.copy));
    button.textContent = "Selecciónalo y copia";
  }
  setTimeout(() => {
    button.textContent = "Copiar";
  }, 1800);
});

// ---------- entrada y refresco ----------

function showGate(message) {
  els.app.hidden = true;
  els.gate.hidden = false;
  els.gateError.hidden = !message;
  els.gateError.textContent = message || "";
  els.gateInput.focus();
}

function logout(message) {
  Agenda.clearKey();
  els.gateInput.value = "";
  showGate(message);
}

async function enter() {
  els.gateBtn.disabled = true;
  try {
    await load();
    els.gate.hidden = true;
    els.app.hidden = false;
  } catch (error) {
    if (error.status === 401) {
      logout("Contraseña incorrecta.");
    } else {
      showGate(error.status === 503 ? error.message : "No se pudo conectar con el servidor. Intenta de nuevo.");
    }
  } finally {
    els.gateBtn.disabled = false;
  }
}

els.gateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const key = els.gateInput.value;
  if (!key) return;
  Agenda.setKey(key);
  enter();
});

$("logoutBtn").addEventListener("click", () => logout());

function refresh() {
  if (els.app.hidden || document.visibilityState !== "visible" || state.editingId) return;
  const today = Agenda.today();
  if (today !== state.today) {
    // pasó la medianoche con la página abierta
    if (state.selected === state.today) state.selected = today;
    state.today = today;
    const [y, m] = today.split("-").map(Number);
    state.year = y;
    state.month = m - 1;
  }
  reload();
}

setInterval(refresh, REFRESH_MS);
document.addEventListener("visibilitychange", refresh);

renderWeekdays();
Agenda.takeKeyFromHash();
if (Agenda.getKey()) {
  enter();
} else {
  showGate();
}
