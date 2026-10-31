const { AgendaError, DEFAULT_TZ, checkAccess } = require("../lib/agenda");
const { mcpTools, runTool } = require("../lib/agenda-tools");

// Conector MCP (Streamable HTTP, sin estado) para usar la agenda desde la app
// de Claude: Configuración -> Conectores -> Agregar conector personalizado, con
// la URL https://<tu-sitio>/api/mcp?key=<AGENDA_PASSWORD>.
const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "mi-agenda", title: "Mi Agenda", version: "1.0.0" };
const INSTRUCTIONS =
  `Agenda personal de tareas y citas. Las fechas van en YYYY-MM-DD y las horas en HH:MM (24h), ` +
  `en la zona horaria ${DEFAULT_TZ}. Para editar o borrar, consigue primero el id con ver_agenda. ` +
  `Al hablar con la persona usa fechas en palabras y horas en formato de 12 horas.`;

const reply = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

async function handleMessage(message) {
  if (!message || typeof message !== "object" || message.jsonrpc !== "2.0") {
    return rpcError(null, -32600, "Invalid Request");
  }
  // Notificaciones (sin id) y respuestas del cliente no llevan contestación.
  if (message.id === undefined || message.id === null || typeof message.method !== "string") {
    return null;
  }

  const { id, method } = message;
  const params = message.params || {};
  switch (method) {
    case "initialize": {
      const requested = params.protocolVersion;
      return reply(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, { tools: mcpTools });
    case "tools/call": {
      if (!mcpTools.some((tool) => tool.name === params.name)) {
        return rpcError(id, -32602, `Herramienta desconocida: ${params.name}`);
      }
      try {
        const result = await runTool(params.name, params.arguments);
        return reply(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (error) {
        if (!(error instanceof AgendaError)) throw error;
        return reply(id, { content: [{ type: "text", text: error.message }], isError: true });
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

module.exports = async (req, res) => {
  const denied = checkAccess(req);
  if (denied) {
    res.status(denied.status).json(rpcError(null, -32001, denied.error));
    return;
  }

  // Sin estado: no abrimos un stream SSE por GET ni manejamos sesiones.
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json(rpcError(null, -32000, "Method not allowed"));
    return;
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json(rpcError(null, -32700, "Parse error"));
    return;
  }

  const isBatch = Array.isArray(body);
  try {
    const replies = (await Promise.all((isBatch ? body : [body]).map(handleMessage))).filter(Boolean);
    if (replies.length === 0) {
      res.status(202).end();
      return;
    }
    res.status(200).json(isBatch ? replies : replies[0]);
  } catch (error) {
    console.error("MCP error:", error);
    res.status(500).json(rpcError(isBatch ? null : body.id, -32603, "Error interno de la agenda."));
  }
};
