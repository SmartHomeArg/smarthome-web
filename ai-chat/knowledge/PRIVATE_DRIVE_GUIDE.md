# Guia - Base de conocimiento privada en Google Drive

## Objetivo

Guardar la base de conocimiento fuera del frontend publico, para que el cliente no pueda leerla por URL.

## Archivo recomendado en Drive

- Nombre sugerido: `smarthome_conocimiento_privado_v1.md`
- Ubicacion sugerida: carpeta privada de Drive del propietario del Apps Script
- Permisos: solo propietario (y colaboradores internos necesarios)
- Nunca publicar ni compartir como enlace publico

## Pasos

1. Crear carpeta privada en Drive: `Smarthome IA Privado`.
2. Crear dentro el archivo `smarthome_conocimiento_privado_v1.md`.
3. Copiar el contenido de `conocimiento-empresa.template.md` y completarlo.
4. Obtener el `FILE_ID` del archivo (desde la URL de Drive).
5. Guardar `KNOWLEDGE_FILE_ID` en Script Properties del Apps Script del chat.

## Recomendaciones de seguridad

1. No guardar API keys en HTML/JS del sitio.
2. No devolver el archivo completo al cliente, solo fragmentos resumidos.
3. Rotar el archivo por versionado (`v1`, `v2`) para cambios controlados.
4. Registrar cambios importantes en un log interno.
