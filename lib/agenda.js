const crypto = require("crypto");
const { getRedis } = require("./redis");

// Cada mes vive en su propio hash (agenda:mes:2026-10 -> id -> tarea en JSON),
// así cargar un rango solo lee los meses que toca. agenda:donde guarda en qué
// mes está cada id, para poder editar o borrar sabiendo solo el id.
const WHERE_KEY = "agenda:donde";
const DEFAULT_TZ = process.env.AGENDA_TZ || "America/Puerto_Rico";

const MAX_RANGE_DAYS = 400;
const MAX_BATCH = 31;
const MAX_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 1000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(\d{1,2}):([0-5]\d)$/;
const ID_RE = /^[a-f0-9]{12}$/;

class AgendaError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function monthKey(month) {
  return `agenda:mes:${month}`;
}

function isValidDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(date, days) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);
}

function monthsBetween(from, to) {
  const months = [];
  let [year, month] = from.split("-").map(Number);
  const last = to.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    months.push(key);
    if (key >= last) return months;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
}

function resolveTimeZone(timeZone) {
  if (typeof timeZone === "string" && timeZone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone });
      return timeZone;
    } catch {
      // zona horaria inválida: usamos la de por defecto
    }
  }
  return DEFAULT_TZ;
}

function nowIn(timeZone = DEFAULT_TZ) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const weekday = new Intl.DateTimeFormat("es", { timeZone: "UTC", weekday: "long" }).format(
    new Date(date + "T12:00:00Z"),
  );
  return { date, time: `${parts.hour}:${parts.minute}`, weekday, timeZone };
}

