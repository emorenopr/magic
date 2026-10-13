#!/usr/bin/env node
// El CEO (IA) de Moreno LLC: recibe una meta, revisa el estado de la empresa,
// reparte el trabajo entre los departamentos y deja un informe.
//
//   npm run empresa:ceo                                      (informe del día)
//   npm run empresa:ceo -- --meta "Consigue 5 clientes nuevos en Bayamón"
//
// Nunca envía emails, publica, cobra ni gasta: esas acciones quedan como
// aprobaciones pendientes que revisas con `npm run empresa:aprobaciones`.

const { execFile } = require("child_process");
const { promisify } = require("util");
const Anthropic = require("@anthropic-ai/sdk").default;
const { parseArgs } = require("../prospector/lib/util");
const estado = require("./lib/estado");

const MODEL = "claude-opus-5-5";
const MAX_TURNOS = 25;
const MAX_SALIDA_SCRIPT = 4000;

const client = new Anthropic();
const run = promisify(execFile);

// Si un modelo declina la petición, la API la reintenta con otro modelo.
async function llamar(params) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    ...params,
  });
  if (response.stop_reason === "refusal") {
    throw new Error(`El modelo declinó la petición (${response.stop_details?.category || "sin categoría"}).`);
  }
  return response;
}

const texto = (response) =>
  response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

// --- Departamentos: cada uno es un agente con su propio rol ----------------

async function trabajoDeDepartamento(depId, tarea) {
  const org = estado.organigrama();
  const dep = estado.departamento(depId);
  const system = `Eres ${dep.jefe} en ${org.empresa}. ${org.mision}
Tus responsabilidades: ${dep.responsabilidades.join("; ")}.
El CEO te asigna una tarea. Entrega el trabajo terminado (borradores listos para revisar, listas, números), no un plan de lo que harías.
Reglas:
- Escribe en español, claro y directo, en Markdown.
- Usa SOLO los datos del estado de la empresa que te pasan. No inventes clientes, precios, resultados ni datos de contacto.
- Si falta información para hacerlo bien, entrega lo que puedas y di exactamente qué falta.
- Tú no envías ni publicas nada: lo que escribas lo revisa el dueño antes de que salga.`;

  const response = await llamar({
    system,
    output_config: { effort: "medium" },
    messages: [
      {
        role: "user",
        content: `Tarea del CEO:\n${tarea}\n\nEstado actual de la empresa (JSON):\n${JSON.stringify(estado.resumen(), null, 2)}`,
      },
    ],
  });
  return texto(response);
}

// --- Herramientas del CEO ---------------------------------------------------

const SCRIPTS = {
  prospector_auditar: { file: "prospector/audit.js", args: [] },
  prospector_generar: { file: "prospector/generate.js", args: [] },
  prospector_cotizar: { file: "prospector/cotizar.js", args: [] },
};

