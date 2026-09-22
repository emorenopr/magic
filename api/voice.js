const Anthropic = require("@anthropic-ai/sdk").default;
const { getRedis } = require("../lib/redis");
const { BUSINESS_NAME, BUSINESS_FACTS } = require("../lib/business");
const { isValidTwilioRequest, escapeXml } = require("../lib/twilio");

// Línea telefónica con IA: Twilio recibe la llamada, convierte la voz del
// cliente a texto (<Gather input="speech">), este endpoint le pregunta a
// Claude y Twilio lee la respuesta en voz alta (<Say>). Se repite hasta que
// el cliente cuelga, se despide o pide hablar con una persona.

const client = new Anthropic();
const CHAT_LOG_LIMIT = 500;
const CALL_TTL_SECONDS = 60 * 60;
const MAX_TURNS = 16;
const MAX_SILENCES = 2;

const VOICE = process.env.TWILIO_VOICE || "Polly.Lupe-Neural";
const LANGUAGE = "es-US";

const TRANSFER_TAG = "[TRANSFERIR]";
const HANGUP_TAG = "[COLGAR]";

const SYSTEM_PROMPT = `Eres la recepcionista virtual que contesta el teléfono de ${BUSINESS_NAME}, una cafetería en Río Piedras, Puerto Rico.
Usa SOLO esta información para responder. Si preguntan algo que no sabes, dilo con honestidad.

${BUSINESS_FACTS}

Estás hablando por teléfono y tu respuesta se leerá en voz alta:
- Responde en español, en 1-3 oraciones cortas, con tono cálido y natural de Puerto Rico.
- Nada de emojis, viñetas, markdown ni URLs. Di los precios como se hablan ("dos dólares con cincuenta").
- Si la persona pide hablar con alguien del equipo, tiene una queja, un problema con un pedido, o algo que no puedes resolver con esta información, dile que la vas a comunicar con alguien y termina tu respuesta con ${TRANSFER_TAG}.
- Si la persona se despide o dice que no necesita nada más, despídete brevemente y termina tu respuesta con ${HANGUP_TAG}.
- En cualquier otro caso, termina ofreciendo ayuda con algo más.`;

const GREETING = `Gracias por llamar a ${BUSINESS_NAME}. Soy la asistente virtual. ¿En qué te puedo ayudar?`;
const FALLBACK_ERROR = "Disculpa, estoy teniendo problemas técnicos en este momento.";

// Sin Redis la conversación se guarda en memoria del proceso; funciona para
// pruebas, pero en serverless puede perderse entre turnos.
const memoryCalls = new Map();

async function loadHistory(redis, callSid) {
  if (!redis) return memoryCalls.get(callSid) ?? [];
  try {
    const raw = await redis.get(`call:${callSid}`);
    if (!raw) return [];
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error("No se pudo leer el historial de la llamada:", err);
    return [];
  }
}

async function saveHistory(redis, callSid, history) {
  const trimmed = history.slice(-MAX_TURNS);
  if (!redis) {
    memoryCalls.set(callSid, trimmed);
    return;
  }
  try {
    await redis.set(`call:${callSid}`, JSON.stringify(trimmed), { ex: CALL_TTL_SECONDS });
  } catch (err) {
    console.error("No se pudo guardar el historial de la llamada:", err);
  }
}

async function logExchange(redis, question, answer, from) {
  if (!redis) return;
  const logEntry = JSON.stringify({
    question,
    answer,
    channel: "phone",
    from: from ? String(from).slice(-4) : undefined,
    at: new Date().toISOString(),
  });
  try {
    await redis.lpush("chat_logs", logEntry);
    await redis.ltrim("chat_logs", 0, CHAT_LOG_LIMIT - 1);
  } catch (err) {
    console.error("No se pudo guardar el log de la llamada:", err);
  }
}

function say(text) {
  return `<Say voice="${VOICE}" language="${LANGUAGE}">${escapeXml(text)}</Say>`;
}

function gather(prompt, silences) {
  const action = `/api/voice?silences=${silences}`;
  return `<Gather input="speech" language="${LANGUAGE}" speechTimeout="auto" actionOnEmptyResult="true" action="${escapeXml(action)}" method="POST">${say(prompt)}</Gather>`;
}

function transfer(text) {
  const number = process.env.HUMAN_TRANSFER_NUMBER;
  if (!number) {
    return say(`${text} En este momento no hay nadie disponible. Por favor llama de nuevo en horario de servicio. ¡Gracias!`) + "<Hangup/>";
  }
  return say(text) + `<Dial timeout="25">${escapeXml(number)}</Dial>` +
    say("No pudimos comunicarte. Por favor intenta más tarde. ¡Gracias por llamar!") + "<Hangup/>";
}

function sendTwiml(res, body) {
  res.setHeader("Content-Type", "text/xml");
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`);
}

async function askClaude(history) {
  const response = await client.beta.messages.create({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages: history,
  });
  if (response.stop_reason === "refusal") return "";
  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text?.trim() ?? "";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!isValidTwilioRequest(req)) {
    res.status(403).json({ error: "Firma de Twilio inválida" });
    return;
  }

  const { CallSid: callSid, SpeechResult: speechResult, From: from } = req.body ?? {};
  if (typeof callSid !== "string" || !callSid) {
    res.status(400).json({ error: "CallSid is required" });
    return;
  }

  const isFirstTurn = !("silences" in (req.query ?? {}));
  if (isFirstTurn) {
    sendTwiml(res, gather(GREETING, 0));
    return;
  }

  const silences = parseInt(req.query.silences, 10) || 0;
  const heard = typeof speechResult === "string" ? speechResult.trim() : "";

  if (!heard) {
    if (silences + 1 >= MAX_SILENCES) {
      sendTwiml(res, say("Parece que no te escucho bien. Gracias por llamar, ¡que tengas buen día!") + "<Hangup/>");
    } else {
      sendTwiml(res, gather("Disculpa, no te escuché. ¿Me lo puedes repetir?", silences + 1));
    }
    return;
  }

  const redis = getRedis();
  const history = await loadHistory(redis, callSid);
  history.push({ role: "user", content: heard.slice(0, 800) });

  let answer;
  try {
    answer = await askClaude(history);
  } catch (error) {
    console.error("Anthropic API error:", error);
    sendTwiml(res, transfer(FALLBACK_ERROR));
    return;
  }

  if (!answer) {
    sendTwiml(res, transfer("Esa pregunta es mejor que la conteste alguien del equipo."));
    return;
  }

  const wantsTransfer = answer.includes(TRANSFER_TAG);
  const wantsHangup = answer.includes(HANGUP_TAG);
  const spoken = answer.replaceAll(TRANSFER_TAG, "").replaceAll(HANGUP_TAG, "").trim();

  history.push({ role: "assistant", content: spoken || answer });
  await saveHistory(redis, callSid, history);
  await logExchange(redis, heard, spoken, from);

  if (wantsTransfer) {
    sendTwiml(res, transfer(spoken));
  } else if (wantsHangup) {
    sendTwiml(res, say(spoken) + "<Hangup/>");
  } else {
    sendTwiml(res, gather(spoken, 0));
  }
};
