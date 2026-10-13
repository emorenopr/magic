# Moreno LLC — la empresa con CEO de IA

Un CEO (Claude) recibe tus metas, revisa cómo va la empresa, le reparte trabajo a los
departamentos (cada jefe es otro agente de IA) y te deja un informe. **Nada sale de la
empresa sin tu aprobación**: emails, publicaciones, cobros, gastos y búsquedas pagadas
quedan en una lista para que digas sí o no.

```
                 👤 Tú — Dueño / Managing Member (apruebas)
                                  │
                         🤖 CEO (IA) — empresa/ceo.js
      ┌────────────┬─────────────┼─────────────┬────────────┐
   📈 Ventas    💰 Finanzas   🛠️ Producción   💬 Soporte   📣 Mercadeo
   prospector   cotizaciones  plan de webs   respuestas   posts y
   y emails     y precios     y tiempos      a clientes   campañas
```

## Configurar

1. `npm install` y pon tu `ANTHROPIC_API_KEY` en el entorno (o en `.env`).
2. Edita `empresa/organigrama.json`: tu nombre en `dueno.nombre`, la misión, y si quieres,
   las responsabilidades de cada departamento. El CEO y los jefes leen este archivo cada vez.

## Usar

```bash
npm run empresa:ceo                                          # informe del día
npm run empresa:ceo -- --meta "Consigue 5 clientes nuevos en Bayamón"
npm run empresa:ceo -- --meta "Prepara la semana de posts para Instagram"
```

El CEO:

1. Mira el estado: prospectos (`prospector/`), propuestas, solicitudes y cotizaciones,
   tareas y aprobaciones anteriores.
2. Le asigna tareas a los departamentos. Cada jefe entrega el trabajo hecho (borradores de
   emails, posts, resúmenes de cotizaciones...) en `empresa/data/entregables/`.
3. Puede correr las herramientas internas del prospector: auditar webs, generar propuestas
   y regenerar cotizaciones (como borrador).
4. Pide aprobación para lo que sale afuera o cuesta dinero.
5. Deja el informe en `empresa/data/informes/<fecha>.md`: qué se hizo, entregables,
   aprobaciones pendientes y próximos pasos.

## Aprobar

```bash
npm run empresa:aprobaciones                       # pendientes
npm run empresa:aprobaciones -- --ver A001         # el texto exacto
npm run empresa:aprobaciones -- --aprobar A001
npm run empresa:aprobaciones -- --rechazar A001 --nota "muy formal, hazlo más cercano"
```

- **Emails, posts, cobros y gastos:** aprobarlos los marca como aprobados, pero **los envías
  tú**. El sistema no tiene acceso a tu email ni a tus redes.
- **Buscar prospectos en Google Maps:** cuesta dinero (API de Google, necesita
  `GOOGLE_PLACES_API_KEY`). Una vez aprobada, el CEO la corre en su próxima vuelta.
- Las rechazadas (con tu nota) las ve el CEO la próxima vez y ajusta.

## Datos

Todo queda en `empresa/data/` (tareas, aprobaciones, entregables, informes). No se sube al
repo porque tiene datos de clientes, igual que `prospector/data/`.

## Costo

Cada vuelta del CEO usa Claude Opus 5.5: el CEO piensa a esfuerzo alto, los departamentos a
esfuerzo medio, y la vuelta tiene un máximo de 25 turnos. Calcula alrededor de $1–2 por meta
con 2-3 entregables (es un estimado, no está medido): revisa el uso real en
console.anthropic.com las primeras veces.
