const Anthropic = require("@anthropic-ai/sdk").default;
const { getRedis } = require("../lib/redis");

const client = new Anthropic();
const CHAT_LOG_LIMIT = 500;

const SYSTEM_PROMPT = `Eres el asistente virtual de Café Coquí, una cafetería en Río Piedras, Puerto Rico.
Usa SOLO esta información para responder. Si preguntan algo que no sabes, dilo con honestidad y sugiere llamar al negocio.

- Horario: lunes a viernes 6:30am-6:00pm, sábados 7:00am-3:00pm, domingos cerrado.
- Dirección: 154 Calle Georgetti, Río Piedras, PR.
- Wifi gratis para clientes (la contraseña se da en caja).
- Pagos: efectivo, ATH Móvil, tarjeta de crédito/débito.
- Menú: Café con leche $2.50, Cortadito $2.25, Mallorca $3.50, Pastelillo de guayaba y queso $2.75, Tostada de pan sobao $3.00, Batida de parcha $4.00.
- Hay mesas afuera y el patio es pet-friendly.
- No hacen delivery propio, pero están en Uber Eats.

Responde siempre en español, en 2-4 oraciones, con un tono cálido y directo. Si preguntan algo fuera del negocio, redirige amablemente hacia temas del café.`;

const MAX_TURNS = 12;
const MAX_MESSAGE_LENGTH = 800;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { messages } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages is required" });
    return;
  }

  const validTurns = messages.every(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.length > 0 &&
      m.content.length <= MAX_MESSAGE_LENGTH,
  );

  if (!validTurns || messages[messages.length - 1].role !== "user") {
    res.status(400).json({ error: "Invalid conversation format" });
    return;
  }

  const trimmedHistory = messages.slice(-MAX_TURNS);

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: trimmedHistory,
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const answer = textBlock?.text ?? "";

    const redis = getRedis();
    if (redis) {
      const lastUserMessage = trimmedHistory[trimmedHistory.length - 1];
      const logEntry = JSON.stringify({
        question: lastUserMessage.content,
        answer,
        at: new Date().toISOString(),
      });
      try {
        await redis.lpush("chat_logs", logEntry);
        await redis.ltrim("chat_logs", 0, CHAT_LOG_LIMIT - 1);
      } catch (err) {
        console.error("No se pudo guardar el log de chat:", err);
      }
    }

    res.status(200).json({ text: answer });
  } catch (error) {
    console.error("Anthropic API error:", error);
    res.status(502).json({ error: "No se pudo generar una respuesta." });
  }
};
