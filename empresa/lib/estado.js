// Datos de la empresa: organigrama, tareas, aprobaciones, entregables e
// informes. Todo vive en archivos JSON/Markdown dentro de empresa/data/
// (no se sube al repo: tiene datos de clientes).

const fs = require("fs");
const path = require("path");
const { readJson, writeJson, parseCsv, slugify } = require("../../prospector/lib/util");

const EMPRESA_DIR = path.resolve(__dirname, "..");
const REPO_DIR = path.resolve(EMPRESA_DIR, "..");
const DATA_DIR = path.join(EMPRESA_DIR, "data");
const PROSPECTOR_DIR = path.join(REPO_DIR, "prospector");
const PROPUESTAS_DIR = path.join(REPO_DIR, "propuestas");

const TAREAS_FILE = path.join(DATA_DIR, "tareas.json");
const APROBACIONES_FILE = path.join(DATA_DIR, "aprobaciones.json");

const hoy = () => new Date().toISOString().slice(0, 10);

function organigrama() {
  return readJson(path.join(EMPRESA_DIR, "organigrama.json"), null);
}

function departamento(id) {
  return organigrama().departamentos.find((d) => d.id === id) || null;
}

function tareas() {
  return readJson(TAREAS_FILE, []);
}

function guardarTarea(tarea) {
  const lista = tareas();
  const nueva = { id: `T${String(lista.length + 1).padStart(3, "0")}`, fecha: new Date().toISOString(), ...tarea };
  lista.push(nueva);
  writeJson(TAREAS_FILE, lista);
  return nueva;
}

function aprobaciones() {
  return readJson(APROBACIONES_FILE, []);
}

function guardarAprobaciones(lista) {
  writeJson(APROBACIONES_FILE, lista);
}

function pedirAprobacion({ departamento: dep, tipo, resumen, detalle, parametros }) {
  const lista = aprobaciones();
  const nueva = {
    id: `A${String(lista.length + 1).padStart(3, "0")}`,
    fecha: new Date().toISOString(),
    estado: "pendiente",
    departamento: dep,
    tipo,
    resumen,
    detalle: detalle || "",
    parametros: parametros || {},
  };
  lista.push(nueva);
  guardarAprobaciones(lista);
  return nueva;
}

function guardarEntregable(dep, titulo, contenido) {
  const file = path.join(DATA_DIR, "entregables", `${hoy()}-${dep}-${slugify(titulo)}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `# ${titulo}\n\n_${departamento(dep)?.jefe || dep} · ${hoy()}_\n\n${contenido}\n`);
  return path.relative(REPO_DIR, file);
}

function guardarInforme(contenido) {
  const file = path.join(DATA_DIR, "informes", `${hoy()}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const previo = fs.existsSync(file) ? `${fs.readFileSync(file, "utf8")}\n---\n\n` : "";
  fs.writeFileSync(file, `${previo}${contenido}\n`);
  return path.relative(REPO_DIR, file);
}

function listarDirs(dir, excluir = []) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !excluir.includes(d.name))
      .map((d) => d.name);
  } catch {
    return [];
  }
}

// Foto del estado de la empresa, compacta para pasársela a los agentes.
function resumen() {
  const leadsCsv = path.join(PROSPECTOR_DIR, "leads.csv");
  const leadsSinAuditar = fs.existsSync(leadsCsv)
    ? parseCsv(fs.readFileSync(leadsCsv, "utf8")).filter((l) => l.nombre).length
    : 0;

  const auditados = readJson(path.join(PROSPECTOR_DIR, "data", "leads.json"), { leads: [] });
  const prospectos = auditados.leads.map((l) => ({
    nombre: l.nombre,
    categoria: l.categoria,
    ciudad: l.ciudad,
    web: l.web || "(sin web)",
    email: l.email || "",
    puntos: l.audit?.score,
    razones: l.audit?.reasons,
  }));

  const solicitudes = fs
    .readdirSync(path.join(PROSPECTOR_DIR, "solicitudes"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const s = readJson(path.join(PROSPECTOR_DIR, "solicitudes", f), {});
      const total = (s.fases || []).flatMap((fase) => fase.items || []).reduce((sum, it) => sum + Number(it.precio || 0), 0);
      const pct = Number(s.descuento?.porcentaje || 0);
      return {
        slug: f.replace(/\.json$/, ""),
        cliente: s.cliente,
        fecha: s.fecha,
        solicitud: s.solicitud,
        total_cotizado: Math.round(total * (100 - pct)) / 100,
        cotizacion_generada: fs.existsSync(path.join(PROPUESTAS_DIR, "cotizaciones", f.replace(/\.json$/, ""))),
      };
    });

  return {
    fecha: hoy(),
    leads_en_csv: leadsSinAuditar,
    prospectos_auditados: prospectos,
    propuestas_generadas: listarDirs(PROPUESTAS_DIR, ["cotizaciones"]),
    solicitudes_y_cotizaciones: solicitudes,
    aprobaciones: aprobaciones().slice(-20),
    tareas_recientes: tareas()
      .slice(-15)
      .map(({ id, fecha, departamento: dep, tarea, entregable }) => ({ id, fecha, departamento: dep, tarea, entregable })),
  };
}

module.exports = {
  EMPRESA_DIR,
  REPO_DIR,
  DATA_DIR,
  organigrama,
  departamento,
  tareas,
  guardarTarea,
  aprobaciones,
  guardarAprobaciones,
  pedirAprobacion,
  guardarEntregable,
  guardarInforme,
  resumen,
};
