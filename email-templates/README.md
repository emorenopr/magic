# Plantillas de email marketing — Pet Stop n' Go

`pet-stop-n-go-newsletter.html` es una plantilla de email construida con markup
"email-safe" (tablas, estilos en línea, comentarios condicionales para Outlook,
media query para apilar columnas en móvil) usando el **branding real** de
Pet Stop n' Go tomado de `Manual_Logo_Pet_Stop_2025.pdf`:

- **Colores**: naranja `#f7941d`, negro `#000000`, azul `#14b1e7`, durazno
  `#fdc689`, marrón `#764e29`.
- **Tipografía**: Poppins (weights 400–900). Se carga por `@import` de Google
  Fonts con fallback a Arial/Helvetica — varios clientes de correo (Outlook,
  la app de Gmail) ignoran `@import` y usan el fallback; es esperado.
- **Logo, isotipo y mascota "Max"**: recortados del manual de marca y guardados
  en `images/` (`pet-stop-n-go-logo.png`, `pet-stop-n-go-isotipo.png`,
  `pet-stop-n-go-max-mascota.png`), con fondo transparente.
- **Datos reales de contacto** tomados del packaging del manual:
  📞 787-213-2450 · petstopngo.com · @petstopngo (San Juan, PR).

El contenido (promo "Colección Boricua", precios, testimonio, horario) es
**relleno/dummy** — reemplázalo antes de enviar a una lista real. Las fotos de
producto siguen siendo placeholders SVG (no estaban en el manual de marca).

## Importar en Mailchimp

1. En Mailchimp: **Content > Email Templates > Create Template > Code your own > Import HTML** (o **Import zip** si subes la carpeta `images/` junto con el HTML).
2. Si usas "Paste in code" en vez de importar el zip: pega el HTML y luego sube
   los 3 archivos de `images/` a **Content Studio**, y reemplaza cada
   `src="images/..."` por la URL que te da Mailchimp (clic derecho en la
   imagen subida > Copy URL).
3. Los tags `*|LIST:ADDRESSLINE|*`, `*|UPDATE_PROFILE|*` y `*|UNSUB|*` son merge
   tags nativos de Mailchimp — se autocompletan al enviar la campaña, no hay
   que tocarlos.
4. Guarda como plantilla y úsala para crear una campaña (**Campaigns > Create > Regular email**), o mándate un test a ti mismo (**Preview and Test > Send a test email**) antes de programarla.

## Exportar desde Mailchimp

- Desde el editor de plantilla o campaña: **Edit code / Preview > Export as HTML** te da un `.html` que puedes versionar aquí o reutilizar en otro ESP.
- Mailchimp también permite exportar la campaña completa como PDF (para aprobación interna) desde el reporte de la campaña.

## Archivos

```
email-templates/
├── pet-stop-n-go-newsletter.html   # la plantilla
├── images/
│   ├── pet-stop-n-go-logo.png      # logo horizontal a color (fondo transparente)
│   ├── pet-stop-n-go-isotipo.png   # cabeza del perrito sola (fondo transparente)
│   └── pet-stop-n-go-max-mascota.png # "Max", mascota repartidor (fondo transparente)
└── README.md
```

## Notas de diseño

- Ancho fijo de 600px (estándar de email), con `max-width: 100%` para pantallas
  pequeñas.
- Las imágenes de marca vienen del PDF a 300dpi, recortadas y con el fondo
  original convertido a transparencia — si necesitas mayor resolución o el
  archivo vectorial original, pídeselo al diseñador que hizo el manual.
