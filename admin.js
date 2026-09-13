const gate = document.getElementById("gate");
const list = document.getElementById("list");
const passwordInput = document.getElementById("passwordInput");
const enterBtn = document.getElementById("enterBtn");
const gateError = document.getElementById("gateError");

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
    renderConversations(data.conversations);
    gate.hidden = true;
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
