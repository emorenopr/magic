# Prospector — encuentra negocios con web vieja (o sin web) y prepárales una propuesta

Flujo en 3 pasos, casi todo automático:

```
1. buscar   → Google Maps: negocios de un tipo en un pueblo (con o sin web)
2. auditar  → revisa cada web: © viejo, no sirve en celular, sin https, caída...
3. generar  → una landing de propuesta + email personalizado por negocio
```

## 1. Consigue la lista de prospectos

**Opción A — automático (Google Maps):**

```bash
GOOGLE_PLACES_API_KEY=xxx npm run prospectar:buscar -- --q "pediatras en Bayamón" --categoria medico
GOOGLE_PLACES_API_KEY=xxx npm run prospectar:buscar -- --q "dentistas en Caguas" --categoria dentista --solo-sin-web
```

Añade los resultados a `prospector/leads.csv` (sin duplicar). Los que salen con `web` vacía son los "sin web".
Google no da emails: complétalos a mano (Facebook, Instagram, directorios de colegios profesionales).

**Opción B — a mano:** copia `leads.example.csv` a `leads.csv` y llénalo. Columnas:

| columna | para qué |
|---|---|
| `nombre_corto` | opcional: cómo llamarle en el email ("Dra. Ortiz"); si está vacío se usa `nombre` |
| `nombre`, `categoria` | categoría: `medico`, `dentista`, `abogado`, `restaurante`, `belleza`, `taller` (o cualquier texto; se adivina) |
| `web` | vacío = no tiene web |
| `email`, `telefono`, `whatsapp` | si la web los tiene, se sacan solos |
| `direccion`, `ciudad`, `horario` | horario separado por `;` |
| `servicios`, `eslogan` | lo que **tú** quieras añadir; `servicios` separados por `;` |
| `notas` | contexto para la IA (ej. "atiende en inglés también") |

## 2. Audita

```bash
npm run prospectar:auditar
```

Puntuación de oportunidad (0-100): sin web = 100, web caída = 90, y para webs que abren suma puntos por
copyright viejo (© 2016 → +40), sin versión móvil (+25), sin https (+15), Flash, tablas/`<font>`,
jQuery/WordPress viejos, sin meta description, carga lenta, `Last-Modified` antiguo.
Si el año del © se pone con JavaScript (siempre dice el año actual) no se cuenta.

## 3. Genera las propuestas

```bash
npm run prospectar:generar                 # textos por plantilla (gratis, instantáneo)
npm run prospectar:generar -- --ia         # textos a la medida con Claude (necesita ANTHROPIC_API_KEY)
npm run prospectar:generar -- --min 50     # solo los mejores prospectos (por defecto 30+)
```

Crea `propuestas/<negocio>/index.html` (landing lista, con botones de llamar/WhatsApp, mapa, horario,
servicios, © del año actual), `propuestas/<negocio>/email.txt` y el panel `propuestas/index.html`
ordenado por oportunidad, con botón para abrir el email ya escrito.

Con `--ia`, Claude lee lo que había en su web vieja + tus notas y escribe eslogan, "sobre nosotros",
servicios con descripción y una apertura personalizada del email. Tiene instrucciones de no inventar
datos (años, premios, precios, planes médicos). Se guarda en caché: re-generar no vuelve a cobrar
(usa `--refrescar` para pedir textos nuevos).

## Publicar y enviar

1. Edita `prospector/config.json` con tu nombre, teléfono, email y `baseUrl` (dónde se publican las propuestas).
2. Sube la carpeta `propuestas/` (GitHub Pages o Vercel ya sirven este repo) y abre el panel.
3. Revisa cada propuesta **antes** de enviar el email. Las páginas llevan `noindex` para no salir en Google.

Buenas prácticas del email frío: un email por negocio, personalizado, con tu nombre y teléfono reales
y la opción de decir "no" (ya viene en la plantilla). No compres listas ni envíes en masa desde tu Gmail.

## Solicitudes que llegan (cotización + maqueta)

Cuando un cliente **te pide** una web ("necesito una cotización para..."), en vez de mandar solo precios,
mándale una maqueta de cómo se vería + la cotización:

1. Copia `prospector/solicitudes/fundacion-multinational.json` (ejemplo) a `solicitudes/<cliente>.json`.
2. Llena `solicitud` (lo que pidieron), `fases` con sus `items` y precios, `recurrentes`, `necesitamos`,
   `condiciones` y `preguntas`. Si incluyes `maqueta` (lema, misión, quiénes somos, noticias, montos de
   donación, colores) se genera también la maqueta del sitio. `notas_internas` solo sale en el borrador.
3. Genera:

```bash
npm run prospectar:cotizar                         # todas, como BORRADOR (franja amarilla + notas internas)
npm run prospectar:cotizar -- --solo <cliente>     # solo una
npm run prospectar:cotizar -- --final              # versión para enviar (sin franja ni notas)
```

Sale en `propuestas/cotizaciones/<cliente>/`: la maqueta (`index.html`, con botones para ver la
landing de la fase 1 y el sitio completo), la cotización (`cotizacion/`, con botón para guardar PDF)
y `respuesta.txt` con el email ya escrito. La maqueta usa textos de ejemplo: no pongas datos que el
cliente no te haya dado.
