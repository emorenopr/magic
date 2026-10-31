const { AgendaError, DEFAULT_TZ, addItems, deleteItem, listItems, nowIn, updateItem } = require("./agenda");

// Las mismas herramientas las usan el asistente de la página (api/agenda-claude.js)
// y el conector para la app de Claude (api/mcp.js).
const ITEM_FIELDS = {
  title: { type: "string", description: "Qué hay que hacer, corto y claro (ej. 'Cita con el dentista')." },
  date: { type: "string", description: "Fecha en formato YYYY-MM-DD." },
  time: {
    type: "string",
    description: "Hora en formato 24h HH:MM (ej. '15:30'). Omítela si es un pendiente del día sin hora fija.",
  },
  notes: { type: "string", description: "Detalles opcionales: dirección, qué llevar, teléfono, etc." },
};

const TOOL_DEFS = [
  {
    name: "ver_agenda",
    title: "Ver agenda",
    readOnly: true,
    description:
      "Lista las tareas y citas entre dos fechas (inclusive), con su id, hora y si ya están hechas. " +
      "Úsala para contestar qué hay pendiente y antes de editar o borrar, para conseguir el id.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Fecha inicial YYYY-MM-DD." },
        to: { type: "string", description: "Fecha final YYYY-MM-DD (máximo ~13 meses después de from)." },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "agregar_a_agenda",
    title: "Agregar a la agenda",
    description:
      "Agrega una o varias tareas o citas. Si algo se repite (ej. 'todos los lunes'), " +
      "crea una entrada por cada fecha.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Las tareas a agregar (máximo 31 por llamada).",
          items: {
            type: "object",
            properties: ITEM_FIELDS,
            required: ["title", "date"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
  {
    name: "editar_en_agenda",
    title: "Editar en la agenda",
    description:
      "Cambia una tarea existente: título, fecha, hora o notas, o la marca como hecha o pendiente. " +
      "Solo envía los campos que cambian. Para quitarle la hora, envía time como cadena vacía.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "El id de la tarea, tal como lo devuelve ver_agenda." },
        ...ITEM_FIELDS,
        done: { type: "boolean", description: "true si ya se hizo, false para volver a dejarla pendiente." },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "borrar_de_agenda",
    title: "Borrar de la agenda",
    destructive: true,
    description:
      "Borra una tarea para siempre. Para algo que ya se hizo, es mejor marcarlo como hecho con editar_en_agenda.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "El id de la tarea, tal como lo devuelve ver_agenda." },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
];

const WRITE_TOOLS = new Set(["agregar_a_agenda", "editar_en_agenda", "borrar_de_agenda"]);

const claudeTools = TOOL_DEFS.map(({ name, description, input_schema }) => ({ name, description, input_schema }));

const mcpTools = TOOL_DEFS.map((tool) => ({
  name: tool.name,
  title: tool.title,
  description: tool.description,
  inputSchema: tool.input_schema,
  annotations: {
    title: tool.title,
    readOnlyHint: Boolean(tool.readOnly),
    destructiveHint: Boolean(tool.destructive),
  },
}));

function publicItem(item) {
  const view = { id: item.id, title: item.title, date: item.date, done: item.done };
  if (item.time) view.time = item.time;
  if (item.notes) view.notes = item.notes;
  return view;
}

function today(timeZone) {
  const now = nowIn(timeZone);
  return `${now.weekday} ${now.date}, ${now.time}`;
}

async function runTool(name, input, { timeZone = DEFAULT_TZ } = {}) {
  const args = input || {};
  switch (name) {
    case "ver_agenda": {
      const items = await listItems(args.from, args.to);
      return { hoy: today(timeZone), items: items.map(publicItem) };
    }
    case "agregar_a_agenda": {
      const items = await addItems(args.items);
      return { agregadas: items.map(publicItem) };
    }
    case "editar_en_agenda": {
      const { id, ...changes } = args;
      const item = await updateItem(id, changes);
      return { actualizada: publicItem(item) };
    }
    case "borrar_de_agenda": {
      const item = await deleteItem(args.id);
      return { borrada: publicItem(item) };
    }
    default:
      throw new AgendaError(`Herramienta desconocida: ${name}`);
  }
}

module.exports = { claudeTools, mcpTools, runTool, WRITE_TOOLS };
