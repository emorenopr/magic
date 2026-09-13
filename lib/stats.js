const STOPWORDS = new Set([
  "de", "la", "el", "en", "que", "y", "a", "los", "se", "del", "las", "un", "por",
  "con", "no", "una", "su", "para", "es", "al", "lo", "como", "mas", "pero", "sus",
  "le", "ya", "o", "este", "si", "porque", "esta", "entre", "cuando", "muy", "sin",
  "sobre", "tambien", "me", "hasta", "hay", "donde", "quien", "quienes", "desde",
  "todo", "nos", "durante", "todos", "uno", "les", "ni", "contra", "otros", "ese",
  "eso", "ante", "ellos", "esto", "mi", "antes", "algunos", "unos", "yo", "otro",
  "otras", "otra", "tanto", "esa", "estos", "mucho", "nada", "muchos", "cual",
  "cuales", "poco", "ella", "estar", "estas", "algunas", "algo", "nosotros", "mis",
  "tu", "te", "ti", "tus", "ellas", "son", "soy", "eres", "somos", "sois", "estan",
  "tienen", "tiene", "tengo", "tienes", "hola", "gracias", "puedo", "puede",
  "podria", "quisiera", "quiero", "ustedes", "usted", "buenas", "buenos", "dias",
  "tardes", "noches", "favor", "porfa", "oye", "disculpa", "disculpe",
]);

function stripAccents(str) {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function dateKeyInPR(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function hourInPR(iso) {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Puerto_Rico",
    hour: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  return parseInt(hourStr, 10) % 24;
}

function computeStats(conversations) {
  const total = conversations.length;
  const now = new Date();

  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(dateKeyInPR(d.toISOString()));
  }
  const byDateMap = Object.fromEntries(days.map((d) => [d, 0]));
  const todayKey = dateKeyInPR(now.toISOString());

  const byHour = new Array(24).fill(0);
  const wordCounts = {};
  let today = 0;

  for (const c of conversations) {
    if (!c.at) continue;

    const dateKey = dateKeyInPR(c.at);
    if (dateKey in byDateMap) byDateMap[dateKey] += 1;
    if (dateKey === todayKey) today += 1;

    byHour[hourInPR(c.at)] += 1;

    const words = stripAccents((c.question || "").toLowerCase())
      .replace(/[^a-z0-9ñ\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

    for (const w of words) {
      wordCounts[w] = (wordCounts[w] || 0) + 1;
    }
  }

  const byDate = days.map((d) => ({ date: d, count: byDateMap[d] }));
  const topKeywords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }));

  return { total, today, byDate, byHour, topKeywords };
}

module.exports = { computeStats };
