# Imagenes del Hero compartido

Este hero se usa en:
- index.html
- pages/hogar.html
- pages/comercio.html
- pages/planes/plan-basic.html
- pages/planes/plan-comercial.html
- pages/planes/plan-plus.html
- pages/planes/plan-pro.html
- pages/planes/plan-video.html

## Donde reemplazar imagenes

Reemplaza directamente estos archivos (manteniendo el mismo nombre):

- components/hero/hero-index.jpg -> Home (index)
- components/hero/hero-hogar.jpg -> Pagina Hogar
- components/hero/hero-comercio.jpg -> Pagina Comercio
- components/hero/hero-plan-basic.jpg -> Plan Basic
- components/hero/hero-plan-comercial.jpg -> Plan Comercial
- components/hero/hero-plan-plus.jpg -> Plan Plus
- components/hero/hero-plan-pro.jpg -> Plan Pro
- components/hero/hero-plan-video.jpg -> Plan Video

## Recomendaciones para no romper nada

- Mantener extension .jpg en estos nombres.
- No cambiar nombres de archivo ni rutas.
- Usar imagenes horizontales (ideal 1920x1080 o mayor, relacion 16:9).
- Optimizar peso antes de subir (ideal < 500 KB por imagen).

## Como funciona tecnicamente

La asignacion por pagina esta en:
- assets/js/global.js (funcion cargarHero)

Si en algun momento una imagen no existe, el sistema hace fallback automatico a:
- components/hero/hero-index.jpg