async function correrScript(file, args) {
  try {
    const { stdout, stderr } = await run(process.execPath, [file, ...args], {
      cwd: estado.REPO_DIR,
      timeout: 10 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return `${stdout}${stderr}`.slice(-MAX_SALIDA_SCRIPT) || "(sin salida)";
  } catch (error) {
    throw new Error(`${file} falló:\n${`${error.stdout || ""}${error.stderr || ""}`.slice(-MAX_SALIDA_SCRIPT) || error.message}`);
  }
}

const TOOLS = [
  {
    name: "ver_estado",
    description:
      "Devuelve el estado actual de la empresa: prospectos auditados, propuestas generadas, solicitudes y cotizaciones, aprobaciones y tareas recientes.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "asignar_tarea",
    description:
      "Asigna una tarea a un departamento. El jefe del departamento (otro agente) la hace en el momento y devuelve el trabajo terminado, que se guarda como entregable. Da instrucciones concretas: qué entregar, para quién y con qué datos.",
    input_schema: {
      type: "object",
      properties: {
        departamento: { type: "string", enum: ["ventas", "finanzas", "produccion", "soporte", "mercadeo"] },
        titulo: { type: "string", description: "Título corto del entregable" },
        tarea: { type: "string", description: "Instrucciones completas para el departamento" },
      },
      required: ["departamento", "titulo", "tarea"],
      additionalProperties: false,
    },
  },
  {
    name: "usar_herramienta",
    description: `Corre una herramienta interna de la empresa (no sale nada hacia afuera):
- prospector_auditar: revisa las webs de los prospectos en prospector/leads.csv y les da puntos.
- prospector_generar: crea una landing de propuesta + borrador de email por prospecto auditado.
- prospector_cotizar: regenera las cotizaciones (como BORRADOR) de prospector/solicitudes/.`,
    input_schema: {
      type: "object",
      properties: { herramienta: { type: "string", enum: Object.keys(SCRIPTS) } },
      required: ["herramienta"],
      additionalProperties: false,
    },
  },
  {
    name: "buscar_prospectos",
    description:
      "Busca negocios en Google Maps y los añade a prospector/leads.csv. Cuesta dinero (API de Google), así que SOLO funciona con una aprobación de tipo buscar_prospectos que el dueño ya aprobó. Si no hay, usa pedir_aprobacion.",
    input_schema: {
      type: "object",
      properties: { aprobacion_id: { type: "string", description: "ID de la aprobación aprobada, ej. A003" } },
      required: ["aprobacion_id"],
      additionalProperties: false,
    },
  },
  {
    name: "pedir_aprobacion",
    description:
      "Pide permiso al dueño para algo que sale de la empresa o cuesta dinero: enviar un email, publicar en redes, cobrar, gastar o buscar prospectos en Google Maps. Queda pendiente hasta que el dueño lo apruebe o rechace.",
    input_schema: {
      type: "object",
      properties: {
        departamento: { type: "string", enum: ["ventas", "finanzas", "produccion", "soporte", "mercadeo"] },
        tipo: { type: "string", enum: ["enviar_email", "publicar_redes", "cobrar", "gasto", "buscar_prospectos", "otro"] },
        resumen: { type: "string", description: "Una línea: qué se quiere hacer y por qué" },
        detalle: { type: "string", description: "El texto exacto a enviar/publicar, o el entregable donde está" },
        busqueda: {
          type: "string",
          description: "Solo para buscar_prospectos: la búsqueda de Google Maps, ej. \"dentistas en Caguas\"",
        },
        categoria: {
          type: "string",
          description: "Solo para buscar_prospectos: medico, dentista, abogado, restaurante, belleza, taller u otra",
        },
      },
      required: ["departamento", "tipo", "resumen"],
      additionalProperties: false,
    },
  },
  {
    name: "guardar_informe",
    description: "Guarda el informe final para el dueño en empresa/data/informes/<fecha>.md. Úsalo una vez, al terminar.",
    input_schema: {
      type: "object",
      properties: { contenido: { type: "string", description: "Informe en Markdown" } },
      required: ["contenido"],
      additionalProperties: false,
    },
  },
];

const HANDLERS = {
  async ver_estado() {
    return JSON.stringify(estado.resumen(), null, 2);
  },

  async asignar_tarea({ departamento, titulo, tarea }) {
    if (!estado.departamento(departamento)) throw new Error(`No existe el departamento "${departamento}".`);
    console.log(`  → ${departamento}: ${titulo}`);
    const trabajo = await trabajoDeDepartamento(departamento, tarea);
    const entregable = estado.guardarEntregable(departamento, titulo, trabajo);
    estado.guardarTarea({ departamento, tarea: titulo, detalle: tarea, entregable });
    return `Entregable guardado en ${entregable}:\n\n${trabajo}`;
  },

  async usar_herramienta({ herramienta }) {
    const script = SCRIPTS[herramienta];
    if (!script) throw new Error(`Herramienta desconocida: ${herramienta}`);
    console.log(`  ⚙ ${herramienta}`);
    return correrScript(script.file, script.args);
  },

  async buscar_prospectos({ aprobacion_id }) {
    const lista = estado.aprobaciones();
    const aprobacion = lista.find((a) => a.id === aprobacion_id);
    if (!aprobacion || aprobacion.tipo !== "buscar_prospectos") {
      throw new Error(`No hay una aprobación de buscar_prospectos con ID ${aprobacion_id}.`);
    }
    if (aprobacion.estado !== "aprobada") {
      throw new Error(`La aprobación ${aprobacion_id} está "${aprobacion.estado}", no aprobada. Hay que esperar al dueño.`);
    }
    const { busqueda, categoria } = aprobacion.parametros;
    if (!busqueda) throw new Error(`La aprobación ${aprobacion_id} no dice qué buscar.`);
    console.log(`  ⚙ buscar_prospectos: ${busqueda}`);
    const args = ["--q", busqueda, ...(categoria ? ["--categoria", categoria] : [])];
    const salida = await correrScript("prospector/discover.js", args);
    aprobacion.estado = "ejecutada";
    aprobacion.ejecutada = new Date().toISOString();
    estado.guardarAprobaciones(lista);
    return salida;
  },

  async pedir_aprobacion({ departamento, tipo, resumen, detalle, busqueda, categoria }) {
    const parametros = tipo === "buscar_prospectos" ? { busqueda, categoria } : {};
    const nueva = estado.pedirAprobacion({ departamento, tipo, resumen, detalle, parametros });
    console.log(`  ✋ Aprobación ${nueva.id} (${tipo}): ${resumen}`);
    return `Aprobación ${nueva.id} creada y pendiente del dueño.`;
  },

  async guardar_informe({ contenido }) {
    const file = estado.guardarInforme(contenido);
    return `Informe guardado en ${file}.`;
  },
};

// --- El CEO -----------------------------------------------------------------

function systemCeo() {
  const org = estado.organigrama();
  const deps = org.departamentos
    .map((d) => `- ${d.id} (${d.jefe}): ${d.responsabilidades.join("; ")}`)
    .join("\n");
  const aprobar = Object.entries(org.requiere_aprobacion)
    .map(([tipo, desc]) => `- ${tipo}: ${desc}`)
    .join("\n");

  return `Eres el ${org.ceo.cargo} de ${org.empresa}. ${org.mision}
Le respondes a ${org.dueno.nombre} (${org.dueno.cargo}). ${org.ceo.instrucciones}

Departamentos:
${deps}

Necesita aprobación del dueño (usa pedir_aprobacion, nunca lo hagas directo):
${aprobar}

Cómo trabajas:
1. Mira el estado de la empresa antes de decidir.
2. Reparte trabajo concreto con asignar_tarea. Pide solo lo que acerca la meta: es mejor 2-3 entregables útiles que 5 genéricos.
3. Si un entregable incluye algo para enviar o publicar, crea su aprobación con el texto exacto en "detalle".
4. No inventes datos. Si falta algo (emails, prospectos, API keys), dilo en el informe como un pendiente del dueño.
5. Termina con guardar_informe: qué se hizo, entregables (rutas), aprobaciones pendientes (IDs), y los 3 próximos pasos.
Escribe en español, directo y sin relleno.`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const meta =
    typeof args.meta === "string"
      ? args.meta
      : "Revisa el estado de la empresa y dame el informe del día: qué está pasando, qué es prioridad y qué necesitas de mí.";

  console.log(`CEO de ${estado.organigrama().empresa} trabajando en: ${meta}\n`);

  const messages = [
    {
      role: "user",
      content: `Meta del dueño para hoy (${new Date().toISOString().slice(0, 10)}):\n${meta}`,
    },
  ];

  for (let turno = 0; turno < MAX_TURNOS; turno++) {
    const response = await llamar({
      system: systemCeo(),
      tools: TOOLS,
      output_config: { effort: "high" },
      messages,
    });
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      const final = texto(response);
      if (final) console.log(`\n${final}`);
      return;
    }

    const resultados = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      try {
        const contenido = await HANDLERS[block.name](block.input || {});
        resultados.push({ type: "tool_result", tool_use_id: block.id, content: contenido });
      } catch (error) {
        console.log(`  ✗ ${block.name}: ${error.message.split("\n")[0]}`);
        resultados.push({ type: "tool_result", tool_use_id: block.id, content: error.message, is_error: true });
      }
    }
    messages.push({ role: "user", content: resultados });
  }

  console.log(`\nEl CEO llegó al límite de ${MAX_TURNOS} turnos sin terminar. Revisa empresa/data/ para ver lo que hizo.`);
}

main().catch((error) => {
  if (error instanceof Anthropic.AuthenticationError) {
    console.error("Falta ANTHROPIC_API_KEY (o no es válida). Ponla en tu .env o en el entorno.");
  } else {
    console.error(error.message || error);
  }
  process.exit(1);
});
