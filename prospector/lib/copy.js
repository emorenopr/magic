// Textos de la landing y del email. Sin API key usa plantillas por categoria;
// con --ia usa Claude para escribir textos a la medida de cada negocio.

const COPY_SCHEMA = {
  type: "object",
  properties: {
    tagline: { type: "string", description: "Frase corta para el hero (max 12 palabras)" },
    about: { type: "string", description: "Parrafo 'Sobre nosotros' de 2-3 oraciones" },
    services: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["name", "description"],
        additionalProperties: false,
      },
    },
    email_hook: {
      type: "string",
      description: "1-2 oraciones personalizadas para abrir el email de propuesta, mencionando algo especifico del negocio",
    },
  },
  required: ["tagline", "about", "services", "email_hook"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Eres un copywriter que prepara páginas web de propuesta para negocios locales en Puerto Rico y Latinoamérica.
Escribe en español neutro-caribeño, cálido y profesional, sin exageraciones.
Reglas estrictas:
- Usa SOLO los datos que te den. No inventes premios, años de experiencia, certificaciones, precios, nombres de doctores ni planes médicos específicos.
- Si falta información, escribe de forma general en vez de inventar.
- Servicios: 4 a 6, con descripciones de una oración.`;

function splitList(value) {
  return (value || "")
    .split(/[;|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function defaultCopy(lead, preset) {
  const custom = splitList(lead.servicios);
  const services = (custom.length ? custom : preset.services).map((name) => ({ name, description: "" }));
  const ex = lead.audit?.extracted || {};
  return {
    tagline: lead.eslogan || preset.tagline(lead),
    about: ex.description && ex.description.length > 60 ? ex.description : preset.about(lead),
    services,
    email_hook: "",
    source: "plantilla",
  };
}

let client;
function getClient() {
  if (client === undefined) {
    const Anthropic = require("@anthropic-ai/sdk").default;
    client = new Anthropic();
  }
  return client;
}

async function aiCopy(lead, preset) {
  const ex = lead.audit?.extracted || {};
  const facts = {
    nombre: lead.nombre,
    tipo: preset.label,
    categoria_original: lead.categoria,
    ciudad: lead.ciudad,
    direccion: lead.direccion,
    horario: lead.horario,
    servicios_conocidos: splitList(lead.servicios),
    eslogan_actual: lead.eslogan,
    notas_del_vendedor: lead.notas,
    web_actual: lead.web || "(no tiene)",
    titulo_web_actual: ex.title,
    descripcion_web_actual: ex.description,
    texto_web_actual: ex.textSample,
    problemas_detectados_en_su_web: lead.audit?.reasons,
  };

  const response = await getClient().beta.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: COPY_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Escribe los textos de la landing de propuesta para este negocio:\n\n${JSON.stringify(facts, null, 2)}`,
      },
    ],
  });

  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    throw new Error(`Claude no completó la respuesta (${response.stop_reason})`);
  }
  const text = response.content.find((b) => b.type === "text")?.text;
  const parsed = JSON.parse(text);
  // Si el CSV trae eslogan propio, respetarlo.
  if (lead.eslogan) parsed.tagline = lead.eslogan;
  return { ...parsed, source: "ia" };
}

function buildEmail(lead, copy, proposalUrl, config) {
  const reasons = (lead.audit?.reasons || []).filter((r) => r !== "No tiene página web").slice(0, 3);
  const greeting = /medic|dentista/.test(lead.presetKey) ? `Saludos, equipo de ${lead.nombre}:` : `Hola, equipo de ${lead.nombre}:`;

  let problem;
  if (lead.audit?.status === "sin-web") {
    problem = `Busqué ${lead.nombre} en Google y no encontré una página web. Hoy la mayoría de los clientes buscan en el celular antes de llamar, y sin web ese cliente muchas veces termina en otro lugar.`;
  } else if (lead.audit?.status === "caida") {
    problem = `Intenté entrar a ${lead.web} y la página no está abriendo. Cada día que está caída, los clientes que la buscan ven un error.`;
  } else {
    problem = `Visité ${lead.web} y noté algunas cosas que le pueden estar costando clientes:\n${reasons.map((r) => `  • ${r}`).join("\n")}`;
  }

  const subject =
    lead.audit?.status === "sin-web"
      ? `Preparé una página web para ${lead.nombre} (vista previa gratis)`
      : `Una versión nueva de la web de ${lead.nombre} (vista previa)`;

  const body = [
    greeting,
    "",
    copy.email_hook || "",
    problem,
    "",
    "Para que no tenga que imaginárselo, preparé una propuesta de cómo se vería su nueva página, con su información:",
    proposalUrl,
    "",
    "Se ve bien en celular, tiene botones para llamar y escribir por WhatsApp, y aparece mejor en Google. Si le gusta, la dejamos lista en pocos días; si quiere cambios, los hacemos.",
    "",
    `¿Le puedo llamar 10 minutos esta semana para enseñársela?`,
    "",
    config.nombre,
    [config.telefono, config.email].filter(Boolean).join(" · "),
    "",
    "P.D. Si no le interesa, responda \"no\" y no le vuelvo a escribir.",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
    .replace(/^\n+/, "");

  return { subject, body };
}

module.exports = { defaultCopy, aiCopy, buildEmail, splitList };
