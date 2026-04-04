# Chat IA Comercial - Estructura Base

Esta carpeta contiene solo la fase 1 (definicion de archivos) para implementar chat IA comercial de forma ordenada.

## Estructura

- `prompts/sistema.md`: instrucciones de comportamiento del bot (objetivo comercial y limites).
- `knowledge/`: plantillas y guia para base de conocimiento privada en Google Drive.
- `config/chat-config.template.json`: configuracion de umbrales, alertas y fallback.
- `events/eventos-comerciales.template.json`: plantilla de eventos comerciales estandar.

## Principio de seguridad

La base de conocimiento y claves de API no deben estar publicas en el frontend.
Solo el backend (Apps Script de chat) debe leer archivos privados de Drive y responder al cliente.

## Proximo paso sugerido

Implementar el endpoint en Apps Script nuevo usando estos archivos como contrato funcional.
