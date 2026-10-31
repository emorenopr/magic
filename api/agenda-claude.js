const Anthropic = require("@anthropic-ai/sdk").default;
const { AgendaError, checkAccess, nowIn, resolveTimeZone } = require("../lib/agenda");
const { claudeTools, runTool, WRITE_TOOLS } = require("../lib/agenda-tools");

const client = new Anthropic();

const MAX_STEPS = 8;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY = 10;

const SYSTEM_PROMPT = `Eres el asistente de una agenda personal. La persona te escribe como quien anota en una libreta ("mañana a las 3 dentista y comprar leche") o te pregunta qué tiene pendiente, y tú usas las herramientas de la agenda para anotar, mover, completar, borrar o consultar.

- Cada cosa distinta va en su propia entrada. Si no dice fecha, es para hoy. Si no dice hora, déjala sin hora: es un pendiente del día.
- "El viernes" es el próximo viernes a partir de hoy. Si algo se repite y no dice hasta cuándo, anótalo para las próximas 4 semanas.
- Para editar, completar o borrar, busca primero con ver_agenda. Si no está claro a cuál tarea se refiere, pregunta antes de borrar.
- Contesta en español, corto y cálido, confirmando lo que hiciste con la fecha en palabras (ej. "el viernes 6 de noviembre a las 3:00 pm"). Usa formato de 12 horas. Para listas, una cosa por línea; sin markdown.`;

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  const turns = history
    .filter(
      (turn) =>
        turn &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string" &&
        turn.content.length > 0 &&
        turn.content.length <= 4000,
    )
    .slice(-MAX_HISTORY)
    .map((turn) => ({ role: turn.role, content: turn.content }));
  while (turns.length > 0 && turns[0].role !== "user") turns.shift();
  return turns;
}

async function runToolBlock(block, timeZone) {
  try {
    const result = await runTool(block.name, block.input, { timeZone });
    return { ok: true, content: JSON.stringify(result) };
  } catch (error) {
    if (!(error instanceof AgendaError)) throw error;
    return { ok: false, content: error.message };
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const denied = checkAccess(req);
  if (denied) {
    res.status(denied.status).json({ error: denied.error });
    return;
  }

  const { message, history, tz } = req.body ?? {};
  if (typeof message !== "string" || !message.trim() || message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: "Escribe un mensaje (máximo 1000 caracteres)." });
    return;
  }

  const timeZone = resolveTimeZone(tz);
  const now = nowIn(timeZone);
  const system = `${SYSTEM_PROMPT}\n\nHoy es ${now.weekday} ${now.date} y son las ${now.time} (zona horaria ${timeZone}).`;
  const messages = [...cleanHistory(history), { role: "user", content: message.trim() }];
  let changed = false;

  try {
    for (let step = 0; step < MAX_STEPS; step += 1) {
      const response = await client.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        output_config: { effort: "low" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        tools: claudeTools,
        messages,
      });

      if (response.stop_reason === "refusal") {
        res.status(200).json({ text: "No puedo ayudarte con eso.", changed });
        return;
      }

      messages.push({ role: "assistant", content: response.content });
      if (response.stop_reason === "pause_turn") continue;

      const toolUses = response.content.filter((block) => block.type === "tool_use");
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        const text = response.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n")
          .trim();
        res.status(200).json({ text: text || "Listo.", changed });
        return;
      }

      const results = await Promise.all(toolUses.map((block) => runToolBlock(block, timeZone)));
      toolUses.forEach((block, i) => {
        if (results[i].ok && WRITE_TOOLS.has(block.name)) changed = true;
      });
      messages.push({
        role: "user",
        content: toolUses.map((block, i) => ({
          type: "tool_result",
          tool_use_id: block.id,
          content: results[i].content,
          ...(results[i].ok ? {} : { is_error: true }),
        })),
      });
    }

    res.status(200).json({ text: "Hice algunos cambios pero no pude terminar. Revisa la agenda.", changed });
  } catch (error) {
    console.error("Agenda Claude error:", error);
    let message = "Claude no pudo contestar ahora. Intenta de nuevo.";
    if (error instanceof Anthropic.AuthenticationError) {
      message = "Falta configurar ANTHROPIC_API_KEY en el servidor.";
    } else if (error instanceof Anthropic.RateLimitError) {
      message = "Claude está muy ocupado. Intenta en un minuto.";
    } else if (error instanceof AgendaError) {
      message = error.message;
    }
    res.status(502).json({ error: message, changed });
  }
};
