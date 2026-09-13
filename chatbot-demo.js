const launcher = document.getElementById("chatLauncher");
const panel = document.getElementById("chatPanel");
const closeBtn = document.getElementById("chatClose");
const body = document.getElementById("chatBody");
const form = document.getElementById("chatForm");
const input = document.getElementById("chatInput");
const sendBtn = document.getElementById("chatSend");

const history = [];
let opened = false;

function addBubble(role, text) {
  const el = document.createElement("div");
  el.className = "bubble " + role;
  el.textContent = text;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
  return el;
}

function setBusy(busy) {
  input.disabled = busy;
  sendBtn.disabled = busy;
}

async function ask(question) {
  history.push({ role: "user", content: question });
  addBubble("user", question);
  setBusy(true);
  const statusEl = addBubble("status", "Escribiendo...");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "request_failed");
    }

    statusEl.className = "bubble bot";
    statusEl.textContent = data.text;
    history.push({ role: "assistant", content: data.text });
  } catch (err) {
    statusEl.className = "bubble bot";
    statusEl.textContent = "No pude responder en este momento. Intenta de nuevo en un rato.";
    history.pop();
  } finally {
    setBusy(false);
    input.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question) return;
  input.value = "";
  ask(question);
});

launcher.addEventListener("click", () => {
  panel.hidden = false;
  launcher.hidden = true;
  if (!opened) {
    opened = true;
    addBubble("bot", "¡Hola! Soy el asistente de Café Coquí ☕ Pregúntame por el horario, el menú, o cómo llegar.");
  }
  input.focus();
});

closeBtn.addEventListener("click", () => {
  panel.hidden = true;
  launcher.hidden = false;
});
