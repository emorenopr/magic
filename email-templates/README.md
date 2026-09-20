# Plantillas de email marketing — Pet Stop N Go

`pet-stop-n-go-newsletter.html` es una plantilla de email de muestra (branding y
contenido ficticios) construida con markup "email-safe": tablas, estilos en
línea, comentarios condicionales para Outlook (MSO) y un bloque `<style>` con
media query para que las columnas de productos se apilen en móvil.

## Importar en Mailchimp

1. En Mailchimp: **Content > Email Templates > Create Template > Code your own > Paste in code** (o Import HTML/Import zip si empaquetas imágenes).
2. Pega el contenido completo de `pet-stop-n-go-newsletter.html`.
3. El logo, la foto del hero, las fotos de producto y los íconos sociales son
   placeholders SVG embebidos (`data:image/svg+xml;base64,...`) solo para que
   la plantilla se vea completa sin depender de un servicio externo. Súbelos
   como imágenes reales en **Content Studio** y reemplaza cada `src="data:..."`
   por la URL que te da Mailchimp (clic derecho en la imagen subida > Copy URL).
4. Los tags `*|LIST:ADDRESSLINE|*`, `*|UPDATE_PROFILE|*` y `*|UNSUB|*` son merge
   tags nativos de Mailchimp — se autocompletan al enviar la campaña, no hay
   que tocarlos.
5. Guarda como plantilla y úsala para crear una campaña (**Campaigns > Create > Regular email**), o mándate un test a ti mismo (**Preview and Test > Send a test email**) antes de programarla.

## Exportar desde Mailchimp

- Desde el editor de plantilla o campaña: **Edit code / Preview > Export as HTML** te da un `.html` que puedes versionar aquí o reutilizar en otro ESP.
- Mailchimp también permite exportar la campaña completa como PDF (para aprobación interna) desde el reporte de la campaña.

## Notas de diseño

- Colores de marca usados: verde azulado `#0f6e6c` (principal) y naranja
  `#f4832a` (acento/CTA) — ficticios, ajústalos a la guía real de Pet Stop N Go.
- Ancho fijo de 600px (estándar de email), con `max-width: 100%` para pantallas
  pequeñas.
- Todo el contenido (copy, precios, testimonio, horario) es de relleno —
  reemplázalo antes de enviar a una lista real.
