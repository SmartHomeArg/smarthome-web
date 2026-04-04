/*
  =====================================================================
  SmartHome - Catalogo central de precios para la tienda
  =====================================================================

  QUE CONTROLA ESTE ARCHIVO
  - Precio de instalacion de cada kit
  - Precio base del plan mensual
  - Porcentaje de descuento del plan
  - Cantidad de meses de la promocion

  DONDE IMPACTAN ESTOS VALORES
  - pages/tienda.html
  - pages/tienda/*.html
  - schema / datos estructurados SEO de los kits

  IDEA PRINCIPAL
  - Cuando cambies un precio, hacelo SOLO aqui.
  - No hace falta editar global.js ni las paginas HTML de tienda.
  - global.js toma estos valores y calcula automaticamente:
    - el formato con "$"
    - el precio final del plan con descuento
    - el texto de la promocion

  IMPORTANTE
  - Este archivo es publico, como cualquier asset frontend del sitio.
  - No guardar aqui claves, tokens, credenciales ni informacion sensible.
  - Editar solo los numeros de cada kit.

  SIGNIFICADO DE CADA CAMPO
  - installationPrice:
      Precio principal del kit / instalacion.

  - planListPrice:
      Precio base del plan mensual ANTES del descuento.

  - planDiscountPercent:
      Porcentaje de descuento aplicado al plan.
      Ejemplo: 30 = 30%

  - planDiscountMonths:
      Cantidad de meses que se comunica la promocion.
      Ejemplo: 6 = "30% de descuento por 6 meses"

  GUIA RAPIDA DE EDICION
  1. Busca el kit por su nombre interno.
  2. Cambia los numeros que necesites.
  3. Guarda el archivo.
  4. Recarga la pagina y verifica el resultado.
*/

(function attachRuntimeCatalogConfig(globalScope) {
  function deepFreeze(value) {
    if (!value || typeof value !== "object") return value;

    Object.getOwnPropertyNames(value).forEach((key) => {
      const nestedValue = value[key];
      if (nestedValue && typeof nestedValue === "object") {
        deepFreeze(nestedValue);
      }
    });

    return Object.freeze(value);
  }

  const runtimeCatalogConfig = deepFreeze({
    pricing: {
      // Texto general de pago mostrado en los kits de tienda.
      defaultInstallmentsLabel: "Paga con tarjeta de credito o debito",

      kits: {
        // ================================================================
        // KIT CAM PLUS
        // ================================================================
        "kit-cam-plus": {
          // Precio principal del kit.
          installationPrice: 49900,

          // Precio del plan mensual antes del descuento.
          planListPrice: 46900,

          // Descuento aplicado al plan.
          planDiscountPercent: 30,

          // Meses durante los que se comunica la promocion.
          planDiscountMonths: 6
        },

        // ================================================================
        // KIT SMART 1.1
        // ================================================================
        "kit-smart-1-1": {
          installationPrice: 59900,
          planListPrice: 58900,
          planDiscountPercent: 30,
          planDiscountMonths: 6
        },

        // ================================================================
        // KIT SMART 2.2
        // ================================================================
        "kit-smart-2-2": {
          installationPrice: 79900,
          planListPrice: 62900,
          planDiscountPercent: 30,
          planDiscountMonths: 6
        },

        // ================================================================
        // KIT SMART CAM 2.2
        // ================================================================
        "kit-smart-cam-2-2": {
          installationPrice: 89900,
          planListPrice: 69990,
          planDiscountPercent: 30,
          planDiscountMonths: 6
        },

        // ================================================================
        // KIT INDUSTRIAL
        // ================================================================
        "kit-industrial": {
          installationPrice: 149000,
          planListPrice: 89900,
          planDiscountPercent: 30,
          planDiscountMonths: 6
        }
      }
    }
  });

  Object.defineProperty(globalScope, "SM_RUNTIME_CATALOG", {
    value: runtimeCatalogConfig,
    writable: false,
    configurable: false,
    enumerable: false
  });
})(window);
