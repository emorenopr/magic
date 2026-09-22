const crypto = require("crypto");

// Reconstruye la URL pública exacta que Twilio llamó (incluye el query string),
// que es lo que Twilio firma.
function publicUrl(req) {
  const base = process.env.PUBLIC_BASE_URL;
  if (base) return base.replace(/\/$/, "") + req.url;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}${req.url}`;
}

// Verifica la cabecera X-Twilio-Signature para que nadie más pueda llamar
// este endpoint y gastar créditos de la API. Si TWILIO_AUTH_TOKEN no está
// configurado se omite la verificación (útil para pruebas locales).
function isValidTwilioRequest(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return true;

  const signature = req.headers["x-twilio-signature"];
  if (typeof signature !== "string") return false;

  const params = req.body && typeof req.body === "object" ? req.body : {};
  const data =
    publicUrl(req) +
    Object.keys(params)
      .sort()
      .map((key) => key + params[key])
      .join("");

  const expected = crypto.createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

module.exports = { isValidTwilioRequest, escapeXml };