function normalizeTime(value) {
  if (value === null || value === "") return null;
  const match = typeof value === "string" ? value.trim().match(TIME_RE) : null;
  if (!match || Number(match[1]) > 23) {
    throw new AgendaError(`Hora inválida: ${value}. Usa HH:MM en formato de 24 horas.`);
  }
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

// Copia solo los campos conocidos de `input` sobre `base`, validándolos.
// Un campo ausente (undefined) deja el valor de `base` tal cual.
function applyFields(base, input) {
  const item = { ...base };
  if (input.title !== undefined) {
    if (typeof input.title !== "string" || !input.title.trim()) {
      throw new AgendaError("El título no puede estar vacío.");
    }
    item.title = input.title.trim().slice(0, MAX_TITLE_LENGTH);
  }
  if (input.date !== undefined) {
    if (!isValidDate(input.date)) {
      throw new AgendaError(`Fecha inválida: ${input.date}. Usa YYYY-MM-DD.`);
    }
    item.date = input.date;
  }
  if (input.time !== undefined) {
    item.time = normalizeTime(input.time);
  }
  if (input.notes !== undefined) {
    if (input.notes !== null && typeof input.notes !== "string") {
      throw new AgendaError("Las notas deben ser texto.");
    }
    item.notes = (input.notes || "").trim().slice(0, MAX_NOTES_LENGTH);
  }
  if (input.done !== undefined) {
    if (typeof input.done !== "boolean") {
      throw new AgendaError("El campo done debe ser true o false.");
    }
    item.done = input.done;
  }
  return item;
}

function compareItems(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
  if (a.time && !b.time) return -1;
  if (!a.time && b.time) return 1;
  return (a.createdAt || "").localeCompare(b.createdAt || "");
}

function parseStored(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function requireRedis() {
  const redis = getRedis();
  if (!redis) {
    throw new AgendaError(
      "La agenda necesita una base de datos Redis. Conéctala en Vercel (Storage -> Create Database).",
      503,
    );
  }
  return redis;
}

async function writeItem(redis, item) {
  const month = item.date.slice(0, 7);
  await redis.hset(monthKey(month), { [item.id]: JSON.stringify(item) });
  await redis.hset(WHERE_KEY, { [item.id]: month });
}

async function listItems(from, to) {
  if (!isValidDate(from) || !isValidDate(to)) {
    throw new AgendaError("Indica las fechas desde y hasta en formato YYYY-MM-DD.");
  }
  if (from > to) throw new AgendaError("La fecha inicial va después de la final.");
  if (daysBetween(from, to) > MAX_RANGE_DAYS) {
    throw new AgendaError(`El rango máximo es de ${MAX_RANGE_DAYS} días.`);
  }

  const redis = requireRedis();
  const hashes = await Promise.all(monthsBetween(from, to).map((month) => redis.hgetall(monthKey(month))));
  return hashes
    .flatMap((hash) => Object.values(hash || {}))
    .map(parseStored)
    .filter((item) => item && item.date >= from && item.date <= to)
    .sort(compareItems);
}

async function addItems(inputs) {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new AgendaError("No hay nada que agregar.");
  }
  if (inputs.length > MAX_BATCH) {
    throw new AgendaError(`Máximo ${MAX_BATCH} tareas a la vez.`);
  }

  const createdAt = new Date().toISOString();
  // Validamos todo antes de escribir, para no dejar la mitad guardada.
  const items = inputs.map((input) => {
    const item = applyFields(
      { id: crypto.randomBytes(6).toString("hex"), title: "", date: "", time: null, notes: "", done: false, createdAt },
      input || {},
    );
    if (!item.title) throw new AgendaError("Cada tarea necesita un título.");
    if (!item.date) throw new AgendaError("Cada tarea necesita una fecha.");
    return item;
  });

  const redis = requireRedis();
  await Promise.all(items.map((item) => writeItem(redis, item)));
  return items;
}

async function getItem(redis, id) {
  if (typeof id !== "string" || !ID_RE.test(id)) return null;
  const month = await redis.hget(WHERE_KEY, id);
  if (!month) return null;
  return parseStored(await redis.hget(monthKey(String(month)), id));
}

async function updateItem(id, changes) {
  const redis = requireRedis();
  const existing = await getItem(redis, id);
  if (!existing) throw new AgendaError("No encontré esa tarea.", 404);

  const updated = applyFields(existing, changes || {});
  updated.updatedAt = new Date().toISOString();
  await writeItem(redis, updated);

  const oldMonth = existing.date.slice(0, 7);
  if (oldMonth !== updated.date.slice(0, 7)) {
    await redis.hdel(monthKey(oldMonth), id);
  }
  return updated;
}

async function deleteItem(id) {
  const redis = requireRedis();
  const existing = await getItem(redis, id);
  if (!existing) throw new AgendaError("No encontré esa tarea.", 404);

  await redis.hdel(monthKey(existing.date.slice(0, 7)), id);
  await redis.hdel(WHERE_KEY, id);
  return existing;
}

function readKey(req) {
  const custom = req.headers["x-agenda-key"];
  if (typeof custom === "string" && custom) {
    try {
      return decodeURIComponent(custom);
    } catch {
      return custom;
    }
  }
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  if (req.query && typeof req.query.key === "string") return req.query.key;
  return "";
}

// Devuelve null si la petición trae la contraseña correcta, o { status, error }.
function checkAccess(req) {
  const expected = process.env.AGENDA_PASSWORD;
  if (!expected) {
    return { status: 503, error: "AGENDA_PASSWORD no está configurado en el servidor." };
  }
  const digest = (value) => crypto.createHash("sha256").update(value).digest();
  if (!crypto.timingSafeEqual(digest(readKey(req)), digest(expected))) {
    return { status: 401, error: "Contraseña incorrecta." };
  }
  return null;
}

function sendError(res, error, fallbackMessage) {
  if (error instanceof AgendaError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error("Agenda error:", error);
  res.status(502).json({ error: fallbackMessage || "Ocurrió un error con la agenda." });
}

module.exports = {
  AgendaError,
  DEFAULT_TZ,
  addDays,
  addItems,
  checkAccess,
  deleteItem,
  listItems,
  nowIn,
  resolveTimeZone,
  sendError,
  updateItem,
};
