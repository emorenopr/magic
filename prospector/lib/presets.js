// Contenido y colores por defecto segun el tipo de negocio. Si el CSV trae
// "servicios" o "eslogan", eso tiene prioridad sobre lo de aqui.

const PRESETS = {
  dentista: {
    match: /dent|odont|ortodon|sonrisa/i,
    label: "Oficina dental",
    icon: "🦷",
    colors: { bg: "#f3faf9", surface: "#ffffff", ink: "#0f2d2b", muted: "#557370", accent: "#0f8f83", accentInk: "#ffffff", soft: "#dcf2ef" },
    tagline: (l) => `Tu sonrisa en buenas manos${l.ciudad ? ` en ${l.ciudad}` : ""}.`,
    about: (l) => `En ${l.nombre} cuidamos tu salud oral con tecnología moderna y un equipo que te hace sentir cómodo desde que llegas.`,
    services: ["Limpiezas y evaluaciones", "Empastes y coronas", "Blanqueamiento", "Emergencias dentales"],
    cta: "Separa tu cita",
  },
  medico: {
    match: /m[eé]dic|doctor|dr\.?\s|pediatr|cl[ií]nica|internista|cardi|ginec|dermat|salud|family|oftalm|ortoped/i,
    label: "Consultorio médico",
    icon: "🩺",
    colors: { bg: "#f5f8fb", surface: "#ffffff", ink: "#12263a", muted: "#5b6b7c", accent: "#1f6fb2", accentInk: "#ffffff", soft: "#e3eef8" },
    tagline: (l) => `Atención médica cercana y de confianza${l.ciudad ? ` en ${l.ciudad}` : ""}.`,
    about: (l) => `En ${l.nombre} te atendemos con tiempo, sin prisa y con un trato humano. Nuestro compromiso es que salgas de la cita entendiendo tu salud y con un plan claro.`,
    services: ["Consultas generales", "Exámenes y seguimiento", "Referidos a especialistas", "Aceptamos planes médicos"],
    cta: "Separa tu cita",
  },
  abogado: {
    match: /abogad|bufete|legal|notari|law/i,
    label: "Servicios legales",
    icon: "⚖️",
    colors: { bg: "#f7f5f0", surface: "#ffffff", ink: "#1d1b16", muted: "#6b6558", accent: "#7a5c1e", accentInk: "#ffffff", soft: "#efe7d6" },
    tagline: (l) => `Asesoría legal clara y directa${l.ciudad ? ` en ${l.ciudad}` : ""}.`,
    about: (l) => `En ${l.nombre} te explicamos tus opciones en palabras sencillas y te acompañamos en cada paso del proceso.`,
    services: ["Consulta inicial", "Contratos y documentos", "Notaría", "Representación legal"],
    cta: "Agenda una consulta",
  },
  restaurante: {
    match: /restaur|caf[eé]|panader|reposter|comida|food|pizza|bar\b|grill|cocina/i,
    label: "Restaurante",
    icon: "🍽️",
    colors: { bg: "#1f1a17", surface: "#2a2320", ink: "#f6eee6", muted: "#c3b3a4", accent: "#e0762c", accentInk: "#1f1208", soft: "#3a2e27" },
    tagline: (l) => `Comida hecha con cariño${l.ciudad ? ` en ${l.ciudad}` : ""}.`,
    about: (l) => `${l.nombre} es ese lugar al que vuelves: buena comida, buen ambiente y un servicio que te trata como familia.`,
    services: ["Comer aquí", "Para llevar", "Catering y actividades", "Pedidos por teléfono"],
    cta: "Haz tu pedido",
  },
  belleza: {
    match: /sal[oó]n|belleza|barber|u[ñn]as|spa|est[eé]tic|peluquer/i,
    label: "Salón de belleza",
    icon: "💇",
    colors: { bg: "#fbf6f6", surface: "#ffffff", ink: "#2d1a22", muted: "#7d6470", accent: "#b23a6b", accentInk: "#ffffff", soft: "#f5e1ea" },
    tagline: (l) => `Te ves bien, te sientes mejor${l.ciudad ? ` — ${l.ciudad}` : ""}.`,
    about: (l) => `En ${l.nombre} nos tomamos el tiempo de escucharte para que salgas exactamente como querías.`,
    services: ["Cortes y peinados", "Color y mechones", "Manicura y pedicura", "Tratamientos"],
    cta: "Reserva tu turno",
  },
  taller: {
    match: /taller|mec[aá]nic|auto|gomer|hojalater|garage/i,
    label: "Taller",
    icon: "🔧",
    colors: { bg: "#f4f5f7", surface: "#ffffff", ink: "#15191f", muted: "#5c6470", accent: "#d14b12", accentInk: "#ffffff", soft: "#fbe4d9" },
    tagline: (l) => `Mecánica honesta y a tiempo${l.ciudad ? ` en ${l.ciudad}` : ""}.`,
    about: (l) => `En ${l.nombre} te decimos qué tiene tu carro antes de tocarlo, con precios claros y trabajo garantizado.`,
    services: ["Diagnóstico", "Cambio de aceite y frenos", "Mantenimiento preventivo", "Aire acondicionado"],
    cta: "Pide un estimado",
  },
  generico: {
    match: /.*/,
    label: "Negocio local",
    icon: "⭐",
    colors: { bg: "#f6f7f9", surface: "#ffffff", ink: "#161a22", muted: "#5d6573", accent: "#3b5bdb", accentInk: "#ffffff", soft: "#e2e8fb" },
    tagline: (l) => `Servicio de confianza${l.ciudad ? ` en ${l.ciudad}` : ""}.`,
    about: (l) => `En ${l.nombre} nos importa cada cliente. Escríbenos o llámanos y te atendemos con gusto.`,
    services: ["Servicio personalizado", "Atención rápida", "Precios justos", "Clientes satisfechos"],
    cta: "Contáctanos",
  },
};

function pickPreset(categoria = "", nombre = "") {
  const key = categoria.trim().toLowerCase();
  if (PRESETS[key]) return { key, ...PRESETS[key] };
  const haystack = `${categoria} ${nombre}`;
  for (const [k, preset] of Object.entries(PRESETS)) {
    if (k !== "generico" && preset.match.test(haystack)) return { key: k, ...preset };
  }
  return { key: "generico", ...PRESETS.generico };
}

module.exports = { PRESETS, pickPreset };
