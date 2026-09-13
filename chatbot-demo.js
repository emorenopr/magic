const launcher = document.getElementById("chatLauncher");
const panel = document.getElementById("chatPanel");
const closeBtn = document.getElementById("chatClose");
const body = document.getElementById("chatBody");
const form = document.getElementById("chatForm");
const input = document.getElementById("chatInput");
const sendBtn = document.getElementById("chatSend");
const onlineBadge = document.getElementById("onlineBadge");
const onlineNum = document.getElementById("onlineNum");
const menuPhotosBtn = document.getElementById("menuPhotosBtn");

const MENU_ITEMS = [
  { name: "Café con leche", price: "$2.50", image: "images/foto2.jpg" },
  { name: "Cortadito", price: "$2.25", icon: "☕" },
  { name: "Mallorca", price: "$3.50", icon: "🥐" },
  { name: "Pastelillo de guayaba", price: "$2.75", icon: "🥟" },
  { name: "Tostada de pan sobao", price: "$3.00", icon: "🍞" },
  { name: "Batida de parcha", price: "$4.00", icon: "🍹" },
];

const history = [];
let opened = false;

function getSessionId() {
  let id = sessionStorage.getItem("visitorSessionId");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2);
    sessionStorage.setItem("visitorSessionId", id);
  }
  return id;
}

async function pingPresence() {
  try {
    const res = await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: getSessionId() }),
    });
    const data = await res.json();
    if (typeof data.online === "number") {
      onlineNum.textContent = data.online;
      onlineBadge.hidden = false;
    }
  } catch {
    // si falla, simplemente no mostramos el contador
  }
}

pingPresence();
setInterval(pingPresence, 15000);

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

function addMenuGallery() {
  const el = document.createElement("div");
  el.className = "bubble gallery";

  const grid = document.createElement("div");
  grid.className = "menu-gallery";
  for (const item of MENU_ITEMS) {
    const tile = document.createElement("div");
    tile.className = "menu-tile";
    const media = item.image
      ? `<img src="${item.image}" alt="${item.name}" />`
      : `<div class="tile-icon">${item.icon}</div>`;
    tile.innerHTML =
      media +
      '<div class="tile-info">' +
      '<span class="name">' + item.name + "</span>" +
      '<span class="price">' + item.price + "</span>" +
      "</div>";
    grid.appendChild(tile);
  }
  el.appendChild(grid);

  const caption = document.createElement("p");
  caption.className = "gallery-caption";
  caption.textContent = "Vamos agregando fotos reales de cada plato poco a poco.";
  el.appendChild(caption);

  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
}

const PHOTO_KEYWORDS = /\bfoto|imagen|imágenes|fotos\b/i;

async function ask(question) {
  history.push({ role: "user", content: question });
  addBubble("user", question);

  const showedGallery = PHOTO_KEYWORDS.test(question);
  if (showedGallery) {
    addMenuGallery();
  }

  setBusy(true);
  const statusEl = addBubble("status", "Escribiendo...");

  const payload = showedGallery
    ? [
        ...history.slice(0, -1),
        {
          role: "user",
          content:
            question +
            "\n\n(Nota interna, no la menciones: ya se mostró una galería de fotos del menú en pantalla. No te disculpes por no poder mandar fotos ni digas que no puedes mostrar imágenes. Si la pregunta tiene algo más que responder, respóndelo normal; si no, solo confirma brevemente.)",
        },
      ]
    : history;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: payload }),
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
    addBubble("bot", "¡Hola! Soy el asistente de Café Coquí ☕ Pregúntame por el horario, el menú, o cómo llegar — o toca \"Ver fotos del menú\" arriba.");
  }
  input.focus();
});

closeBtn.addEventListener("click", () => {
  panel.hidden = true;
  launcher.hidden = false;
});

menuPhotosBtn.addEventListener("click", addMenuGallery);
