#!/usr/bin/env node
// Lo que el CEO y los departamentos quieren hacer y necesita tu permiso.
//
//   npm run empresa:aprobaciones                         (lista las pendientes)
//   npm run empresa:aprobaciones -- --todas              (lista todas)
//   npm run empresa:aprobaciones -- --ver A001           (detalle completo)
//   npm run empresa:aprobaciones -- --aprobar A001
//   npm run empresa:aprobaciones -- --rechazar A001 --nota "muy largo"
//
// Aprobar un email o una publicación no lo envía: lo marca como aprobado para
// que lo envíes tú. Una búsqueda de prospectos aprobada la corre el CEO en su
// próxima vuelta.

const { parseArgs } = require("../prospector/lib/util");
const estado = require("./lib/estado");

function linea(a) {
  return `${a.id}  [${a.estado}]  ${a.tipo.padEnd(17)} ${a.departamento.padEnd(10)} ${a.resumen}`;
}

function cambiarEstado(id, nuevo, nota) {
  const lista = estado.aprobaciones();
  const a = lista.find((x) => x.id === id);
  if (!a) {
    console.error(`No existe la aprobación ${id}.`);
    process.exit(1);
  }
  if (a.estado !== "pendiente") {
    console.error(`${id} ya está "${a.estado}".`);
    process.exit(1);
  }
  a.estado = nuevo;
  a.decidida = new Date().toISOString();
  if (nota) a.nota = nota;
  estado.guardarAprobaciones(lista);
  console.log(linea(a));
  if (nuevo === "aprobada" && ["enviar_email", "publicar_redes", "cobrar", "gasto"].includes(a.tipo)) {
    console.log("\nAprobada. Envíalo/hazlo tú: el sistema no lo hace solo.");
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.aprobar) return cambiarEstado(args.aprobar, "aprobada", args.nota);
  if (args.rechazar) return cambiarEstado(args.rechazar, "rechazada", args.nota);

  const lista = estado.aprobaciones();

  if (args.ver) {
    const a = lista.find((x) => x.id === args.ver);
    if (!a) {
      console.error(`No existe la aprobación ${args.ver}.`);
      process.exit(1);
    }
    console.log(`${linea(a)}\nPedida: ${a.fecha}${a.nota ? `\nNota: ${a.nota}` : ""}`);
    if (Object.values(a.parametros || {}).some(Boolean)) console.log(`Parámetros: ${JSON.stringify(a.parametros)}`);
    console.log(`\n${a.detalle || "(sin detalle)"}`);
    return;
  }

  const visibles = args.todas ? lista : lista.filter((a) => a.estado === "pendiente");
  if (visibles.length === 0) {
    console.log(args.todas ? "No hay aprobaciones todavía." : "No hay aprobaciones pendientes.");
    return;
  }
  visibles.forEach((a) => console.log(linea(a)));
  console.log("\nVer detalle: npm run empresa:aprobaciones -- --ver <ID>");
}

main();
