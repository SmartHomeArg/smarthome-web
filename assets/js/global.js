/**
 * =========================================================
 * SmartHome Web - Global JavaScript
 * Archivo: assets/js/global.js
 *
 * Este archivo contiene toda la lógica JavaScript global
 * del sitio institucional SmartHome.
 *
 * Principios:
 * - Código simple
 * - Código claro
 * - Código mantenible
 * - Sin dependencias innecesarias
 *
 * Toda la lógica está encapsulada para evitar contaminar
 * el scope global del navegador.
 * =========================================================
 */

(function () {

  "use strict";


  /* =========================================================
     CONFIGURACIÓN DEL SITIO
     ========================================================= */

  const SITE_CONFIG = {

    siteName: "SmartHome",

    breakpoints: {
      mobile: 576,
      tablet: 768,
      desktop: 992,
      large: 1200
    }

  };



  /* =========================================================
     UTILIDADES GENERALES
     ========================================================= */

  /**
   * Selecciona un elemento del DOM
   */
  function $(selector) {
    return document.querySelector(selector);
  }

  /**
   * Selecciona múltiples elementos
   */
  function $$(selector) {
    return document.querySelectorAll(selector);
  }

  /**
   * Verifica si un elemento existe
   */
  function elementExists(selector) {
    return document.querySelector(selector) !== null;
  }

  /**
   * Fuerza la decodificacion UTF-8 de respuestas de texto para evitar
   * mojibake cuando el servidor no envia correctamente el charset.
   */



  /* =========================================================
     INICIALIZACIÓN DEL SITIO
     ========================================================= */

  document.addEventListener("DOMContentLoaded", initSite);


  /**
   * Función principal de inicialización
   */

  function initSite() {

    console.log("SmartHome website initialized");

    initNavigation();
    initScrollEffects();
    initAnimations();
    initLazyLoading();

  }




  /* =========================================================
     ANIMACIONES
     ========================================================= */

  function initAnimations() {

    if (typeof AOS !== "undefined") {

      AOS.init({
        duration: 800,
        once: true,
        offset: 100
      });

    }

  }



  /* =========================================================
     LAZY LOADING DE IMÁGENES
     ========================================================= */

  function initLazyLoading() {

    const images = $$("img[data-src]");

    if (!images.length) return;

    const observer = new IntersectionObserver((entries, observer) => {

      entries.forEach(entry => {

        if (!entry.isIntersecting) return;

        const img = entry.target;

        img.src = img.dataset.src;

        observer.unobserve(img);

      });

    });

    images.forEach(img => observer.observe(img));

  }



  /* =========================================================
     UTILIDADES UI
     ========================================================= */

  /**
   * Scroll suave hacia un elemento
   */

  function scrollToElement(selector) {

    const element = $(selector);

    if (!element) return;

    element.scrollIntoView({
      behavior: "smooth"
    });

  }



  /* =========================================================
     MODO DEBUG
     ========================================================= */

  const DEBUG = false;

  if (DEBUG) {
    console.log("Debug mode enabled");
  }


})();

async function responseAsUtf8Text(response) {
  const buffer = await response.arrayBuffer();
  return new TextDecoder("utf-8").decode(buffer);
}

/* =========================================
   MARCAR MENU ACTIVO
========================================= */

function activarMenu() {

  const normalizePath = (path) => {
    if (!path) return "/";
    const clean = path.replace(/\/+$|\?.*|#.*/g, "") || "/";
    return clean.endsWith("/") && clean.length > 1 ? clean.slice(0, -1) : clean;
  };

  const currentPath = normalizePath(window.location.pathname);
  const menuLinks = document.querySelectorAll(".menu-principal a");
  const topLevelLinks = document.querySelectorAll(".menu-principal .nav-link");

  menuLinks.forEach(link => {
    link.classList.remove("active");
    link.removeAttribute("aria-current");
  });

  topLevelLinks.forEach(link => {

    const href = (link.getAttribute("href") || "").trim();

    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

    let targetPath = "";
    try {
      const url = new URL(link.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      targetPath = normalizePath(url.pathname);
    } catch (e) {
      return;
    }

    const isHomeCurrent = currentPath === "/" || currentPath.endsWith("/index.html");
    const isHomeTarget = targetPath === "/" || targetPath.endsWith("/index.html");

    if ((isHomeCurrent && isHomeTarget) || (!isHomeCurrent && currentPath === targetPath)) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }

  });

  // Si una página pertenece a un dropdown, marcar activo el texto padre
  const parentDropdowns = document.querySelectorAll(".menu-principal .como-dropdown");

  parentDropdowns.forEach(dropdown => {
    const parentLink = dropdown.querySelector(".como-link");
    if (!parentLink) return;

    const childLinks = dropdown.querySelectorAll(".como-menu .dropdown-item[href]");
    let hasChildMatch = false;

    childLinks.forEach(childLink => {
      let childPath = "";
      try {
        const childUrl = new URL(childLink.href, window.location.origin);
        if (childUrl.origin !== window.location.origin) return;
        childPath = normalizePath(childUrl.pathname);
      } catch (e) {
        return;
      }

      if (currentPath === childPath) {
        hasChildMatch = true;
        childLink.classList.add("active");
        childLink.setAttribute("aria-current", "page");
      }
    });

    if (hasChildMatch) {
      parentLink.classList.add("active");
      parentLink.setAttribute("aria-current", "page");
    }
  });

}

/* =========================================
   CARGA COMPONENTES GLOBALES (HEADER / FOOTER)
========================================= */

function getCurrentPageKey() {
  let path = (window.location.pathname || "/").replace(/\/+$/, "");

  if (!path || path === "/") {
    return "index.html";
  }

  const marker = "/smarthome-web/";
  const lowerPath = path.toLowerCase();
  const markerIndex = lowerPath.indexOf(marker);
  if (markerIndex >= 0) {
    path = path.slice(markerIndex + marker.length);
  }

  path = path.replace(/^\/+/, "");

  if (!path.endsWith(".html")) {
    path += ".html";
  }

  return path;
}

function createJsonLdScript(data) {
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute("data-smarthome-schema", "1");
  script.text = JSON.stringify(data);
  return script;
}

function buildBreadcrumbItems(baseUrl, pageKey, pageName) {
  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Inicio",
      item: `${baseUrl}/`
    }
  ];

  if (pageKey.startsWith("pages/planes/")) {
    items.push({ "@type": "ListItem", position: 2, name: "Planes", item: `${baseUrl}/pages/como-funciona.html` });
    items.push({ "@type": "ListItem", position: 3, name: pageName, item: `${baseUrl}/${pageKey}` });
  } else if (pageKey.startsWith("pages/tienda/")) {
    items.push({ "@type": "ListItem", position: 2, name: "Tienda", item: `${baseUrl}/pages/tienda.html` });
    items.push({ "@type": "ListItem", position: 3, name: pageName, item: `${baseUrl}/${pageKey}` });
  } else if (pageKey.startsWith("pages/soluciones-a-medida/")) {
    items.push({ "@type": "ListItem", position: 2, name: "Soluciones a Medida", item: `${baseUrl}/pages/comercio.html` });
    items.push({ "@type": "ListItem", position: 3, name: pageName, item: `${baseUrl}/${pageKey}` });
  } else if (pageKey !== "index.html") {
    items.push({ "@type": "ListItem", position: 2, name: pageName, item: `${baseUrl}/${pageKey}` });
  }

  return items;
}

let runtimeCatalogConfigPromise = null;

function ensureRuntimeCatalogConfig() {
  if (window.SM_RUNTIME_CATALOG?.pricing?.kits) {
    return Promise.resolve(window.SM_RUNTIME_CATALOG);
  }

  if (runtimeCatalogConfigPromise) {
    return runtimeCatalogConfigPromise;
  }

  runtimeCatalogConfigPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-smarthome-runtime-catalog="1"]');

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.SM_RUNTIME_CATALOG), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("No se pudo cargar runtime-catalog.js")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = getSiteAssetUrl("assets/js/runtime-catalog.js");
    script.defer = true;
    script.setAttribute("data-smarthome-runtime-catalog", "1");
    script.addEventListener("load", () => resolve(window.SM_RUNTIME_CATALOG), { once: true });
    script.addEventListener("error", () => reject(new Error("No se pudo cargar runtime-catalog.js")), { once: true });
    document.head.appendChild(script);
  });

  return runtimeCatalogConfigPromise;
}

function getRuntimeCatalogPricing() {
  return window.SM_RUNTIME_CATALOG?.pricing || null;
}

function formatArsInteger(value) {
  const safeNumber = Number(value || 0);
  return `$ ${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(safeNumber)}`;
}

function formatArsDecimal(value) {
  const safeNumber = Number(value || 0);
  return `$ ${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safeNumber)}`;
}

function getStorefrontKitPricing(kitId) {
  const pricingConfig = getRuntimeCatalogPricing();
  const kitConfig = pricingConfig?.kits?.[kitId];

  if (!kitConfig) {
    console.error(`No se encontro configuracion de precios para el kit "${kitId}".`);
    return {
      installationPriceNumber: 0,
      installationPriceFormatted: formatArsInteger(0),
      installmentsLabel: pricingConfig?.defaultInstallmentsLabel || "Paga con tarjeta de credito o debito",
      planListNumber: 0,
      planListFormatted: formatArsInteger(0),
      planDiscountPercent: 0,
      planDiscountMonths: 0,
      planFinalNumber: 0,
      planFinalFormatted: formatArsInteger(0),
      planPromoLabel: "Sin promocion vigente"
    };
  }

  const installationPriceNumber = Number(kitConfig.installationPrice || 0);
  const planListNumber = Number(kitConfig.planListPrice || 0);
  const planDiscountPercent = Number(kitConfig.planDiscountPercent || 0);
  const planDiscountMonths = Number(kitConfig.planDiscountMonths || 0);
  const planFinalNumber = Math.round(planListNumber * (1 - (planDiscountPercent / 100)));

  return {
    installationPriceNumber,
    installationPriceFormatted: formatArsInteger(installationPriceNumber),
    installmentsLabel: pricingConfig?.defaultInstallmentsLabel || "Paga con tarjeta de credito o debito",
    planListNumber,
    planListFormatted: formatArsInteger(planListNumber),
    planDiscountPercent,
    planDiscountMonths,
    planFinalNumber,
    planFinalFormatted: formatArsInteger(planFinalNumber),
    planPromoLabel: `${planDiscountPercent}% de descuento por ${planDiscountMonths} meses`
  };
}

function injectStructuredData() {
  const pageKey = getCurrentPageKey();
  const kitCamPlusPricing = getStorefrontKitPricing("kit-cam-plus");
  const kitSmart11Pricing = getStorefrontKitPricing("kit-smart-1-1");
  const kitSmart22Pricing = getStorefrontKitPricing("kit-smart-2-2");
  const kitSmartCam22Pricing = getStorefrontKitPricing("kit-smart-cam-2-2");
  const kitIndustrialPricing = getStorefrontKitPricing("kit-industrial");

  const catalogKits = [
    { name: "Kit Cam Plus", sku: "kit-cam-plus", price: kitCamPlusPricing.installationPriceNumber, url: "pages/tienda/kit-cam-plus.html", image: "pages/tienda/kit-cam-plus.webp" },
    { name: "Kit Smart 1.1", sku: "kit-smart-1-1", price: kitSmart11Pricing.installationPriceNumber, url: "pages/tienda/kit-smart-1-1.html", image: "pages/tienda/kit-smart-1-1.webp" },
    { name: "Kit Smart 2.2", sku: "kit-smart-2-2", price: kitSmart22Pricing.installationPriceNumber, url: "pages/tienda/kit-smart-2-2.html", image: "pages/tienda/kit-smart-2-2.webp" },
    { name: "Kit Smart Cam 2.2", sku: "kit-smart-cam-2-2", price: kitSmartCam22Pricing.installationPriceNumber, url: "pages/tienda/kit-smart-cam-2-2.html", image: "pages/tienda/kit-smart-cam-2-2.webp" },
    { name: "Kit Industrial", sku: "kit-industrial", price: kitIndustrialPricing.installationPriceNumber, url: "pages/tienda/kit-industrial.html", image: "pages/tienda/kit-industrial.webp" }
  ];

  const pageMap = {
    "index.html": { kind: "home", name: "Inicio", image: "assets/img/tienda-hero-pc.webp" },
    "pages/hogar.html": {
      kind: "service",
      name: "Seguridad para Hogar",
      category: "Hogar",
      image: "assets/img/tienda-hero-pc.webp",
      faq: [
        { q: "Seguridad para Hogar con Monitoreo 24/7 | SmartHome", a: "Protege tu hogar con alarma inteligente, camaras, app movil y respuesta profesional las 24 horas." },
        { q: "TU HOGAR PROTEGIDO", a: "Protege tu hogar con alarma inteligente, camaras, app movil y respuesta profesional las 24 horas." }
      ]
    },
    "pages/comercio.html": {
      kind: "service",
      name: "Seguridad para Comercio",
      category: "Comercio",
      image: "assets/img/tienda-hero-pc.webp",
      faq: [
        { q: "Seguridad para Comercio con Monitoreo 24/7 | SmartHome", a: "Protege tu comercio con alarmas, camaras y control remoto desde app, con monitoreo activo todo el dia." },
        { q: "TU COMERCIO PROTEGIDO", a: "Protege tu comercio con alarmas, camaras y control remoto desde app, con monitoreo activo todo el dia." }
      ]
    },
    "pages/tienda.html": {
      kind: "store",
      name: "Tienda SmartHome",
      image: "assets/img/tienda-hero-pc.webp",
      faq: [
        { q: "Kits de Alarmas y Camaras para Hogar y Comercio | SmartHome", a: "Conoce los kits de seguridad SmartHome y elige la opcion ideal para proteger hogar o comercio." },
        { q: "Mensaje destacado SmartHome", a: "En SmartHome brindamos un servicio de proteccion integral las 24 horas con tecnologia inteligente y monitoreamos la correcta operacion de los sistemas de deteccion de intrusos de nuestros clientes." }
      ]
    },
    "pages/como-funciona.html": {
      kind: "service",
      name: "Como Funciona",
      category: "Proceso de servicio",
      image: "assets/img/tienda-hero-pc.webp",
      faq: [
        { q: "Sirve para hogar y comercio?", a: "Si. Adaptamos la solucion al tipo de propiedad, cantidad de accesos y nivel de riesgo." },
        { q: "Tengo que comprar el equipamiento?", a: "No. El equipamiento se entrega en comodato junto con el plan contratado, sin inversion inicial en dispositivos." },
        { q: "Puedo controlar todo desde el celular?", a: "Si. Podes armar y desarmar, ver eventos y recibir alertas en tiempo real desde la app." },
        { q: "Que pasa si necesito soporte?", a: "Contas con asistencia postventa y seguimiento tecnico para resolver ajustes o incidencias." }
      ]
    },
    "pages/contacto.html": {
      kind: "contact",
      name: "Contacto",
      image: "assets/img/pages/contacto/contacto-hero.jpg",
      faq: [
        { q: "Estamos para ayudarte con cualquier consulta", a: "Completá el formulario y nuestro equipo te contactará a la brevedad. Si necesitás, podés adjuntar archivos para que entendamos mejor tu caso." },
        { q: "Canales de atención", a: "Este formulario está pensado para centralizar consultas comerciales, técnicas y administrativas en una sola vía de contacto." }
      ]
    },
    "pages/quienes-somos.html": { kind: "about", name: "Quienes Somos", image: "assets/img/pages/quienes-somos/hero-quienes-somos.jpg" },
    "pages/planes/plan-basic.html": { kind: "plan", name: "Plan Basic", image: "assets/img/tienda-hero-pc.webp" },
    "pages/planes/plan-comercial.html": { kind: "plan", name: "Plan Comercial", image: "assets/img/tienda-hero-pc.webp" },
    "pages/planes/plan-plus.html": { kind: "plan", name: "Plan Plus", image: "assets/img/tienda-hero-pc.webp" },
    "pages/planes/plan-pro.html": { kind: "plan", name: "Plan Pro", image: "assets/img/tienda-hero-pc.webp" },
    "pages/planes/plan-video.html": { kind: "plan", name: "Plan Video", image: "assets/img/tienda-hero-pc.webp" },
    "pages/tienda/kit-cam-plus.html": {
      kind: "product",
      name: "Kit Cam Plus",
      sku: "kit-cam-plus",
      price: kitCamPlusPricing.installationPriceNumber,
      image: "pages/tienda/kit-cam-plus.webp",
      schemaDescription: "Camara Wi-Fi con grabacion en la nube, tarjeta de memoria, carteleria disuasiva y proteccion para exteriores."
    },
    "pages/tienda/kit-industrial.html": {
      kind: "product",
      name: "Kit Industrial",
      sku: "kit-industrial",
      price: kitIndustrialPricing.installationPriceNumber,
      image: "pages/tienda/kit-industrial.webp",
      schemaDescription: "Sistema de alarma con proteccion interior y exterior: sirena exterior, sensores de doble tecnologia para exteriores y cobertura ampliada."
    },
    "pages/tienda/kit-smart-1-1.html": {
      kind: "product",
      name: "Kit Smart 1.1",
      sku: "kit-smart-1-1",
      price: kitSmart11Pricing.installationPriceNumber,
      image: "pages/tienda/kit-smart-1-1.webp",
      schemaDescription: "Sistema de alarma con central, sensor de movimiento, sensor magnetico inalambrico, sirena interior y llavero de control."
    },
    "pages/tienda/kit-smart-2-2.html": {
      kind: "product",
      name: "Kit Smart 2.2",
      sku: "kit-smart-2-2",
      price: kitSmart22Pricing.installationPriceNumber,
      image: "pages/tienda/kit-smart-2-2.webp",
      schemaDescription: "Sistema de alarma con central, 2 sensores de movimiento, 2 sensores magneticos inalambricos, sirena interior y llavero."
    },
    "pages/tienda/kit-smart-cam-2-2.html": {
      kind: "product",
      name: "Kit Smart Cam 2.2",
      sku: "kit-smart-cam-2-2",
      price: kitSmartCam22Pricing.installationPriceNumber,
      image: "pages/tienda/kit-smart-cam-2-2.webp",
      schemaDescription: "Todo lo del Kit Smart 2.2 mas una camara Wi-Fi con grabacion en la nube y deteccion de movimiento."
    },
    "pages/soluciones-a-medida/cerco-electrico.html": { kind: "service", name: "Cerco Electrico Inteligente", category: "Soluciones a medida", image: "assets/img/pages/cercos-electricos/hero-cercos.jpg" },
    "pages/soluciones-a-medida/domotica.html": { kind: "service", name: "Domotica", category: "Soluciones a medida", image: "assets/img/tienda-hero-pc.webp" },
    "pages/soluciones-a-medida/seguridad-comunitaria.html": { kind: "service", name: "Seguridad Comunitaria", category: "Soluciones a medida", image: "assets/img/tienda-hero-pc.webp" },
    "pages/soluciones-a-medida/sistemas-de-camaras.html": { kind: "service", name: "Sistemas de Camaras", category: "Soluciones a medida", image: "assets/img/tienda-hero-pc.webp" },
    "gracias.html": { kind: "thanks", name: "Consulta Enviada", image: "assets/img/tienda-hero-pc.webp" }
  };

  const pageCfg = pageMap[pageKey];
  if (!pageCfg) return;

  document.querySelectorAll('script[data-smarthome-schema="1"]').forEach(node => node.remove());

  const canonicalEl = document.querySelector('link[rel="canonical"]');
  const canonicalUrl = canonicalEl ? canonicalEl.href : window.location.href;
  const baseUrl = new URL(canonicalUrl).origin;
  const pageUrl = pageKey === "index.html" ? `${baseUrl}/` : `${baseUrl}/${pageKey}`;

  const title = (document.querySelector("title")?.textContent || pageCfg.name || "SmartHome").trim();
  const description = (document.querySelector('meta[name="description"]')?.getAttribute("content") || "").trim();

  const organizationId = `${baseUrl}/#organization`;
  const websiteId = `${baseUrl}/#website`;
  const imageUrl = `${baseUrl}/${pageCfg.image}`;

  const organization = {
    "@type": "Organization",
    "@id": organizationId,
    name: "SmartHome",
    url: `${baseUrl}/`,
    logo: {
      "@type": "ImageObject",
      url: `${baseUrl}/assets/img/favicon.png`
    },
    image: imageUrl
  };

  const website = {
    "@type": "WebSite",
    "@id": websiteId,
    url: `${baseUrl}/`,
    name: "SmartHome",
    inLanguage: "es-AR",
    publisher: { "@id": organizationId }
  };

  const pageType = pageCfg.kind === "contact"
    ? "ContactPage"
    : pageCfg.kind === "about"
      ? "AboutPage"
      : (pageCfg.kind === "store" || pageCfg.kind === "service")
        ? "CollectionPage"
        : "WebPage";

  const webPage = {
    "@type": pageType,
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: title,
    description,
    inLanguage: "es-AR",
    isPartOf: { "@id": websiteId },
    about: { "@id": organizationId },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: imageUrl
    }
  };

  const graphItems = [organization, website, webPage];

  if (pageCfg.kind === "product") {
    const productDescription = pageCfg.schemaDescription || description;

    graphItems.push({
      "@type": "Product",
      "@id": `${pageUrl}#product`,
      name: pageCfg.name,
      sku: pageCfg.sku,
      image: [imageUrl],
      description: productDescription,
      brand: {
        "@type": "Brand",
        name: "SmartHome"
      },
      offers: {
        "@type": "Offer",
        price: pageCfg.price,
        priceCurrency: "ARS",
        availability: "https://schema.org/InStock",
        url: pageUrl,
        seller: { "@id": organizationId }
      }
    });
  }

  if (pageCfg.kind === "service" || pageCfg.kind === "plan") {
    graphItems.push({
      "@type": "Service",
      "@id": `${pageUrl}#service`,
      name: pageCfg.name,
      description,
      serviceType: pageCfg.kind === "plan" ? "Plan de seguridad inteligente" : pageCfg.category,
      provider: { "@id": organizationId },
      areaServed: {
        "@type": "Country",
        name: "Argentina"
      },
      url: pageUrl
    });
  }

  if (pageCfg.kind === "store") {
    graphItems.push({
      "@type": "OfferCatalog",
      "@id": `${pageUrl}#offer-catalog`,
      name: "Catalogo de Kits SmartHome",
      url: pageUrl,
      itemListElement: catalogKits.map((kit, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Offer",
          url: `${baseUrl}/${kit.url}`,
          price: kit.price,
          priceCurrency: "ARS",
          availability: "https://schema.org/InStock",
          itemOffered: {
            "@type": "Product",
            name: kit.name,
            sku: kit.sku,
            image: `${baseUrl}/${kit.image}`
          }
        }
      }))
    });
  }

  if (Array.isArray(pageCfg.faq) && pageCfg.faq.length > 0) {
    graphItems.push({
      "@type": "FAQPage",
      "@id": `${pageUrl}#faq`,
      mainEntity: pageCfg.faq.map(item => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a
        }
      }))
    });
  }

  const graphSchema = {
    "@context": "https://schema.org",
    "@graph": graphItems
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: buildBreadcrumbItems(baseUrl, pageKey, pageCfg.name)
  };

  document.head.appendChild(createJsonLdScript(graphSchema));
  document.head.appendChild(createJsonLdScript(breadcrumbSchema));
}

document.addEventListener("DOMContentLoaded", async function () {
  try {
    await ensureRuntimeCatalogConfig();
  } catch (error) {
    console.error("Error cargando configuracion central de precios:", error);
  }

  injectStructuredData();

  cargarHeader();
  cargarFooter();

  await cargarHero();
  cargarHeroForm();
  initContactLeadForm();
  cargarPorQueSmartHome();
  await cargarPlanesSlide();
  await cargarCotizar();
  await cargarEquipamiento();
  await cargarFuncionalidades();
  await cargarTuHogarProtegido();
  await cargarTuComercioProtegido();

  cargarContactate();
  cargarWhatsappFloat();
  cargarChatIAFloat();
  cargarZonasProteccionHogar();
  cargarZonasProteccionComercio();
  await cargarServiciosParaComercios();
  cargarCaracteristicasPanel();
  cargarComparacionCaracteristicasPlanes();
  cargarCentralMonitoreo247();
  cargarApp();
  cargarPlanesQueEs();
  await cargarPlanesIncluye();
  await cargarKitsQueIncluye();
  await cargarBeneficiosConfianza();
  await cargarKitsTienda();
  await cargarContrata4Pasos();
  await cargarPorQueElegir();
  await cargarDetalleProductoKit();
  await cargarEnConstruccion();

});

let swiperResourcesPromise = null;

function ensureSwiperResources() {
  if (typeof Swiper !== "undefined") {
    return Promise.resolve();
  }

  if (!document.querySelector('link[href*="swiper-bundle.min.css"]')) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css";
    document.head.appendChild(css);
  }

  if (swiperResourcesPromise) {
    return swiperResourcesPromise;
  }

  swiperResourcesPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src*="swiper-bundle.min.js"]');

    if (existingScript) {
      if (typeof Swiper !== "undefined") {
        resolve();
        return;
      }

      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("No se pudo cargar Swiper JS")), { once: true });
      return;
    }

    const js = document.createElement("script");
    js.src = "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js";
    js.onload = () => resolve();
    js.onerror = () => reject(new Error("No se pudo cargar Swiper JS"));
    document.body.appendChild(js);
  });

  return swiperResourcesPromise;
}

let siteRootUrlCache = null;

function getSiteRootUrl() {
  if (siteRootUrlCache) {
    return siteRootUrlCache;
  }

  const globalScript = document.querySelector('script[src*="assets/js/global.js"]');

  if (globalScript) {
    const scriptUrl = new URL(globalScript.getAttribute("src"), window.location.href);
    siteRootUrlCache = new URL("../../", scriptUrl);
    return siteRootUrlCache;
  }

  siteRootUrlCache = new URL("./", window.location.href);
  return siteRootUrlCache;
}

function getSiteAssetUrl(relativePath) {
  return new URL(relativePath, getSiteRootUrl()).toString();
}


/* =========================================
   HEADER
========================================= */

function cargarHeader() {
  fetch(getSiteAssetUrl('components/header/header.html'))
    .then(response => responseAsUtf8Text(response))
    .then(data => {
      const headerEl = document.getElementById('header');
      if (headerEl) headerEl.innerHTML = data;

      const logo = document.querySelector('.navbar-brand img');
      if (logo) {
        logo.src = getSiteAssetUrl('components/header/logo.png');
      }

      const brandLink = document.querySelector('.navbar-brand');
      if (brandLink) {
        brandLink.href = getSiteAssetUrl('index.html');
      }

      document.querySelectorAll('.menu-principal a').forEach(link => {
        const href = link.getAttribute('href');

        if (!href || href.startsWith('#') || href.startsWith('http')) return;

        link.href = getSiteAssetUrl(href);
      });

      // En links externos con target=_blank, quitar foco luego del click
      // para evitar feedback visual persistente en la página actual.
      document.querySelectorAll('.menu-principal a[target="_blank"]').forEach(link => {
        if (link.dataset.blurOnClickInit === 'true') return;
        link.dataset.blurOnClickInit = 'true';

        link.addEventListener('click', function () {
          setTimeout(() => {
            if (typeof this.blur === 'function') this.blur();
          }, 0);
        }, false);
      });

      try {
        activarMenu();
      } catch (e) {
        // fail silently if function not available
      }

      // Inicializar comportamiento táctil para dropdowns del header y auto-close del menu móvil
      try {
        initHeaderDropdownTouch();
      } catch (e) {
        // fail silently if function not available
      }
      try {
        initMobileMenuAutoClose();
      } catch (e) {
        // fail silently
      }

    })
    .catch(error => console.error('Error cargando header:', error));
}


/* =========================================
   FOOTER
========================================= */

function cargarFooter() {
  fetch(getSiteAssetUrl('components/footer/footer.html'))
    .then(response => responseAsUtf8Text(response))
    .then(data => {
      const footerEl = document.getElementById('footer');
      if (footerEl) footerEl.innerHTML = data;

      const footerLinks = document.querySelectorAll('.site-footer a');
      footerLinks.forEach(link => {
        const href = (link.getAttribute('href') || '').trim();

        if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          return;
        }

        link.href = getSiteAssetUrl(href);
      });

      const footerLogo = document.querySelector('.footer-brand img');
      if (footerLogo) {
        footerLogo.src = getSiteAssetUrl('components/footer/logo-blanco.png');
      }
    })
    .catch(error => console.error('Error cargando footer:', error));
}

/* =========================================
   HERO
========================================= */

async function cargarHero() {
  const heroContainer = document.getElementById("hero");
  if (!heroContainer) return;

  try {
    const pathname = window.location.pathname.toLowerCase();

    const getPageSlug = (path) => {
      const cleanPath = String(path || "").split("?")[0].split("#")[0];
      const lastPart = cleanPath.split("/").filter(Boolean).pop() || "index.html";
      const slug = lastPart.endsWith(".html") ? lastPart.replace(/\.html$/, "") : lastPart;
      return slug || "index";
    };

    const pageSlug = getPageSlug(pathname);

    const heroConfig = {
      index: {
        title: '<span class="text-brand">Protegé lo que más querés</span> con seguridad inteligente',
        description: "Descubrí alarmas, cámaras y monitoreo profesional para vivir con más tranquilidad todos los días.",
        origen: "index",
        image: "components/hero/hero-index.jpg"
      },
      hogar: {
        title: '<span class="text-brand">Seguridad inteligente</span> para tu hogar',
        description: "Alarmas, cámaras y monitoreo profesional para proteger tu casa con una solución moderna y confiable.",
        origen: "hogar",
        image: "components/hero/hero-hogar.jpg"
      },
      comercio: {
        title: '<span class="text-brand">Seguridad inteligente</span> para tu comercio',
        description: "Alarmas, cámaras y monitoreo profesional para proteger tu comercio con una solución moderna y confiable.",
        origen: "comercio",
        image: "components/hero/hero-comercio.jpg"
      },
      "plan-basic": {
        title: '<span class="text-brand">Plan Basic</span> para empezar a proteger tu hogar',
        description: "Una solución simple y efectiva para dar el primer paso en seguridad con respaldo profesional.",
        origen: "plan-basic",
        image: "components/hero/hero-plan-basic.jpg"
      },
      "plan-comercial": {
        title: '<span class="text-brand">Plan Comercial</span> pensado para tu negocio',
        description: "Protección integral para tu local con monitoreo activo, alertas rápidas y soporte especializado.",
        origen: "plan-comercial",
        image: "components/hero/hero-plan-comercial.jpg"
      },
      "plan-plus": {
        title: '<span class="text-brand">Plan Plus</span> con mayor cobertura y control',
        description: "Ideal para quienes buscan más funcionalidades y una experiencia de seguridad más completa.",
        origen: "plan-plus",
        image: "components/hero/hero-plan-plus.jpg"
      },
      "plan-pro": {
        title: '<span class="text-brand">Plan Pro</span> para operaciones exigentes',
        description: "Máximo nivel de protección y gestión para comercios con mayor dinámica y necesidades avanzadas.",
        origen: "plan-pro",
        image: "components/hero/hero-plan-pro.jpg"
      },
      "plan-video": {
        title: '<span class="text-brand">Plan Video</span> con vigilancia en tiempo real',
        description: "Visualizá tus espacios desde donde estés y complementá tu seguridad con monitoreo profesional.",
        origen: "plan-video",
        image: "components/hero/hero-plan-video.jpg"
      }
    };

    const pageKey = heroConfig[pageSlug] ? pageSlug : "index";

    const resolveHeroImagePath = async (relativePath) => {
      const candidate = getSiteAssetUrl(relativePath || "components/hero/hero-index.jpg");
      try {
        const imgCheck = await fetch(candidate, { method: "HEAD" });
        if (imgCheck.ok) return candidate;
      } catch (e) {
        // Ignore and fallback below
      }
      return getSiteAssetUrl("components/hero/hero-index.jpg");
    };

    const response = await fetch(getSiteAssetUrl("components/hero/hero.html"));
    if (!response.ok) {
      throw new Error(`No se pudo cargar hero.html: ${response.status}`);
    }

    const heroHTML = await responseAsUtf8Text(response);
    heroContainer.innerHTML = heroHTML;

    const config = heroConfig[pageKey] || heroConfig.index;
    const heroImage = await resolveHeroImagePath(config.image);

    const section = heroContainer.querySelector(".hero-page");
    if (section) {
      section.style.backgroundImage = `url('${heroImage}')`;
    }

    const titleEl = heroContainer.querySelector("#hero-title");
    if (titleEl) {
      titleEl.innerHTML = config.title;
    }

    const descriptionEl = heroContainer.querySelector("#hero-description");
    if (descriptionEl) {
      descriptionEl.textContent = config.description;
    }

    const formContainer = heroContainer.querySelector("#hero-form-container");
    if (formContainer) {
      formContainer.dataset.origen = config.origen;
    }

  } catch (error) {
    console.error("Error cargando hero:", error);
  }
}

/* =========================================
   POR QUE SMARTHOME
========================================= */

function cargarPorQueSmartHome() {
  const container = document.getElementById("por-que-smarthome");
  if (!container) return;

  fetch(getSiteAssetUrl("components/por-que-smarthome/por-que-smarthome.html"))
    .then(response => {
      if (!response.ok) {
        throw new Error(`No se pudo cargar por-que-smarthome.html: ${response.status}`);
      }
      return responseAsUtf8Text(response);
    })
    .then(html => {
      container.innerHTML = html;
    })
    .catch(error => console.error("Error cargando por-que-smarthome:", error));
}

/* =========================================
   PLANES SLIDE
========================================= */

async function cargarPlanesSlide() {
  const container = document.getElementById("planes-slide");

  // Si no hay placeholder, mantener compatibilidad con HTML inline
  if (!container) {
    await ensureSwiperResources();
    initPlansHomeSlider();
    return;
  }

  try {
    const response = await fetch(getSiteAssetUrl("components/planes-slide/planes-slide.html"));
    if (!response.ok) {
      throw new Error(`No se pudo cargar planes-slide.html: ${response.status}`);
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;

    container.querySelectorAll(".plan-home-card__image").forEach((img) => {
      const currentSrc = img.getAttribute("src") || "";
      if (currentSrc) {
        img.src = getSiteAssetUrl(currentSrc);
      }
    });

    container.querySelectorAll(".plan-home-card__button[data-plan-url]").forEach((button) => {
      const targetPath = String(button.getAttribute("data-plan-url") || "").trim();
      if (!targetPath) return;
      button.setAttribute("href", getSiteAssetUrl(targetPath));
    });

    await ensureSwiperResources();
    initPlansHomeSlider();
  } catch (error) {
    console.error("Error cargando planes-slide:", error);
  }
}

/* =========================================
   COTIZAR
========================================= */

async function cargarCotizar() {
  const container = document.getElementById("cotizar");
  if (!container) return;

  try {
    const response = await fetch(getSiteAssetUrl("components/cotizar/cotizar.html"));
    if (!response.ok) {
      throw new Error(`No se pudo cargar cotizar.html: ${response.status}`);
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;

    container.querySelectorAll('a[href]').forEach(link => {
      const href = (link.getAttribute('href') || '').trim();
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      link.href = getSiteAssetUrl(href);
    });

    const cotizarImage = container.querySelector(".cotizar-home-image");
    if (cotizarImage) {
      cotizarImage.src = getSiteAssetUrl("components/cotizar/cotizar.png");
    }
  } catch (error) {
    console.error("Error cargando cotizar:", error);
  }
}

/* =========================================
   EQUIPAMIENTO
========================================= */

async function cargarEquipamiento() {
  const container = document.getElementById("equipamiento");
  if (!container) return;

  try {
    const response = await fetch(getSiteAssetUrl("components/equipamiento/equipamiento.html"));
    if (!response.ok) {
      throw new Error(`No se pudo cargar equipamiento.html: ${response.status}`);
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;

    const backImg = container.querySelector(".equipamiento-home__img-back");
    if (backImg) {
      backImg.src = getSiteAssetUrl("components/equipamiento/equipamiento-fondo.png");
    }

    const frontImg = container.querySelector(".equipamiento-home__img-front");
    if (frontImg) {
      frontImg.src = getSiteAssetUrl("components/equipamiento/equipamiento-panel.png");
    }
  } catch (error) {
    console.error("Error cargando equipamiento:", error);
  }
}

/* =========================================
   FUNCIONALIDADES
========================================= */

async function cargarFuncionalidades() {
  const container = document.getElementById("funcionalidades");

  // Si no hay placeholder, mantener compatibilidad con HTML inline
  if (!container) {
    await ensureSwiperResources();
    initFuncionalidadesHomeSlider();
    return;
  }

  try {
    const response = await fetch(getSiteAssetUrl("components/funcionalidades/funcionalidades.html"));
    if (!response.ok) {
      throw new Error(`No se pudo cargar funcionalidades.html: ${response.status}`);
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;

    container.querySelectorAll(".funcionalidades-home__bg[data-bg]").forEach(bgEl => {
      const file = bgEl.getAttribute("data-bg");
      if (!file) return;
      bgEl.style.backgroundImage = `url('${getSiteAssetUrl(`components/funcionalidades/${file}`)}')`;
    });

    await ensureSwiperResources();
    initFuncionalidadesHomeSlider();
  } catch (error) {
    console.error("Error cargando funcionalidades:", error);
  }
}

/* =========================================
   TU HOGAR PROTEGIDO
========================================= */

async function cargarTuHogarProtegido() {
  const container = document.getElementById("tu-hogar-protegido");
  if (!container) return;

  try {
    const response = await fetch(getSiteAssetUrl("components/tu-hogar-protegido/tu-hogar-protegido.html"));
    if (!response.ok) {
      throw new Error(`No se pudo cargar tu-hogar-protegido.html: ${response.status}`);
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;

    const images = container.querySelectorAll("img");
    if (images[0]) images[0].src = getSiteAssetUrl("components/tu-hogar-protegido/tu-hogar-protegido.png");
    if (images[1]) images[1].src = getSiteAssetUrl("components/tu-hogar-protegido/tu-hogar-protegido-2.png");
    if (images[2]) images[2].src = getSiteAssetUrl("components/tu-hogar-protegido/tu-hogar-protegido-3.png");
  } catch (error) {
    console.error("Error cargando tu-hogar-protegido:", error);
  }
}

/* =========================================
   TU COMERCIO PROTEGIDO
========================================= */

async function cargarTuComercioProtegido() {
  const container = document.getElementById("tu-comercio-protegido");
  if (!container) return;

  try {
    const response = await fetch(getSiteAssetUrl("components/tu-comercio-protegido/tu-comercio-protegido.html"));
    if (!response.ok) {
      throw new Error(`No se pudo cargar tu-comercio-protegido.html: ${response.status}`);
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;

    const images = container.querySelectorAll("img");
    if (images[0]) images[0].src = getSiteAssetUrl("components/tu-comercio-protegido/comercio-protegido.png");
    if (images[1]) images[1].src = getSiteAssetUrl("components/tu-comercio-protegido/tu-comercio-protegido-01.jpeg");
    if (images[2]) images[2].src = getSiteAssetUrl("components/tu-comercio-protegido/tu-comercio-protegido-02.jpeg");
  } catch (error) {
    console.error("Error cargando tu-comercio-protegido:", error);
  }
}

/* =========================================================
   FORMULARIO GLOBAL DEL HERO
   El formulario vive dentro de components/hero/hero.html
   y aquí solo se inicializa su lógica y origen.
========================================================= */

async function cargarHeroForm() {
  const heroFormContainer = document.getElementById("hero-form-container");

  /* Si la página no tiene contenedor, no hacemos nada */
  if (!heroFormContainer) return;

  try {
    const origen = heroFormContainer.dataset.origen || "desconocido";
    const origenInput = document.getElementById("lead-origen");

    if (origenInput) {
      origenInput.value = origen;
    }

    initHeroLeadForm();
  } catch (error) {
    console.error("Error inicializando hero-form:", error);
  }
}

const SHARED_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzxkHX0fbZlJiENW5xcMq-CAkGLS3K3aI18A0vVuEySE079E1JOddCB-s6xDa3bEIasjw/exec';
const CHAT_IA_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbylZQUltdnal_oGQ0ntZzjTkBO9vm-_TVCqcaVupBgMV5lUqcadIQy7CclMUZNeUit4Yw/exec';

function initHeroLeadForm() {
  const form = document.getElementById('hero-lead-form');
  if (!form) return;

  const scriptURL = SHARED_APPS_SCRIPT_URL;

  const nombreInput = document.getElementById('lead-nombre');
  const telefonoInput = document.getElementById('lead-telefono');
  const provinciaInput = document.getElementById('lead-provincia');
  const emailInput = document.getElementById('lead-email');
  const websiteInput = document.getElementById('lead-website');
  const origenInput = document.getElementById('lead-origen');
  const formLoadedAtInput = document.getElementById('formLoadedAt');
  const submitButton = document.getElementById('hero-form-submit');
  const messageBox = document.getElementById('hero-form-message');

  if (form.dataset.initialized === 'true') return;
  form.dataset.initialized = 'true';

  if (origenInput && !origenInput.value) {
    origenInput.value = document.title || 'Página sin título';
  }

  if (formLoadedAtInput) {
    formLoadedAtInput.value = Date.now();
  }

  const onlyDigits = (value) => String(value || '').replace(/\D/g, '');
  const emailIsValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  if (telefonoInput) {
    telefonoInput.addEventListener('input', function () {
      this.value = onlyDigits(this.value).slice(0, 10);
      if (this.value.length === 10) {
        clearFieldError(this);
      }
    });
  }

  function getFieldErrorNode(field) {
    if (!field || !field.id) return null;

    const group = field.closest('.form-group');
    if (!group) return null;

    let errorNode = group.querySelector(`.field-error[data-for="${field.id}"]`);
    if (!errorNode) {
      errorNode = document.createElement('small');
      errorNode.className = 'field-error';
      errorNode.dataset.for = field.id;
      errorNode.id = `${field.id}-error`;
      group.appendChild(errorNode);
    }

    return errorNode;
  }

  function clearFieldError(field) {
    if (!field) return;

    field.classList.remove('is-invalid');
    field.removeAttribute('aria-invalid');

    const errorNode = getFieldErrorNode(field);
    if (errorNode) {
      errorNode.textContent = '';
      errorNode.classList.remove('is-visible');
      if (field.getAttribute('aria-describedby') === errorNode.id) {
        field.removeAttribute('aria-describedby');
      }
    }
  }

  function setFieldError(field, message) {
    if (!field) return;

    field.classList.add('is-invalid');
    field.setAttribute('aria-invalid', 'true');

    const errorNode = getFieldErrorNode(field);
    if (errorNode) {
      errorNode.textContent = String(message || 'Este campo es obligatorio.');
      errorNode.classList.add('is-visible');
      field.setAttribute('aria-describedby', errorNode.id);
    }
  }

  function showMessage(text, type) {
    if (!messageBox) return;

    messageBox.textContent = text;
    messageBox.classList.remove('is-error', 'is-success');

    if (type === 'error') messageBox.classList.add('is-error');
    if (type === 'success') messageBox.classList.add('is-success');
  }

  function validateForm() {
    let isValid = true;

    [nombreInput, telefonoInput, provinciaInput, emailInput].forEach(clearFieldError);
    showMessage('', '');

    const nombre = nombreInput ? nombreInput.value.trim() : '';
    const telefono = telefonoInput ? onlyDigits(telefonoInput.value) : '';
    const provincia = provinciaInput ? provinciaInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';

    if (nombre.length < 3) {
      setFieldError(nombreInput, 'Ingresá nombre y apellido (mínimo 3 caracteres).');
      isValid = false;
    }

    // Ahora requerimos exactamente 10 dígitos para teléfono
    if (telefono.length !== 10) {
      setFieldError(telefonoInput, 'Ingresá 10 dígitos, sin 0 y sin 15.');
      isValid = false;
    }

    if (!provincia) {
      setFieldError(provinciaInput, 'Seleccioná una provincia.');
      isValid = false;
    }

    if (!emailIsValid(email)) {
      setFieldError(emailInput, 'Ingresá un mail válido (ejemplo: nombre@dominio.com).');
      isValid = false;
    }

    if (!isValid) {
      showMessage('Revisá los campos marcados antes de enviar.', 'error');
    }

    return isValid;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (!validateForm()) return;

    // Cambiar texto del botón a 'Enviando...' y deshabilitarlo
    const originalButtonText = submitButton ? submitButton.textContent.trim() : '';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalText = originalButtonText || 'Enviar';
      submitButton.textContent = 'Enviando...';
    }
    // limpiar mensajes en pantalla
    showMessage('', '');

    const loadedAt = Number(formLoadedAtInput?.value || Date.now());
    const tiempoSegundos = Math.floor((Date.now() - loadedAt) / 1000);

    const payload = {
      nombreApellido: nombreInput ? nombreInput.value.trim() : '',
      telefono: telefonoInput ? onlyDigits(telefonoInput.value) : '',
      provincia: provinciaInput ? provinciaInput.value.trim() : '',
      mail: emailInput ? emailInput.value.trim() : '',
      website: websiteInput ? websiteInput.value.trim() : '',
      tiempoSegundos: tiempoSegundos,
      pagina: origenInput ? origenInput.value : (document.title || 'Página sin título'),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    try {
      const response = await fetch(scriptURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.ok) {
        // Mostrar mensaje de éxito centrado antes de redirigir
        showMessage('Datos enviados correctamente. Redirigiendo...', 'success');

        setTimeout(function () {
          const successURL = window.location.pathname.includes('/pages/')
            ? '../gracias.html'
            : 'gracias.html';

          window.location.href = successURL;
        }, 700);
      } else {
        showMessage('No se pudo enviar el formulario. Revisá los datos e intentá nuevamente.', 'error');
        console.error('Respuesta del backend:', result);
      }
    } catch (error) {
      showMessage('Ocurrió un error al enviar. Intentá nuevamente en unos minutos.', 'error');
      console.error('Error enviando formulario:', error);
    } finally {
      // Restaurar texto y estado del botón si no se redirige
      if (submitButton) {
        submitButton.disabled = false;
        // Restaurar texto original después de un pequeño retraso para que el usuario vea el cambio
        const original = submitButton.dataset.originalText || 'Enviar';
        submitButton.textContent = original;
        delete submitButton.dataset.originalText;
      }
    }
  });
}

/* =========================================================
   FORMULARIO PAGINA CONTACTO
   - Validaciones reforzadas
   - Adjuntos con limites de seguridad
========================================================= */

function initContactLeadForm() {
  const form = document.getElementById('contact-lead-form');
  if (!form) return;
  if (form.dataset.initialized === 'true') return;
  form.dataset.initialized = 'true';

  const configuredScriptUrl = String(form.dataset.scriptUrl || '').trim();
  const scriptURL = configuredScriptUrl && configuredScriptUrl !== 'PEGAR_AQUI_URL_WEBAPP_CONTACTO'
    ? configuredScriptUrl
    : SHARED_APPS_SCRIPT_URL;

  const motivoInput = document.getElementById('contact-motivo');
  const nombreInput = document.getElementById('contact-nombre');
  const telefonoInput = document.getElementById('contact-telefono');
  const emailInput = document.getElementById('contact-email');
  const direccionInput = document.getElementById('contact-direccion');
  const provinciaInput = document.getElementById('contact-provincia');
  const ciudadInput = document.getElementById('contact-ciudad');
  const comentariosInput = document.getElementById('contact-comentarios');
  const adjuntosInput = document.getElementById('contact-adjuntos');
  const websiteInput = document.getElementById('contactWebsite');
  const loadedAtInput = document.getElementById('contactFormLoadedAt');
  const submitButton = document.getElementById('contact-form-submit');
  const messageBox = document.getElementById('contact-form-message');

  if (loadedAtInput) loadedAtInput.value = Date.now();

  const MAX_FILES = 3;
  const MAX_FILE_SIZE = 4 * 1024 * 1024;
  const MAX_TOTAL_SIZE = 8 * 1024 * 1024;
  const ALLOWED_TYPES = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx'];

  const IMAGE_COMPRESS_TYPES = ['image/jpeg', 'image/webp'];
  const IMAGE_COMPRESS_MIN_SIZE = 2 * 1024 * 1024;
  const IMAGE_MAX_DIMENSION = 1600;
  const IMAGE_COMPRESS_QUALITY = 0.8;

  const provinciasCiudades = {
    'Buenos Aires': ['La Plata', 'Mar del Plata', 'Bahía Blanca', 'San Isidro'],
    'CABA': ['Ciudad Autónoma de Buenos Aires'],
    'Catamarca': ['San Fernando del Valle de Catamarca', 'Belén'],
    'Chaco': ['Resistencia', 'Presidencia Roque Sáenz Peña'],
    'Chubut': ['Rawson', 'Comodoro Rivadavia', 'Puerto Madryn'],
    'Córdoba': ['Córdoba', 'Villa Carlos Paz', 'Río Cuarto'],
    'Corrientes': ['Corrientes', 'Goya'],
    'Entre Ríos': ['Paraná', 'Concordia', 'Gualeguaychú'],
    'Formosa': ['Formosa', 'Clorinda'],
    'Jujuy': ['San Salvador de Jujuy', 'Palpalá'],
    'La Pampa': ['Santa Rosa', 'General Pico'],
    'La Rioja': ['La Rioja', 'Chilecito'],
    'Mendoza': ['Mendoza', 'Godoy Cruz', 'San Rafael'],
    'Misiones': ['Posadas', 'Eldorado'],
    'Neuquén': ['Neuquén', 'San Martín de los Andes'],
    'Río Negro': ['Viedma', 'Bariloche', 'General Roca'],
    'Salta': ['Salta', 'Tartagal'],
    'San Juan': ['San Juan', 'Rivadavia', 'Rawson'],
    'San Luis': ['San Luis', 'Villa Mercedes'],
    'Santa Cruz': ['Río Gallegos', 'Caleta Olivia'],
    'Santa Fe': ['Santa Fe', 'Rosario', 'Rafaela'],
    'Santiago del Estero': ['Santiago del Estero', 'La Banda'],
    'Tierra del Fuego': ['Ushuaia', 'Río Grande'],
    'Tucumán': ['San Miguel de Tucumán', 'Yerba Buena']
  };

  const onlyDigits = (value) => String(value || '').replace(/\D/g, '');
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalize(value).toLowerCase());

  const hasSuspiciousPatterns = (value) => {
    const text = normalize(value).toLowerCase();
    if (!text) return false;

    const spamPatterns = [
      /https?:\/\//i,
      /www\./i,
      /bit\.ly|tinyurl|t\.co|goo\.gl/i,
      /whatsapp|wa\.me|telegram|t\.me/i,
      /casino|apuesta|forex|crypto|bitcoin|viagra|porn/i,
      /(.)\1{5,}/
    ];

    return spamPatterns.some((re) => re.test(text));
  };

  function showMessage(text, type) {
    if (!messageBox) return;
    messageBox.innerHTML = text;
    messageBox.classList.remove('is-error', 'is-success');
    if (type === 'error') messageBox.classList.add('is-error');
    if (type === 'success') messageBox.classList.add('is-success');
  }

  function setFieldError(field, hasError) {
    if (!field) return;

    if (hasError) {
      field.classList.add('is-invalid');
      field.setAttribute('aria-invalid', 'true');
      return;
    }

    field.classList.remove('is-invalid');
    field.removeAttribute('aria-invalid');
  }

  function getFieldErrorNode(field) {
    if (!field || !field.id) return null;

    const group = field.closest('.form-group');
    if (!group) return null;

    let errorNode = group.querySelector(`.field-error[data-for="${field.id}"]`);
    if (!errorNode) {
      errorNode = document.createElement('small');
      errorNode.className = 'field-error';
      errorNode.dataset.for = field.id;
      errorNode.id = `${field.id}-error`;
      group.appendChild(errorNode);
    }

    return errorNode;
  }

  function setFieldErrorMessage(field, message) {
    if (!field) return;

    const errorNode = getFieldErrorNode(field);
    if (!errorNode) return;

    if (message) {
      errorNode.textContent = String(message);
      errorNode.classList.add('is-visible');
      field.setAttribute('aria-describedby', errorNode.id);
      return;
    }

    errorNode.textContent = '';
    errorNode.classList.remove('is-visible');
    if (field.getAttribute('aria-describedby') === errorNode.id) {
      field.removeAttribute('aria-describedby');
    }
  }

  function fillProvincias() {
    if (!provinciaInput) return;

    const provincias = Object.keys(provinciasCiudades).sort((a, b) => a.localeCompare(b, 'es'));
    provinciaInput.innerHTML = '<option value="">Seleccionar</option>';
    provincias.forEach((provincia) => {
      const opt = document.createElement('option');
      opt.value = provincia;
      opt.textContent = provincia;
      provinciaInput.appendChild(opt);
    });
  }

  function fillCiudades(provincia) {
    if (!ciudadInput) return;

    const ciudades = provinciasCiudades[provincia] || [];
    ciudadInput.innerHTML = '';

    if (!ciudades.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Seleccionar provincia primero';
      ciudadInput.appendChild(opt);
      ciudadInput.disabled = true;
      return;
    }

    const initial = document.createElement('option');
    initial.value = '';
    initial.textContent = 'Seleccionar';
    ciudadInput.appendChild(initial);

    ciudades.forEach((ciudad) => {
      const opt = document.createElement('option');
      opt.value = ciudad;
      opt.textContent = ciudad;
      ciudadInput.appendChild(opt);
    });

    ciudadInput.disabled = false;
  }

  function validateFiles(files) {
    const list = Array.from(files || []);

    if (list.length > MAX_FILES) {
      return `Podés adjuntar hasta ${MAX_FILES} archivos.`;
    }

    const totalSize = list.reduce((acc, file) => acc + Number(file.size || 0), 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      return 'El tamaño total de adjuntos supera el límite permitido.';
    }

    for (const file of list) {
      const ext = String(file.name || '').split('.').pop().toLowerCase();
      const typeOk = ALLOWED_TYPES.includes(file.type);
      const extOk = ALLOWED_EXTENSIONS.includes(ext);

      if (!typeOk && !extOk) {
        return `El archivo ${file.name} no tiene un formato permitido.`;
      }

      if (Number(file.size || 0) > MAX_FILE_SIZE) {
        return `El archivo ${file.name} supera el tamaño máximo permitido.`;
      }
    }

    return '';
  }

  function validateForm() {
    let hasErrors = false;

    [
      motivoInput,
      nombreInput,
      telefonoInput,
      emailInput,
      direccionInput,
      provinciaInput,
      ciudadInput,
      comentariosInput,
      adjuntosInput
    ].forEach((field) => {
      setFieldError(field, false);
      setFieldErrorMessage(field, '');
    });

    const motivo = normalize(motivoInput?.value);
    const nombre = normalize(nombreInput?.value);
    const telefono = onlyDigits(telefonoInput?.value);
    const mail = normalize(emailInput?.value).toLowerCase();
    const direccion = normalize(direccionInput?.value);
    const provincia = normalize(provinciaInput?.value);
    const ciudad = normalize(ciudadInput?.value);
    const comentarios = normalize(comentariosInput?.value);

    if (!motivo) {
      setFieldError(motivoInput, true);
      setFieldErrorMessage(motivoInput, 'Seleccioná el motivo de consulta.');
      hasErrors = true;
    }

    if (nombre.length < 3 || hasSuspiciousPatterns(nombre)) {
      setFieldError(nombreInput, true);
      setFieldErrorMessage(nombreInput, 'Ingresá nombre y apellido real (mínimo 3 caracteres, sin links).');
      hasErrors = true;
    }

    if (telefono.length !== 10) {
      setFieldError(telefonoInput, true);
      setFieldErrorMessage(telefonoInput, 'Ingresá 10 dígitos, sin 0 y sin 15.');
      hasErrors = true;
    }

    if (!isValidEmail(mail) || hasSuspiciousPatterns(mail)) {
      setFieldError(emailInput, true);
      setFieldErrorMessage(emailInput, 'Ingresá un mail válido (ejemplo: nombre@dominio.com).');
      hasErrors = true;
    }

    if (direccion.length < 6 || hasSuspiciousPatterns(direccion)) {
      setFieldError(direccionInput, true);
      setFieldErrorMessage(direccionInput, 'Ingresá una dirección válida (mínimo 6 caracteres, sin links).');
      hasErrors = true;
    }

    if (!provincia) {
      setFieldError(provinciaInput, true);
      setFieldErrorMessage(provinciaInput, 'Seleccioná una provincia.');
      hasErrors = true;
    }

    if (!ciudad) {
      setFieldError(ciudadInput, true);
      setFieldErrorMessage(ciudadInput, 'Seleccioná una ciudad.');
      hasErrors = true;
    }

    if (comentarios.length < 10 || comentarios.length > 1200 || hasSuspiciousPatterns(comentarios)) {
      setFieldError(comentariosInput, true);
      setFieldErrorMessage(comentariosInput, 'Escribí entre 10 y 1200 caracteres, sin links o texto sospechoso.');
      hasErrors = true;
    }

    const filesError = validateFiles(adjuntosInput?.files);
    if (filesError) {
      setFieldError(adjuntosInput, true);
      setFieldErrorMessage(adjuntosInput, filesError);
      hasErrors = true;
    }

    if (hasErrors) {
      showMessage('Revisá los campos marcados antes de enviar.', 'error');
      return false;
    }

    showMessage('', '');
    return true;
  }

  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const parts = result.split(',');
        resolve(parts.length > 1 ? parts[1] : '');
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo adjunto'));
      reader.readAsDataURL(file);
    });
  }

  async function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
      reader.readAsDataURL(file);
    });
  }

  async function loadImageElement(dataURL) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo procesar la imagen'));
      img.src = dataURL;
    });
  }

  async function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    });
  }

  async function optimizeFileForUpload(file) {
    const isCompressibleImage = IMAGE_COMPRESS_TYPES.includes(file?.type);
    const originalSize = Number(file?.size || 0);

    if (!isCompressibleImage || originalSize < IMAGE_COMPRESS_MIN_SIZE) {
      return file;
    }

    try {
      const dataURL = await readAsDataURL(file);
      const image = await loadImageElement(dataURL);

      const width = Number(image.naturalWidth || 0);
      const height = Number(image.naturalHeight || 0);
      if (!width || !height) return file;

      const ratio = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * ratio));
      const targetHeight = Math.max(1, Math.round(height * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return file;

      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
      const optimizedBlob = await canvasToBlob(canvas, file.type, IMAGE_COMPRESS_QUALITY);

      if (!optimizedBlob || optimizedBlob.size >= originalSize) {
        return file;
      }

      return new File([optimizedBlob], file.name, {
        type: file.type,
        lastModified: Date.now()
      });
    } catch (_error) {
      return file;
    }
  }

  async function getFilePayload(files) {
    const list = Array.from(files || []);
    return Promise.all(list.map(async (file) => {
      const optimizedFile = await optimizeFileForUpload(file);
      const base64 = await fileToBase64(optimizedFile);
      return {
        name: optimizedFile.name,
        mimeType: optimizedFile.type || 'application/octet-stream',
        size: Number(optimizedFile.size || 0),
        contentBase64: base64
      };
    }));
  }

  if (telefonoInput) {
    telefonoInput.addEventListener('input', function () {
      this.value = onlyDigits(this.value).slice(0, 10);
      if (this.value.length === 10) {
        setFieldError(this, false);
        setFieldErrorMessage(this, '');
      }
    });
  }

  if (provinciaInput) {
    provinciaInput.addEventListener('change', function () {
      fillCiudades(this.value);
      setFieldError(ciudadInput, false);
      setFieldErrorMessage(ciudadInput, '');
    });
  }

  [
    motivoInput,
    nombreInput,
    emailInput,
    direccionInput,
    provinciaInput,
    ciudadInput,
    comentariosInput
  ].forEach((field) => {
    if (!field) return;

    const eventName = field.tagName === 'SELECT' ? 'change' : 'input';
    field.addEventListener(eventName, function () {
      if (normalize(this.value)) {
        setFieldError(this, false);
        setFieldErrorMessage(this, '');
      }
    });
  });

  if (adjuntosInput) {
    adjuntosInput.addEventListener('change', function () {
      const filesError = validateFiles(this.files);
      if (!filesError) {
        setFieldError(this, false);
        setFieldErrorMessage(this, '');
      }
    });
  }

  fillProvincias();
  fillCiudades('');

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (!scriptURL) {
      showMessage('No hay URL de Apps Script configurada para el formulario.', 'error');
      return;
    }

    if (!validateForm()) return;

    const honeypot = normalize(websiteInput?.value);
    const loadedAt = Number(loadedAtInput?.value || Date.now());
    const tiempoSegundos = Math.floor((Date.now() - loadedAt) / 1000);

    if (honeypot) {
      showMessage('No se pudo enviar la consulta.', 'error');
      return;
    }

    if (tiempoSegundos > 0 && tiempoSegundos < 4) {
      showMessage('Esperá unos segundos antes de enviar el formulario.', 'error');
      return;
    }

    const originalText = submitButton ? submitButton.textContent.trim() : 'Enviar consulta';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Enviando...';
    }

    showMessage('', '');

    try {
      if (submitButton) {
        submitButton.textContent = 'Procesando adjuntos...';
      }

      const files = await getFilePayload(adjuntosInput?.files);

      if (submitButton) {
        submitButton.textContent = 'Enviando...';
      }

      const payload = {
        formType: 'contact',
        motivoConsulta: normalize(motivoInput?.value),
        nombreApellido: normalize(nombreInput?.value),
        telefono: onlyDigits(telefonoInput?.value),
        mail: normalize(emailInput?.value).toLowerCase(),
        direccion: normalize(direccionInput?.value),
        provincia: normalize(provinciaInput?.value),
        ciudad: normalize(ciudadInput?.value),
        comentarios: normalize(comentariosInput?.value),
        website: honeypot,
        tiempoSegundos: tiempoSegundos,
        pagina: document.title || 'Contacto',
        url: window.location.href,
        userAgent: navigator.userAgent,
        archivos: files
      };

      const response = await fetch(scriptURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.ok) {
        showMessage('Consulta enviada correctamente. Redirigiendo...', 'success');
        setTimeout(function () {
          const successURL = window.location.pathname.includes('/pages/')
            ? '../gracias.html'
            : 'gracias.html';

          window.location.href = successURL;
        }, 500);
      } else {
        const backendError =
          (Array.isArray(result.errors) && result.errors.length ? result.errors[0] : '') ||
          result.detail ||
          result.message ||
          'No se pudo enviar la consulta. Verificá tus datos e intentá nuevamente.';

        showMessage(backendError, 'error');
        console.error('Respuesta backend contacto:', result);
      }
    } catch (error) {
      showMessage('Ocurrió un error durante el envío. Intentá nuevamente en unos minutos.', 'error');
      console.error('Error enviando contacto:', error);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText || 'Enviar consulta';
      }
    }
  });
}

/* =========================================================
   SECCION PLANES HOME
========================================================= */

/* =========================================================
  SECCION PLANES HOME - SWIPER SOLO EN MOBILE
========================================================= */

function initPlansHomeSlider() {
  const sliderElement = document.getElementById("plansHomeSlider");

  if (!sliderElement || typeof Swiper === "undefined") return;
  if (sliderElement.dataset.swiperInited === "true") return;
  sliderElement.dataset.swiperInited = "true";

  let plansHomeSwiper = null;

  function enablePlansHomeSwiper() {
    if (plansHomeSwiper) return;
    // En mobile, iniciar centrado en Plan Basic (orden esperado: Video, Basic, Plus, Pro, Comercial)
    const slides = sliderElement.querySelectorAll('.swiper-slide');
    const slidesCount = Math.max(1, slides.length);
    const BASIC_PLAN_INDEX_MOBILE = 1;
    const initialIndex = Math.min(BASIC_PLAN_INDEX_MOBILE, slidesCount - 1);

    plansHomeSwiper = new Swiper(sliderElement, {
      loop: true,
      slidesPerView: 1.12,
      centeredSlides: true,
      initialSlide: initialIndex,
      spaceBetween: 18,
      speed: 600,
      grabCursor: true,
      simulateTouch: true,
      allowTouchMove: true,
      touchRatio: 1,
      touchAngle: 45,
      threshold: 6
    });
  }

  function disablePlansHomeSwiper() {
    if (!plansHomeSwiper) return;

    plansHomeSwiper.destroy(true, true);
    plansHomeSwiper = null;
  }

  function handlePlansHomeSlider() {
    if (window.innerWidth <= 991.98) {
      enablePlansHomeSwiper();
    } else {
      disablePlansHomeSwiper();
    }
  }

  // Ejecutar al iniciar y al redimensionar
  handlePlansHomeSlider();
  window.addEventListener('resize', handlePlansHomeSlider);
  window.addEventListener('orientationchange', handlePlansHomeSlider);
}

/* =========================================================
  SECCION FUNCIONALIDADES HOME
========================================================= */

function initFuncionalidadesHomeSlider() {
  const sliderElement = document.getElementById("funcionalidadesHomeSlider");

  if (!sliderElement || typeof Swiper === "undefined") return;
  if (sliderElement.dataset.swiperInited === "true") return;
  sliderElement.dataset.swiperInited = "true";

  const slides = sliderElement.querySelectorAll(".swiper-slide");
  const slidesCount = slides.length;

  /*
    Con loop + centeredSlides + 3 visibles en desktop,
    conviene tener al menos 5 slides reales.
  */
  const canLoop = slidesCount >= 5;
  const middleIndex = Math.floor(slidesCount / 2);

  const funcionalidadesHomeSwiper = new Swiper(sliderElement, {
    loop: canLoop,
    centeredSlides: true,
    initialSlide: middleIndex,
    slidesPerView: 1,
    spaceBetween: 16,
    speed: 700,
    grabCursor: true,
    watchSlidesProgress: true,
    allowTouchMove: true,
    loopAdditionalSlides: canLoop ? 3 : 0,

    autoplay: {
      delay: 5000,
      disableOnInteraction: false,
      pauseOnMouseEnter: true,
      reverseDirection: false
    },

    navigation: {
      nextEl: "#funcionalidadesHomeNext",
      prevEl: "#funcionalidadesHomePrev"
    },

    breakpoints: {
      0: {
        slidesPerView: 1,
        spaceBetween: 16
      },
      992: {
        slidesPerView: 3,
        spaceBetween: 26
      }
    },

    on: {
      init: function (swiper) {
        /*
          Esto fuerza a que al cargar arranque centrado
          en el slide del medio real, manteniendo uno
          visible a la izquierda y otro a la derecha.
        */
        if (canLoop) {
          swiper.slideToLoop(middleIndex, 0, false);
        }
      }
    }
  });

  /*
    Si por alguna razón cambiás slides manualmente
    más adelante, esto ayuda a refrescar.
  */
  window.addEventListener("resize", function () {
    if (funcionalidadesHomeSwiper) {
      funcionalidadesHomeSwiper.update();
    }
  });
}

/* =========================================
   CONTACTATE HOME
========================================= */

function cargarContactate() {
  const placeholder = document.getElementById("contactate");
  if (!placeholder) return;

  fetch(getSiteAssetUrl("components/contactate/contactate.html"))
    .then(response => responseAsUtf8Text(response))
    .then(data => {
      placeholder.innerHTML = data;

      const imagen = placeholder.querySelector(".contactate-home__image img");
      if (imagen) {
        imagen.src = getSiteAssetUrl("components/contactate/contactate.webp");
      }

      const cta = placeholder.querySelector(".contactate-home__button");
      if (cta) {
        cta.href = getSiteAssetUrl("pages/contacto.html");
      }
    })
    .catch(error => {
      console.error("Error al cargar contactate:", error);
    });
}

/* =========================================
   BOTON FLOTANTE DE WHATSAPP
========================================= */

function cargarWhatsappFloat() {
  const contenedor = document.getElementById("whatsapp-float");
  if (!contenedor) return;

  fetch(getSiteAssetUrl("components/whatsapp-float/whatsapp-float.html"))
    .then(response => responseAsUtf8Text(response))
    .then(data => {
      contenedor.innerHTML = data;

      const imagen = contenedor.querySelector("img");
      if (imagen) {
        imagen.src = getSiteAssetUrl("components/whatsapp-float/whatsapp-logo.png");
      }
    })
    .catch(error => console.error("Error cargando botón flotante de WhatsApp:", error));
}

/* =========================================
   BOTON FLOTANTE CHAT IA
========================================= */

function ensureFloatingMount_(id) {
  let mount = document.getElementById(id);
  if (mount) return mount;

  mount = document.createElement('div');
  mount.id = id;
  document.body.appendChild(mount);
  return mount;
}

function getChatBackendUrl_() {
  if (window.SM_CHAT_CONFIG && window.SM_CHAT_CONFIG.endpoint) {
    return String(window.SM_CHAT_CONFIG.endpoint).trim();
  }
  return CHAT_IA_WEBAPP_URL;
}

const CHAT_SESSION_ID_KEY = 'smarthome_chat_ia_session_id';
const CHAT_WIDGET_STATE_KEY = 'smarthome_chat_ia_widget_state_v1';
const CHAT_SESSION_MAX_AGE_MS = 45 * 60 * 1000;

function createChatSessionId_() {
  const newId = 'sess_web_' + Math.random().toString(36).slice(2, 10);

  try {
    sessionStorage.setItem(CHAT_SESSION_ID_KEY, JSON.stringify({ id: newId, createdAt: Date.now() }));
  } catch (_err) {}

  return newId;
}

function getChatSessionId_() {
  const maxAgeMs = CHAT_SESSION_MAX_AGE_MS;

  try {
    const existingRaw = sessionStorage.getItem(CHAT_SESSION_ID_KEY);
    if (existingRaw) {
      try {
        const parsed = JSON.parse(existingRaw);
        if (parsed && parsed.id && parsed.createdAt && (Date.now() - Number(parsed.createdAt) <= maxAgeMs)) {
          return String(parsed.id);
        }
      } catch (_legacyParseErr) {
        if (Date.now() - performance.timeOrigin <= maxAgeMs) {
          return existingRaw;
        }
      }
    }

    return createChatSessionId_();
  } catch (error) {
    return 'sess_web_' + Math.random().toString(36).slice(2, 10);
  }
}

function resetChatSessionId_() {
  try {
    sessionStorage.removeItem(CHAT_SESSION_ID_KEY);
  } catch (_err) {}

  return createChatSessionId_();
}

function sendChatByJsonp_(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const callbackName = '__smarthomeChatCb_' + Math.random().toString(36).slice(2, 10);
    const url = new URL(endpoint);

    url.searchParams.set('action', 'chat');
    url.searchParams.set('callback', callbackName);
    url.searchParams.set('sessionId', payload.sessionId || '');
    url.searchParams.set('message', payload.message || '');
    url.searchParams.set('sourcePage', payload.sourcePage || '');
    url.searchParams.set('userAgent', payload.userAgent || 'browser');
    url.searchParams.set('chatHistory', JSON.stringify(payload.chatHistory || []));

    let cleaned = false;

    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      delete window[callbackName];
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      clearTimeout(timer);
    }

    window[callbackName] = function (data) {
      cleanup();
      resolve(data || null);
    };

    const script = document.createElement('script');
    script.src = url.toString();
    script.async = true;
    script.onerror = function () {
      cleanup();
      reject(new Error('JSONP load error'));
    };

    const timer = setTimeout(function () {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, 12000);

    document.head.appendChild(script);
  });
}

function cargarChatIAFloat() {
  const contenedor = ensureFloatingMount_('chat-ia-float');

  fetch(getSiteAssetUrl('components/chat-ia-float/chat-ia-float.html'))
    .then(response => responseAsUtf8Text(response))
    .then(data => {
      contenedor.innerHTML = data;
      initChatIAWidget_(contenedor);
    })
    .catch(error => console.error('Error cargando chat IA flotante:', error));
}

function initChatIAWidget_(contenedor) {
  const root = contenedor.querySelector('[data-chat-ia-root]');
  if (!root || root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const toggle = root.querySelector('.chat-ia-toggle');
  const panel = root.querySelector('.chat-ia-panel');
  const minimizeBtn = root.querySelector('.chat-ia-panel__minimize');
  const closeBtn = root.querySelector('.chat-ia-panel__close');
  const form = root.querySelector('.chat-ia-form');
  const input = root.querySelector('.chat-ia-input');
  const sendBtn = root.querySelector('.chat-ia-send');
  const messages = root.querySelector('.chat-ia-messages');

  if (!toggle || !panel || !minimizeBtn || !closeBtn || !form || !input || !sendBtn || !messages) return;

  let sessionId = getChatSessionId_();
  const CHAT_WHATSAPP_URL = 'https://wa.me/5492646304866?text=Hola%20vengo%20desde%20la%20web';
  let isBusy = false;
  const conversationHistory = [];
  const renderedMessages = [];
  let typingNode = null;
  let typingTimer = null;
  let panelAnchor = { right: 0, bottom: 0 };

  function savePersistedWidgetState_() {
    try {
      const payload = {
        sessionId: sessionId,
        updatedAt: Date.now(),
        messages: renderedMessages.slice(-60),
        history: conversationHistory.slice(-12)
      };
      sessionStorage.setItem(CHAT_WIDGET_STATE_KEY, JSON.stringify(payload));
    } catch (_err) {}
  }

  function loadPersistedWidgetState_() {
    try {
      const raw = sessionStorage.getItem(CHAT_WIDGET_STATE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;

      const updatedAt = Number(parsed.updatedAt || 0);
      if (!updatedAt || (Date.now() - updatedAt > CHAT_SESSION_MAX_AGE_MS)) {
        sessionStorage.removeItem(CHAT_WIDGET_STATE_KEY);
        return null;
      }

      return parsed;
    } catch (_err) {
      return null;
    }
  }

  function clearPersistedWidgetState_() {
    try {
      sessionStorage.removeItem(CHAT_WIDGET_STATE_KEY);
    } catch (_err) {}
  }

  function pushHistory_(role, text) {
    const cleanRole = role === 'bot' ? 'bot' : 'user';
    const cleanText = String(text || '').trim();
    if (!cleanText) return;

    conversationHistory.push({
      role: cleanRole,
      text: cleanText.slice(0, 320)
    });

    if (conversationHistory.length > 12) {
      conversationHistory.splice(0, conversationHistory.length - 12);
    }
  }

  function setUserMessageStatus_(msgEl, statusText) {
    if (!msgEl) return;
    const statusEl = msgEl.querySelector('.chat-ia-msg__status');
    if (!statusEl) return;
    statusEl.textContent = statusText || '';
    savePersistedWidgetState_();
  }

  function showTypingIndicator_() {
    if (typingNode || typingTimer) return;
    typingTimer = setTimeout(function () {
      typingTimer = null;
      if (typingNode) return;
      typingNode = document.createElement('article');
      typingNode.className = 'chat-ia-msg is-bot is-typing';
      typingNode.innerHTML = '<span class="chat-ia-typing"><span></span><span></span><span></span></span> <span class="chat-ia-typing__label">Escribiendo...</span>';
      messages.appendChild(typingNode);
      messages.scrollTop = messages.scrollHeight;
    }, 450);
  }

  function hideTypingIndicator_() {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    if (!typingNode) return;
    if (typingNode.parentNode) typingNode.parentNode.removeChild(typingNode);
    typingNode = null;
  }

  function appendMessage(sender, text, trackHistory, options) {
    const msg = document.createElement('article');
    msg.className = 'chat-ia-msg is-' + sender;
    const cleanText = String(text || '').trim();

    if (sender === 'user') {
      const textEl = document.createElement('span');
      textEl.className = 'chat-ia-msg__text';
      textEl.textContent = cleanText;

      const statusEl = document.createElement('span');
      statusEl.className = 'chat-ia-msg__status';
      statusEl.textContent = (options && options.statusText) ? options.statusText : 'Enviado';

      msg.appendChild(textEl);
      msg.appendChild(statusEl);
    } else {
      msg.textContent = cleanText;
    }

    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;

    if (trackHistory !== false) {
      pushHistory_(sender, cleanText);
    }

    renderedMessages.push({
      sender: sender,
      text: cleanText
    });

    if (renderedMessages.length > 60) {
      renderedMessages.splice(0, renderedMessages.length - 60);
    }

    savePersistedWidgetState_();

    return msg;
  }

  function isFallbackMode_(data) {
    if (!data || typeof data !== 'object') return false;
    var mode = String(data.mode || '').toLowerCase();
    return !!mode && mode !== 'ia';
  }

  function appendFallbackSupportCard_() {
    const card = document.createElement('article');
    card.className = 'chat-ia-msg is-bot chat-ia-support';
    card.innerHTML = [
      '<p class="chat-ia-support__title">Si queres, seguimos por estos canales:</p>',
      '<div class="chat-ia-support__actions">',
      '  <a class="chat-ia-support__btn is-wa" href="' + CHAT_WHATSAPP_URL + '" target="_blank" rel="noopener noreferrer">WhatsApp</a>',
      '  <button type="button" class="chat-ia-support__btn is-form" data-chat-open-form>Completar formulario</button>',
      '</div>',
      '<form class="chat-ia-inline-form" data-chat-inline-form hidden novalidate>',
      '  <input type="text" name="nombreApellido" placeholder="Nombre y apellido" maxlength="80" required>',
      '  <input type="tel" name="telefono" placeholder="Telefono (10 digitos)" inputmode="numeric" maxlength="10" required>',
      '  <select name="provincia" required>',
      '    <option value="">Provincia</option>',
      '    <option value="Buenos Aires">Buenos Aires</option>',
      '    <option value="CABA">CABA</option>',
      '    <option value="Catamarca">Catamarca</option>',
      '    <option value="Chaco">Chaco</option>',
      '    <option value="Chubut">Chubut</option>',
      '    <option value="Cordoba">Cordoba</option>',
      '    <option value="Corrientes">Corrientes</option>',
      '    <option value="Entre Rios">Entre Rios</option>',
      '    <option value="Formosa">Formosa</option>',
      '    <option value="Jujuy">Jujuy</option>',
      '    <option value="La Pampa">La Pampa</option>',
      '    <option value="La Rioja">La Rioja</option>',
      '    <option value="Mendoza">Mendoza</option>',
      '    <option value="Misiones">Misiones</option>',
      '    <option value="Neuquen">Neuquen</option>',
      '    <option value="Rio Negro">Rio Negro</option>',
      '    <option value="Salta">Salta</option>',
      '    <option value="San Juan">San Juan</option>',
      '    <option value="San Luis">San Luis</option>',
      '    <option value="Santa Cruz">Santa Cruz</option>',
      '    <option value="Santa Fe">Santa Fe</option>',
      '    <option value="Santiago del Estero">Santiago del Estero</option>',
      '    <option value="Tierra del Fuego">Tierra del Fuego</option>',
      '    <option value="Tucuman">Tucuman</option>',
      '  </select>',
      '  <input type="email" name="mail" placeholder="Email" maxlength="120" required>',
      '  <button type="submit" class="chat-ia-support__btn is-submit">Enviar formulario</button>',
      '  <p class="chat-ia-inline-form__msg" data-chat-inline-form-msg></p>',
      '</form>'
    ].join('');

    const openFormBtn = card.querySelector('[data-chat-open-form]');
    const inlineForm = card.querySelector('[data-chat-inline-form]');
    const inlineMsg = card.querySelector('[data-chat-inline-form-msg]');

    function showInlineMsg(text, type) {
      if (!inlineMsg) return;
      inlineMsg.textContent = String(text || '');
      inlineMsg.classList.remove('is-error', 'is-success');
      if (type) inlineMsg.classList.add(type);
    }

    function emailIsValid_(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
    }

    function digits_(value) {
      return String(value || '').replace(/\D/g, '');
    }

    if (openFormBtn && inlineForm) {
      openFormBtn.addEventListener('click', function () {
        inlineForm.hidden = !inlineForm.hidden;
        if (!inlineForm.hidden) {
          const first = inlineForm.querySelector('input[name="nombreApellido"]');
          if (first) first.focus();
        }
      });
    }

    if (inlineForm) {
      const phoneInput = inlineForm.querySelector('input[name="telefono"]');
      if (phoneInput) {
        phoneInput.addEventListener('input', function () {
          this.value = digits_(this.value).slice(0, 10);
        });
      }

      inlineForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        showInlineMsg('', '');

        const formData = new FormData(inlineForm);
        const nombreApellido = String(formData.get('nombreApellido') || '').trim();
        const telefono = digits_(formData.get('telefono')).slice(0, 10);
        const provincia = String(formData.get('provincia') || '').trim();
        const mail = String(formData.get('mail') || '').trim();

        if (nombreApellido.length < 3) {
          showInlineMsg('Ingresa nombre y apellido validos.', 'is-error');
          return;
        }
        if (telefono.length !== 10) {
          showInlineMsg('Ingresa 10 digitos de telefono, sin 0 y sin 15.', 'is-error');
          return;
        }
        if (!provincia) {
          showInlineMsg('Selecciona una provincia.', 'is-error');
          return;
        }
        if (!emailIsValid_(mail)) {
          showInlineMsg('Ingresa un email valido.', 'is-error');
          return;
        }

        const submitBtn = inlineForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Enviando...';
        }

        const payload = {
          nombreApellido: nombreApellido,
          telefono: telefono,
          provincia: provincia,
          mail: mail,
          website: '',
          tiempoSegundos: 10,
          pagina: 'chat_ia_fallback',
          url: window.location.href,
          userAgent: navigator.userAgent
        };

        try {
          const response = await fetch(SHARED_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          });

          const result = await response.json();
          if (result && result.ok) {
            showInlineMsg('Formulario enviado. Te contactamos a la brevedad.', 'is-success');
            inlineForm.reset();
          } else {
            showInlineMsg('No se pudo enviar el formulario. Intenta nuevamente.', 'is-error');
          }
        } catch (_formErr) {
          showInlineMsg('Error de conexion al enviar formulario. Intenta nuevamente.', 'is-error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar formulario';
          }
        }
      });
    }

    messages.appendChild(card);
    messages.scrollTop = messages.scrollHeight;
  }

  function updatePanelAnchorFromRoot_() {
    const rect = root.getBoundingClientRect();
    panelAnchor.right = Math.max(0, Math.round(window.innerWidth - rect.right));
    panelAnchor.bottom = Math.max(0, Math.round(window.innerHeight - rect.bottom));
  }

  function placePanelFromAnchor_() {
    panel.style.right = panelAnchor.right + 'px';
    panel.style.bottom = panelAnchor.bottom + 'px';
  }

  function shouldAutoFocusInput_() {
    // En mobile evitamos abrir teclado automaticamente al desplegar el panel.
    return !window.matchMedia('(max-width: 767.98px)').matches;
  }

  function restoreWidgetState_() {
    const persisted = loadPersistedWidgetState_();
    if (!persisted) return;

    if (persisted.sessionId) {
      sessionId = String(persisted.sessionId);
    }

    const restoredHistory = Array.isArray(persisted.history) ? persisted.history : [];
    const restoredMessages = Array.isArray(persisted.messages) ? persisted.messages : [];

    conversationHistory.splice(0, conversationHistory.length);
    renderedMessages.splice(0, renderedMessages.length);

    restoredHistory.forEach(function (item) {
      if (!item || (item.role !== 'user' && item.role !== 'bot')) return;
      const text = String(item.text || '').trim();
      if (!text) return;
      conversationHistory.push({ role: item.role, text: text.slice(0, 320) });
    });

    restoredMessages.forEach(function (item) {
      if (!item || (item.sender !== 'user' && item.sender !== 'bot')) return;
      const text = String(item.text || '').trim();
      if (!text) return;
      appendMessage(item.sender, text, false);
    });
  }

  function hardResetChat_() {
    hideTypingIndicator_();
    setBusyState(false);

    messages.innerHTML = '';
    input.value = '';

    conversationHistory.splice(0, conversationHistory.length);
    renderedMessages.splice(0, renderedMessages.length);

    clearPersistedWidgetState_();
    sessionId = resetChatSessionId_();
    setOpenState(false);
  }

  function setOpenState(isOpen) {
    if (isOpen) {
      updatePanelAnchorFromRoot_();
      placePanelFromAnchor_();
    }

    panel.hidden = !isOpen;
    root.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

    if (!isOpen) {
      panel.style.right = '';
      panel.style.bottom = '';
    }

    if (isOpen && shouldAutoFocusInput_()) {
      setTimeout(() => input.focus(), 30);
    }
  }

  function setBusyState(nextBusy) {
    isBusy = nextBusy;
    form.classList.toggle('is-loading', nextBusy);
    input.disabled = nextBusy;
    sendBtn.disabled = nextBusy;
  }

  toggle.addEventListener('click', function () {
    const next = panel.hidden;
    setOpenState(next);
  });

  minimizeBtn.addEventListener('click', function () {
    setOpenState(false);
  });

  closeBtn.addEventListener('click', function () {
    hardResetChat_();
  });

  window.addEventListener('resize', function () {
    if (panel.hidden) return;
    updatePanelAnchorFromRoot_();
    placePanelFromAnchor_();
  });

  restoreWidgetState_();

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    if (isBusy) return;

    const userText = String(input.value || '').trim();
    if (!userText) return;

    const userMsgEl = appendMessage('user', userText, true, { statusText: 'Enviando...' });
    input.value = '';
    setBusyState(true);

    const endpoint = getChatBackendUrl_();
    if (!endpoint) {
      hideTypingIndicator_();
      setUserMessageStatus_(userMsgEl, 'No entregado');
      appendMessage('bot', 'El chat aun no esta conectado. Si quieres, escribinos por WhatsApp y te respondemos ahora.');
      setBusyState(false);
      return;
    }

    try {
      const payload = {
        sessionId: sessionId,
        message: userText,
        sourcePage: window.location.pathname || '/',
        userAgent: navigator.userAgent || 'browser',
        chatHistory: conversationHistory.slice(-10)
      };

      let data = null;

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        setUserMessageStatus_(userMsgEl, '✓ Enviado');
        showTypingIndicator_();

        const bodyText = await res.text();

        try {
          data = JSON.parse(bodyText);
        } catch (error) {
          data = null;
        }

        if (!res.ok && !data) {
          throw new Error('HTTP ' + res.status);
        }
      } catch (_postError) {
        setUserMessageStatus_(userMsgEl, '✓ Enviado');
        showTypingIndicator_();
        data = await sendChatByJsonp_(endpoint, payload);
      }

      hideTypingIndicator_();
      const hasBackendMessage = !!(data && (data.reply || data.message));
      if (!data) {
        setUserMessageStatus_(userMsgEl, 'No entregado');
        appendMessage('bot', 'No pude responder en este momento. Intentalo nuevamente en unos segundos.');
        appendFallbackSupportCard_();
      } else if (hasBackendMessage) {
        setUserMessageStatus_(userMsgEl, '✓✓ Leido');
        appendMessage('bot', data.reply || data.message);
        if (isFallbackMode_(data)) {
          appendFallbackSupportCard_();
        }
      } else if (data.ok === true) {
        setUserMessageStatus_(userMsgEl, '✓✓ Leido');
        appendMessage('bot', data.reply || 'Te leo. Si quieres, puedo ayudarte a cotizar ahora.');
      } else {
        setUserMessageStatus_(userMsgEl, 'No entregado');
        appendMessage('bot', 'No pude responder en este momento. Intentalo nuevamente en unos segundos.');
        appendFallbackSupportCard_();
      }
    } catch (error) {
      hideTypingIndicator_();
      setUserMessageStatus_(userMsgEl, 'No entregado');
      appendMessage('bot', 'En este momento no hay operador disponible para atencion. Comunicate por WhatsApp o completa el formulario y te contactamos a la brevedad.');
      appendFallbackSupportCard_();
      console.error('Error enviando mensaje al chat IA:', error);
    } finally {
      hideTypingIndicator_();
      setBusyState(false);
      input.focus();
    }
  });
}


/* =========================================
   Inicializar dropdowns del header para dispositivos táctiles
   - Detecta dispositivos touch y agrega click handlers que
     hacen toggle de la clase `is-open` en `.como-dropdown`.
   - Cierra dropdowns al tocar fuera.
========================================= */
function initHeaderDropdownTouch() {
  try {
    // Activar en touch o en anchos móviles (para asegurar funcionamiento en tablets/emulación táctil)
    const shouldInit = ('ontouchstart' in window) || window.innerWidth < 992 || window.matchMedia('(hover: none)').matches;
    if (!shouldInit) return;

    const dropdowns = document.querySelectorAll('.como-dropdown');

    dropdowns.forEach(drop => {
      const toggle = drop.querySelector('.como-link');
      if (!toggle) return;

      const setExpanded = (value) => {
        toggle.setAttribute('aria-expanded', value ? 'true' : 'false');
      };

      setExpanded(drop.classList.contains('is-open'));

      if (toggle.dataset.touchInit === 'true') return;
      toggle.dataset.touchInit = 'true';

      const handler = function (e) {
        // Evitar navegación si el link es sólo para abrir el menú
        const href = this.getAttribute('href') || '';
        if (href === '#' || href.startsWith('#')) {
          e.preventDefault();
        }

        // Evitar que otros manejadores cierren inmediatamente
        if (e.stopPropagation) e.stopPropagation();

        // Toggle del estado abierto
        const isOpen = drop.classList.contains('is-open');

        // Cerrar otros abiertos
        document.querySelectorAll('.como-dropdown.is-open').forEach(d => {
          if (d !== drop) {
            d.classList.remove('is-open');
            const otherToggle = d.querySelector('.como-link');
            if (otherToggle) otherToggle.setAttribute('aria-expanded', 'false');
          }
        });

        if (isOpen) {
          drop.classList.remove('is-open');
          setExpanded(false);
        } else {
          drop.classList.add('is-open');
          setExpanded(true);
        }
      };

      toggle.addEventListener('click', handler, false);

      toggle.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.click();
          return;
        }

        if (e.key === 'Escape') {
          drop.classList.remove('is-open');
          setExpanded(false);
        }
      }, false);
    });

    // Cerrar al tocar fuera
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.como-dropdown')) return;
      document.querySelectorAll('.como-dropdown.is-open').forEach(d => {
        d.classList.remove('is-open');
        const toggle = d.querySelector('.como-link');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    }, false);

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('.como-dropdown.is-open').forEach(d => {
        d.classList.remove('is-open');
        const toggle = d.querySelector('.como-link');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    }, false);

  } catch (err) {
    // Si algo falla, no bloquear el sitio
    console.error('initHeaderDropdownTouch error:', err);
  }
}


/* =========================================
   Auto-close del menú mobile/tablet
   - Cierra el collapse `#menuPrincipal` cuando está abierto
     al tocar fuera, al hacer scroll o al hacer touchmove.
   - Usa la API de Bootstrap si está disponible.
========================================= */
function initMobileMenuAutoClose() {
  try {
    const menu = document.getElementById('menuPrincipal');
    if (!menu) return;

    // evitar inicializar varias veces
    if (menu.dataset.autoCloseInit === 'true') return;
    menu.dataset.autoCloseInit = 'true';

    const isOpen = () => menu.classList.contains('show');

    const smoothClose = (el) => {
      if (!el || !el.classList.contains('show')) return;

      // evitar reentradas
      if (el.dataset.animating === 'true') return;
      el.dataset.animating = 'true';

      // altura actual del contenido
      const height = el.scrollHeight;

      // preparar la animación
      el.style.maxHeight = height + 'px';
      el.style.overflow = 'hidden';
      // forzar reflow
      // eslint-disable-next-line no-unused-expressions
      el.offsetHeight;

      el.style.transition = 'max-height 260ms ease';
      requestAnimationFrame(() => {
        el.style.maxHeight = '0px';
      });

      let cleanup = () => {
        el.classList.remove('show');
        el.style.transition = '';
        el.style.maxHeight = '';
        el.style.overflow = '';
        el.removeEventListener('transitionend', onEnd);
        el.dataset.animating = 'false';

        // actualizar togglers
        document.querySelectorAll('.navbar-toggler').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
      };

      const onEnd = (ev) => {
        if (ev.propertyName === 'max-height') cleanup();
      };

      el.addEventListener('transitionend', onEnd);
      // Fallback: si transitionend no se dispara, limpiar después de 600ms
      const fallbackTimer = setTimeout(() => {
        try { cleanup(); } catch (e) { /* silent */ }
      }, 600);
      const origCleanup = cleanup;
      cleanup = function () {
        clearTimeout(fallbackTimer);
        origCleanup();
      };
    };
    const closeMenu = () => {
      try {
        // Preferir usar la API de Bootstrap (si existe) para cerrar correctamente y mantener estado interno
        if (window.bootstrap && typeof window.bootstrap.Collapse === 'function') {
          const inst = window.bootstrap.Collapse.getOrCreateInstance(menu, { toggle: false });
          if (inst && typeof inst.hide === 'function') {
            inst.hide();
            return;
          }
        }

        // Soporte para Bootstrap 4 con jQuery
        if (typeof jQuery !== 'undefined' && typeof jQuery.fn.collapse === 'function') {
          try {
            jQuery(menu).collapse('hide');
            return;
          } catch (e) { /* fallback abajo */ }
        }

        // Fallback: animación manual y limpieza garantizada
        smoothClose(menu);
      } catch (err) {
        console.error('closeMenu error:', err);
      }
    };

    // Click fuera del menú
    document.addEventListener('click', function (e) {
      if (!isOpen()) return;
      if (e.target.closest && (e.target.closest('#menuPrincipal') || e.target.closest('.navbar-toggler'))) return;
      closeMenu();
    }, false);

    // Detectar scroll / gestures que indican intención de interacción fuera.
    // Si el evento ocurre dentro del menú o en el botón toggler, no cerrar.
    const closeOnScrollOrTouch = (e) => {
      if (!isOpen()) return;

      const target = e && e.target;
      if (target && target.closest && (target.closest('#menuPrincipal') || target.closest('.navbar-toggler'))) {
        return;
      }

      closeMenu();
    };

    window.addEventListener('scroll', closeOnScrollOrTouch, { passive: true });
    window.addEventListener('wheel', closeOnScrollOrTouch, { passive: true });
    window.addEventListener('touchstart', closeOnScrollOrTouch, { passive: true });
    window.addEventListener('touchmove', closeOnScrollOrTouch, { passive: true });

  } catch (err) {
    console.error('initMobileMenuAutoClose error:', err);
  }
}

/* =========================================
   CARGA SECCION ZONAS PROTECCION HOGAR
========================================= */
async function cargarZonasProteccionHogar() {
  const container = document.getElementById("zonas-proteccion-hogar");
  if (!container) return;

  try {
    const response = await fetch(getSiteAssetUrl("components/zonas-proteccion-hogar/zonas-proteccion-hogar.html"));

    if (!response.ok) {
      throw new Error("No se pudo cargar el componente zonas-proteccion-hogar/zonas-proteccion-hogar.html");
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;

    initZonasProteccionHogar();
  } catch (error) {
    console.error("Error al cargar la sección zonas-proteccion-hogar:", error);
  }
}

/* =========================================
   CARGA SECCION ZONAS PROTECCION COMERCIO
========================================= */
async function cargarZonasProteccionComercio() {
  const container = document.getElementById("zonas-proteccion-comercio");
  if (!container) return;

  try {
    const response = await fetch(getSiteAssetUrl("components/zonas-proteccion-comercio/zonas-proteccion-comercio.html"));

    if (!response.ok) {
      throw new Error("No se pudo cargar el componente zonas-proteccion-comercio/zonas-proteccion-comercio.html");
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;

    initZonasProteccionHogar({
      root: container,
      componentFolder: "zonas-proteccion-comercio"
    });
  } catch (error) {
    console.error("Error al cargar la sección zonas-proteccion-comercio:", error);
  }
}

/* =========================================================
   INICIALIZAR SECCION: ZONAS DE PROTECCION

   La logica es compartida entre hogar y comercio.
   El contenido se lee desde un bloque JSON embebido dentro del
   componente HTML para que textos, imagenes, tabs, beneficios e
   iconos flotantes se puedan editar sin tocar este archivo.

   Cada item admite:
   - title / description / image / alt
   - icon (Bootstrap Icons)
   - marker.x / marker.y para ubicar el circulo celeste
   - highlights para completar el panel lateral
   ========================================================= */

function initZonasProteccionHogar(options = {}) {
  const root = options.root || document;
  const section = root.querySelector(".zonas-proteccion-hogar, .zonas-proteccion-comercio");
  if (!section) return;

  const configNode = section.querySelector(".zonas-proteccion-hogar__config");
  if (!configNode) {
    console.error("Zonas Proteccion: falta el bloque de configuracion JSON");
    return;
  }

  let componentConfig;

  try {
    componentConfig = JSON.parse(configNode.textContent);
  } catch (error) {
    console.error("Zonas Proteccion: no se pudo interpretar la configuracion JSON", error);
    return;
  }

  const componentFolder = options.componentFolder || componentConfig.componentFolder || "zonas-proteccion-hogar";
  const mainSceneImage = options.mainSceneImage || componentConfig.mainSceneImage || "";
  const tabsConfig = Array.isArray(componentConfig.tabs) ? componentConfig.tabs : [];

  if (!tabsConfig.length) {
    console.error("Zonas Proteccion: la configuracion no tiene tabs");
    return;
  }

  const imageBasePath = getSiteAssetUrl("assets/img/");
  const componentImageBasePath = getSiteAssetUrl(`components/${componentFolder}/`);
  const getImagePath = (fileName, preferComponent = false) => {
    if (!fileName) return "";
    return preferComponent ? componentImageBasePath + fileName : imageBasePath + fileName;
  };

  const normalizeProductImageFrame = (imgElement) => {
    if (!imgElement || !imgElement.classList.contains("zonas-proteccion-hogar__product-image")) return;

    const width = Number(imgElement.naturalWidth || 0);
    const height = Number(imgElement.naturalHeight || 0);
    if (!width || !height) return;

    const ratio = width / height;
    let targetWidth = "82%";
    let targetHeight = "82%";

    if (ratio >= 1.7) {
      targetWidth = "96%";
      targetHeight = "70%";
    } else if (ratio >= 1.3) {
      targetWidth = "92%";
      targetHeight = "76%";
    } else if (ratio <= 0.72) {
      targetWidth = "62%";
      targetHeight = "94%";
    } else if (ratio <= 0.9) {
      targetWidth = "70%";
      targetHeight = "90%";
    } else {
      targetWidth = "82%";
      targetHeight = "82%";
    }

    imgElement.style.setProperty("--zonas-product-image-width", targetWidth);
    imgElement.style.setProperty("--zonas-product-image-height", targetHeight);
  };

  const setImageSourceWithFallback = (imgElement, fileName, preferComponent = false) => {
    if (!imgElement || !fileName) return;

    const primarySrc = getImagePath(fileName, preferComponent);
    const fallbackSrc = preferComponent
      ? imageBasePath + fileName
      : componentImageBasePath + fileName;

    imgElement.onerror = function () {
      if (imgElement.dataset.fallbackApplied === "true") return;
      imgElement.dataset.fallbackApplied = "true";
      imgElement.src = fallbackSrc;
    };

    imgElement.onload = function () {
      normalizeProductImageFrame(imgElement);
    };

    imgElement.dataset.fallbackApplied = "false";
    imgElement.src = primarySrc;
  };

  const titleMain = section.querySelector("[data-title-main]");
  const titleAccent = section.querySelector("[data-title-accent]");
  const lead = section.querySelector(".zonas-proteccion-hogar__lead");
  const tabsContainer = section.querySelector(".zonas-proteccion-hogar__tabs");
  const imageWrap = section.querySelector(".zonas-proteccion-hogar__image-wrap");
  const panel = section.querySelector(".zonas-proteccion-hogar__panel");
  const panelText = section.querySelector(".zonas-proteccion-hogar__panel-text");
  const panelKicker = section.querySelector(".zonas-proteccion-hogar__panel-kicker");
  const panelTitle = section.querySelector(".zonas-proteccion-hogar__panel-title");
  const panelDescription = section.querySelector(".zonas-proteccion-hogar__panel-description");
  const panelPoints = section.querySelector(".zonas-proteccion-hogar__panel-points");
  const productImage = section.querySelector(".zonas-proteccion-hogar__product-image");
  const mainImage = section.querySelector(".zonas-proteccion-hogar__main-image");
  const benefitsSection = section.querySelector(".zonas-proteccion-hogar__benefits");
  const ctaLink = section.querySelector(".zonas-proteccion-hogar__cta .btn-principal");
  const prevButton = section.querySelector(".zonas-proteccion-hogar__arrow--prev");
  const nextButton = section.querySelector(".zonas-proteccion-hogar__arrow--next");
  const closeButton = section.querySelector(".zonas-proteccion-hogar__panel-close");

  if (
    !tabsContainer ||
    !imageWrap ||
    !panel ||
    !panelText ||
    !panelTitle ||
    !panelDescription ||
    !productImage ||
    !mainImage ||
    !prevButton ||
    !nextButton
  ) {
    console.error("Zonas Proteccion: faltan elementos DOM requeridos");
    return;
  }

  const hasHtmlText = (element) => {
    if (!element) return false;
    return element.textContent.trim().length > 0;
  };

  if (titleMain && !hasHtmlText(titleMain)) titleMain.textContent = componentConfig.title || "";
  if (titleAccent && !hasHtmlText(titleAccent)) titleAccent.textContent = componentConfig.titleAccent || "";
  if (lead && !hasHtmlText(lead)) lead.textContent = componentConfig.lead || "";
  tabsContainer.setAttribute("aria-label", componentConfig.tabsAriaLabel || "Zonas de proteccion");

  if (mainImage) {
    setImageSourceWithFallback(mainImage, mainSceneImage, true);
    mainImage.alt = componentConfig.mainSceneAlt || "Escena principal de la seccion";
  }

  tabsContainer.innerHTML = tabsConfig.map((tab, index) => `
    <button
      class="zonas-proteccion-hogar__tab${index === 0 ? " is-active" : ""}"
      type="button"
      data-tab="${tab.id}"
      role="tab"
      aria-selected="${index === 0 ? "true" : "false"}"
      aria-controls="${panel.id || ""}">
      ${tab.label}
    </button>
  `).join("");

  const maxMarkers = Math.max(...tabsConfig.map((tab) => (Array.isArray(tab.items) ? tab.items.length : 0)), 0);
  imageWrap.querySelectorAll(".zonas-proteccion-hogar__marker").forEach((marker) => marker.remove());

  for (let index = 0; index < maxMarkers; index += 1) {
    const marker = document.createElement("button");
    marker.className = `zonas-proteccion-hogar__marker${index === 0 ? " is-active" : ""}`;
    marker.type = "button";
    marker.dataset.slide = `${index}`;
    marker.setAttribute("aria-label", `Ver punto ${index + 1}`);
    imageWrap.appendChild(marker);
  }

  if (benefitsSection) {
    const benefits = Array.isArray(componentConfig.benefits) ? componentConfig.benefits : [];
    benefitsSection.innerHTML = benefits.map((benefit) => `
      <article class="zonas-proteccion-hogar__benefit">
        <div class="zonas-proteccion-hogar__benefit-icon">
          <i class="bi bi-${benefit.icon || "shield-check"}" aria-hidden="true"></i>
        </div>
        <p>
          <strong>${benefit.title || ""}:</strong> ${benefit.description || ""}
        </p>
      </article>
    `).join("");
  }

  if (ctaLink && componentConfig.cta) {
    ctaLink.textContent = componentConfig.cta.label || ctaLink.textContent;
    ctaLink.setAttribute("href", componentConfig.cta.href || "#cotizar");
  }

  const tabs = Array.from(section.querySelectorAll(".zonas-proteccion-hogar__tab"));
  const markers = Array.from(section.querySelectorAll(".zonas-proteccion-hogar__marker"));
  const sectionData = Object.fromEntries(tabsConfig.map((tab) => [tab.id, Array.isArray(tab.items) ? tab.items : []]));
  const tabLabelMap = new Map(tabsConfig.map((tab) => [tab.id, tab.label]));
  const normalizeCoordinate = (value) => {
    if (typeof value === "number") return `${value}%`;
    if (typeof value === "string") return value;
    return "50%";
  };

  let activeTab = tabsConfig[0].id;
  let activeIndex = 0;
  let panelUpdateTimer = null;
  let hasRenderedOnce = false;

  const isMobileViewport = () => window.matchMedia("(max-width: 991.98px)").matches;
  const shouldSyncPanelTextHeight = () => window.matchMedia("(min-width: 992px)").matches;

  const clampIndex = (index, total) => {
    if (!total) return 0;
    return ((index % total) + total) % total;
  };

  const openPanel = () => {
    panel.classList.remove("is-collapsed");
    panel.setAttribute("aria-hidden", "false");
    if (benefitsSection) {
      benefitsSection.classList.remove("benefits-collapsed");
    }
  };

  const closePanel = () => {
    if (!isMobileViewport()) return;
    panel.classList.add("is-collapsed");
    panel.setAttribute("aria-hidden", "true");
    if (benefitsSection) {
      benefitsSection.classList.add("benefits-collapsed");
    }
  };

  const getActiveItems = () => sectionData[activeTab] || [];

  const setPanelContent = (item) => {
    if (panelKicker) {
      panelKicker.textContent = tabLabelMap.get(activeTab) || "Detalle";
    }

    panelTitle.textContent = item.title || "";
    panelDescription.textContent = item.description || "";
    setImageSourceWithFallback(productImage, item.image, true);
    productImage.alt = item.alt || item.title || "";

    if (panelPoints) {
      const highlights = Array.isArray(item.highlights) ? item.highlights : [];
      panelPoints.innerHTML = highlights.map((point) => `<li>${point}</li>`).join("");
      panelPoints.hidden = !highlights.length;
    }
  };

  const runPanelTransition = (callback) => {
    if (!hasRenderedOnce) {
      callback();
      return;
    }

    if (panelUpdateTimer) {
      window.clearTimeout(panelUpdateTimer);
    }

    panel.classList.add("is-updating");

    panelUpdateTimer = window.setTimeout(() => {
      callback();
      requestAnimationFrame(() => {
        panel.classList.remove("is-updating");
      });
    }, 140);
  };

  const syncPanelTextHeight = () => {
    if (!shouldSyncPanelTextHeight()) {
      panelText.style.minHeight = "0";
      return;
    }

    const allItems = tabsConfig.flatMap((tab) => Array.isArray(tab.items) ? tab.items : []);
    if (!allItems.length) return;

    const measurement = panelText.cloneNode(true);
    const measurementPoints = measurement.querySelector(".zonas-proteccion-hogar__panel-points");
    const measurementKicker = measurement.querySelector(".zonas-proteccion-hogar__panel-kicker");
    const measurementTitle = measurement.querySelector(".zonas-proteccion-hogar__panel-title");
    const measurementDescription = measurement.querySelector(".zonas-proteccion-hogar__panel-description");

    measurement.style.position = "absolute";
    measurement.style.visibility = "hidden";
    measurement.style.pointerEvents = "none";
    measurement.style.left = "-9999px";
    measurement.style.top = "0";
    measurement.style.width = `${panelText.getBoundingClientRect().width || panel.getBoundingClientRect().width}px`;
    measurement.style.minHeight = "0";
    measurement.style.height = "auto";

    section.appendChild(measurement);

    let maxHeight = 0;

    allItems.forEach((item) => {
      if (measurementKicker) {
        measurementKicker.textContent = tabLabelMap.get(
          tabsConfig.find((tab) => (tab.items || []).includes(item))?.id || activeTab
        ) || "Detalle";
      }

      if (measurementTitle) measurementTitle.textContent = item.title || "";
      if (measurementDescription) measurementDescription.textContent = item.description || "";

      if (measurementPoints) {
        const highlights = Array.isArray(item.highlights) ? item.highlights : [];
        measurementPoints.innerHTML = highlights.map((point) => `<li>${point}</li>`).join("");
        measurementPoints.hidden = !highlights.length;
      }

      maxHeight = Math.max(maxHeight, measurement.offsetHeight);
    });

    section.removeChild(measurement);
    panelText.style.minHeight = `${Math.ceil(maxHeight)}px`;
  };

  function render() {
    const items = getActiveItems();
    if (!items.length) return;

    activeIndex = clampIndex(activeIndex, items.length);
    const currentItem = items[activeIndex];

    tabs.forEach((tab) => {
      const isActive = tab.dataset.tab === activeTab;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    markers.forEach((marker, index) => {
      const markerItem = items[index];

      if (!markerItem) {
        marker.style.display = "none";
        marker.classList.remove("is-active");
        marker.removeAttribute("aria-current");
        return;
      }

      marker.style.display = "inline-flex";
      marker.style.top = normalizeCoordinate(markerItem.marker?.y ?? markerItem.marker?.top);
      marker.style.left = normalizeCoordinate(markerItem.marker?.x ?? markerItem.marker?.left);
      marker.innerHTML = `<i class="bi bi-${markerItem.icon || "shield-check"}" aria-hidden="true"></i>`;
      marker.setAttribute("aria-label", markerItem.title || `Ver punto ${index + 1}`);
      marker.setAttribute("title", markerItem.title || "");
      marker.classList.toggle("is-active", index === activeIndex);

      if (index === activeIndex) {
        marker.setAttribute("aria-current", "true");
      } else {
        marker.removeAttribute("aria-current");
      }
    });

    runPanelTransition(() => {
      setPanelContent(currentItem);
    });

    hasRenderedOnce = true;
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      const nextTab = this.dataset.tab;
      if (!nextTab || nextTab === activeTab) return;

      activeTab = nextTab;
      activeIndex = 0;
      openPanel();
      render();
    });
  });

  markers.forEach((marker, index) => {
    marker.addEventListener("click", function () {
      const total = getActiveItems().length;
      if (index >= total) return;

      activeIndex = index;
      openPanel();
      render();
    });
  });

  prevButton.addEventListener("click", function () {
    activeIndex -= 1;
    openPanel();
    render();
  });

  nextButton.addEventListener("click", function () {
    activeIndex += 1;
    openPanel();
    render();
  });

  if (closeButton) {
    closeButton.addEventListener("click", closePanel);
  }

  window.addEventListener("resize", function () {
    if (!isMobileViewport()) {
      openPanel();
    }
    syncPanelTextHeight();
  });

  panel.setAttribute("aria-hidden", "false");
  syncPanelTextHeight();
  render();
}

/* =========================================================
   CARGAR SECCIÓN: CARACTERÍSTICAS DEL PANEL
   ========================================================= */

async function cargarCaracteristicasPanel() {
  const container = document.getElementById("caracteristicas-panel");
  if (!container) return;

  try {
    const response = await fetch(getSiteAssetUrl("components/caracteristicas-panel/caracteristicas-panel.html"));

    if (!response.ok) {
      throw new Error("No se pudo cargar el componente caracteristicas-panel.html");
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;

    const panelImage = container.querySelector(".caracteristicas-panel__image");
    if (panelImage) {
      panelImage.src = getSiteAssetUrl("components/caracteristicas-panel/panel-inteligente.png");
    }

    initCaracteristicasPanel();
  } catch (error) {
    console.error("Error al cargar la sección características del panel:", error);
  }
}
/* =========================================================
   CARGAR SECCION: COMPARACION CARACTERISTICAS PLANES
   ========================================================= */

async function cargarComparacionCaracteristicasPlanes() {
  const container = document.getElementById("comparacion-caracteristicas-planes");
  if (!container) return;

  try {
    const response = await fetch(getSiteAssetUrl("components/comparacion-caracteristicas-planes/comparacion-caracteristicas-planes.html"));

    if (!response.ok) {
      throw new Error("No se pudo cargar el componente comparacion-caracteristicas-planes.html");
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;

    const imageBase = getSiteAssetUrl("components/comparacion-caracteristicas-planes/");
    container
      .querySelectorAll(".comparacion-caracteristicas-planes__plan-image[data-image]")
      .forEach((img) => {
        img.src = imageBase + img.dataset.image;
      });

    container.querySelectorAll("a[href]").forEach((link) => {
      const href = (link.getAttribute("href") || "").trim();
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      link.href = getSiteAssetUrl(href);
    });
  } catch (error) {
    console.error("Error al cargar la seccion comparacion-caracteristicas-planes:", error);
  }
}

/* =========================================================
   CARGAR SECCION: CENTRAL MONITOREO 24/7
   ========================================================= */

async function cargarCentralMonitoreo247() {
  const container = document.getElementById("central-monitoreo-24-7");
  if (!container) return;

  try {
    const response = await fetch(getSiteAssetUrl("components/central-monitoreo-24-7/central-monitoreo-24-7.html"));

    if (!response.ok) {
      throw new Error("No se pudo cargar el componente central-monitoreo-24-7.html");
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;

    const image = container.querySelector(".central-monitoreo-24-7__image");
    if (image) {
      image.src = getSiteAssetUrl("components/central-monitoreo-24-7/guardia-monitoreo.jpg");
    }
  } catch (error) {
    console.error("Error al cargar la seccion central-monitoreo-24-7:", error);
  }
}

/* =========================================================
   CARGAR SECCION: SERVICIOS PARA COMERCIOS
   ========================================================= */

async function cargarServiciosParaComercios() {
  const container = document.getElementById("servicios-para-comercios");
  if (!container) return;

  try {
    const response = await fetch(getSiteAssetUrl("components/servicios-para-comercios/servicios-para-comercios.html"));

    if (!response.ok) {
      throw new Error("No se pudo cargar el componente servicios-para-comercios.html");
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;

    const image = container.querySelector("img[data-image]");
    if (image) {
      image.src = getSiteAssetUrl("components/servicios-para-comercios/servicios-para-comercios.png");
    }

    initServiciosParaComercios(container);
  } catch (error) {
    console.error("Error al cargar la seccion servicios-para-comercios:", error);
  }
}

function initServiciosParaComercios(rootElement) {
  const section = rootElement.querySelector(".servicios-para-comercios");
  if (!section) return;

  const titleEl = section.querySelector(".servicios-para-comercios__title");
  const descriptionEl = section.querySelector(".servicios-para-comercios__description");
  const prevButton = section.querySelector(".servicios-para-comercios__arrow--prev");
  const nextButton = section.querySelector(".servicios-para-comercios__arrow--next");

  if (!titleEl || !descriptionEl || !prevButton || !nextButton) return;

  const slides = [
    {
      title: "Monitoreo 24/7 para tu negocio",
      description: "Tu sistema de alarma queda conectado a nuestra central de monitoreo las 24 horas, todos los días. Ante una alerta real, se activa el protocolo con aviso a las fuerzas de seguridad."
    },
    {
      title: "Aviso de apertura fuera de horario",
      description: "Recibí notificaciones cuando alguien desactive la alarma de tu comercio en horarios no autorizados, para tener control total de quién abre y cuándo."
    },
    {
      title: "Control remoto desde la app",
      description: "Armá y desarmá tu sistema de alarma, consultá el historial de eventos y gestioná usuarios desde tu celular, estés donde estés."
    },
    {
      title: "Protección perimetral exterior",
      description: "Sensores de doble tecnología para exteriores que detectan intrusos antes de que ingresen a tu comercio, más sirena exterior disuasiva."
    },
    {
      title: "Códigos de usuario para cada empleado",
      description: "Asigná códigos personalizados a tus colaboradores para saber quién abre y cierra tu negocio en cada turno y llevar registro de accesos."
    }
  ];

  let index = 2;

  const render = () => {
    const item = slides[index];
    titleEl.textContent = item.title;
    descriptionEl.textContent = item.description;
  };

  prevButton.addEventListener("click", () => {
    index = (index - 1 + slides.length) % slides.length;
    render();
  });

  nextButton.addEventListener("click", () => {
    index = (index + 1) % slides.length;
    render();
  });

  render();
}

/* =========================================================
   CARGAR SECCION: APP
   ========================================================= */

async function cargarApp() {
  const container = document.getElementById("app");
  if (!container) return;

  try {
    const response = await fetch(getSiteAssetUrl("components/app/app.html"));

    if (!response.ok) {
      throw new Error("No se pudo cargar el componente app.html");
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;

    const imageBase = getSiteAssetUrl("components/app/");

    container.querySelectorAll("img[data-image]").forEach((img) => {
      const file = img.dataset.image;
      if (!file) return;
      img.src = imageBase + file;
    });
  } catch (error) {
    console.error("Error al cargar la seccion app:", error);
  }
}

/* =========================================================
   CARGAR COMPONENTES: PLANES QUE ES
   ========================================================= */

async function cargarPlanesQueEs() {
  const componentes = [
    {
      containerId: "plan-basic-que-es",
      folder: "plan-basic-que-es",
      htmlFile: "plan-basic-que-es.html"
    },
    {
      containerId: "plan-plus-que-es",
      folder: "plan-plus-que-es",
      htmlFile: "plan-plus-que-es.html"
    },
    {
      containerId: "plan-pro-que-es",
      folder: "plan-pro-que-es",
      htmlFile: "plan-pro-que-es.html"
    },
    {
      containerId: "plan-comercial-que-es",
      folder: "plan-comercial-que-es",
      htmlFile: "plan-comercial-que-es.html"
    },
    {
      containerId: "plan-video-que-es",
      folder: "plan-video-que-es",
      htmlFile: "plan-video-que-es.html"
    }
  ];

  const tareas = componentes.map(async ({ containerId, folder, htmlFile }) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      const response = await fetch(getSiteAssetUrl(`components/${folder}/${htmlFile}`));
      if (!response.ok) {
        throw new Error(`No se pudo cargar ${htmlFile}: ${response.status}`);
      }

      const html = await responseAsUtf8Text(response);
      container.innerHTML = html;

      const imageBase = getSiteAssetUrl(`components/${folder}/`);
      container.querySelectorAll("img").forEach((img) => {
        const currentSrc = img.getAttribute("src") || "";
        const fileName = currentSrc.split("/").pop();
        if (!fileName) return;
        img.src = imageBase + fileName;
      });
    } catch (error) {
      console.error(`Error cargando ${containerId}:`, error);
    }
  });

  await Promise.all(tareas);
}

/* =========================================================
   CARGAR COMPONENTES: PLANES QUE INCLUYE (SLIDER)
   ========================================================= */

async function cargarPlanesIncluye() {
  const componentes = [
    {
      containerId: "plan-basic-incluye",
      folder: "plan-basic-incluye",
      htmlFile: "plan-basic-incluye.html"
    },
    {
      containerId: "plan-plus-incluye",
      folder: "plan-plus-incluye",
      htmlFile: "plan-plus-incluye.html"
    },
    {
      containerId: "plan-pro-incluye",
      folder: "plan-pro-incluye",
      htmlFile: "plan-pro-incluye.html"
    },
    {
      containerId: "plan-comercial-incluye",
      folder: "plan-comercial-incluye",
      htmlFile: "plan-comercial-incluye.html"
    },
    {
      containerId: "plan-video-incluye",
      folder: "plan-video-incluye",
      htmlFile: "plan-video-incluye.html"
    }
  ];

  const tareas = componentes.map(async ({ containerId, folder, htmlFile }) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      const response = await fetch(getSiteAssetUrl(`components/${folder}/${htmlFile}`));
      if (!response.ok) {
        throw new Error(`No se pudo cargar ${htmlFile}: ${response.status}`);
      }

      const html = await responseAsUtf8Text(response);
      container.innerHTML = html;
      initPlanIncluyeSliders(container);
    } catch (error) {
      console.error(`Error cargando ${containerId}:`, error);
    }
  });

  await Promise.all(tareas);
}

function getPlanIncluyeCardsPerView() {
  if (window.innerWidth <= 767.98) return 1;
  if (window.innerWidth <= 991.98) return 2;
  return 4;
}

function initPlanIncluyeSliders(scope) {
  const root = scope || document;
  const sliders = root.querySelectorAll(".plan-incluye__slider");

  sliders.forEach((slider) => {
    if (slider.dataset.initialized === "true") return;
    slider.dataset.initialized = "true";

    const track = slider.querySelector(".plan-incluye__track");
    const cards = Array.from(slider.querySelectorAll(".plan-incluye__card"));
    const prevButton = slider.querySelector(".plan-incluye__arrow--prev");
    const nextButton = slider.querySelector(".plan-incluye__arrow--next");
    const dotsContainer = slider.parentElement.querySelector(".plan-incluye__dots");

    if (!track || !cards.length || !prevButton || !nextButton) return;

    let perView = getPlanIncluyeCardsPerView();
    let logicalIndex = 0;
    let autoplayInterval = null;
    let isAnimating = false;

    function getTotalCards() {
      return cards.length;
    }

    function applyCardWidth() {
      const gap = 16;
      const currentCards = track.querySelectorAll(".plan-incluye__card");
      currentCards.forEach((card) => {
        card.style.flex = `0 0 calc((100% - ${(perView - 1) * gap}px) / ${perView})`;
      });
    }

    function getStepSize() {
      const firstCard = track.querySelector(".plan-incluye__card");
      if (!firstCard) return 0;

      const styles = window.getComputedStyle(track);
      const gap = parseFloat(styles.gap || styles.columnGap || "16") || 16;
      return firstCard.getBoundingClientRect().width + gap;
    }

    function updateDots() {
      if (!dotsContainer) return;
      const dots = dotsContainer.querySelectorAll(".plan-incluye__dot");
      dots.forEach((dot, index) => {
        dot.classList.toggle("is-active", index === logicalIndex);
      });
    }

    function buildDots() {
      if (!dotsContainer) return;
      const total = getTotalCards();
      dotsContainer.innerHTML = "";

      for (let i = 0; i < total; i += 1) {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "plan-incluye__dot";
        dot.setAttribute("aria-label", `Ir a tarjeta ${i + 1}`);
        dot.addEventListener("click", () => {
          goToLogicalIndex(i);
          restartAutoplay();
        });
        dotsContainer.appendChild(dot);
      }

      updateDots();
    }

    function goToLogicalIndex(targetIndex) {
      const total = getTotalCards();
      if (!total) return;
      if (targetIndex === logicalIndex) return;

      const moves = (targetIndex - logicalIndex + total) % total;
      for (let i = 0; i < moves; i += 1) {
        const first = track.firstElementChild;
        if (first) track.appendChild(first);
      }

      logicalIndex = targetIndex;
      track.style.transition = "none";
      track.style.transform = "translateX(0)";
      requestAnimationFrame(() => {
        track.style.transition = "transform 0.45s ease";
      });
      updateDots();
    }

    function goNext() {
      if (isAnimating) return;
      const step = getStepSize();
      if (!step) return;

      isAnimating = true;
      track.style.transition = "transform 0.45s ease";
      track.style.transform = `translateX(-${step}px)`;

      const onTransitionEnd = (event) => {
        if (event.propertyName !== "transform") return;
        track.removeEventListener("transitionend", onTransitionEnd);

        const first = track.firstElementChild;
        if (first) track.appendChild(first);

        track.style.transition = "none";
        track.style.transform = "translateX(0)";
        void track.offsetWidth;
        track.style.transition = "transform 0.45s ease";

        logicalIndex = (logicalIndex + 1) % getTotalCards();
        updateDots();
        isAnimating = false;
      };

      track.addEventListener("transitionend", onTransitionEnd);
    }

    function goPrev() {
      if (isAnimating) return;
      const step = getStepSize();
      if (!step) return;

      const last = track.lastElementChild;
      if (last) track.insertBefore(last, track.firstElementChild);

      track.style.transition = "none";
      track.style.transform = `translateX(-${step}px)`;
      void track.offsetWidth;

      isAnimating = true;
      track.style.transition = "transform 0.45s ease";
      track.style.transform = "translateX(0)";

      const onTransitionEnd = (event) => {
        if (event.propertyName !== "transform") return;
        track.removeEventListener("transitionend", onTransitionEnd);

        logicalIndex = (logicalIndex - 1 + getTotalCards()) % getTotalCards();
        updateDots();
        isAnimating = false;
      };

      track.addEventListener("transitionend", onTransitionEnd);
    }

    function stopAutoplay() {
      if (autoplayInterval) {
        clearInterval(autoplayInterval);
        autoplayInterval = null;
      }
    }

    function startAutoplay() {
      stopAutoplay();
      const delay = Number(slider.dataset.autoplay) || 4000;
      autoplayInterval = setInterval(goNext, delay);
    }

    function restartAutoplay() {
      startAutoplay();
    }

    prevButton.addEventListener("click", () => {
      goPrev();
      restartAutoplay();
    });

    nextButton.addEventListener("click", () => {
      goNext();
      restartAutoplay();
    });

    slider.addEventListener("mouseenter", stopAutoplay);
    slider.addEventListener("mouseleave", startAutoplay);

    window.addEventListener("resize", () => {
      const nextPerView = getPlanIncluyeCardsPerView();
      if (nextPerView === perView) return;
      perView = nextPerView;
      applyCardWidth();
      goToLogicalIndex(logicalIndex);
    });

    applyCardWidth();
    buildDots();
    goToLogicalIndex(0);
    startAutoplay();
  });
}

/* =========================================================
   CARGAR COMPONENTES: KITS QUE INCLUYE (SLIDER)
   ========================================================= */

async function cargarKitsQueIncluye() {
  const componentes = [
    {
      containerId: "kit-smart-1-1-que-incluye",
      folder: "kit-smart-1-1-que-incluye",
      htmlFile: "kit-smart-1-1-que-incluye.html"
    },
    {
      containerId: "kit-smart-2-2-que-incluye",
      folder: "kit-smart-2-2-que-incluye",
      htmlFile: "kit-smart-2-2-que-incluye.html"
    },
    {
      containerId: "kit-smart-cam-2-2-que-incluye",
      folder: "kit-smart-cam-2-2-que-incluye",
      htmlFile: "kit-smart-cam-2-2-que-incluye.html"
    },
    {
      containerId: "kit-industrial-que-incluye",
      folder: "kit-industrial-que-incluye",
      htmlFile: "kit-industrial-que-incluye.html"
    },
    {
      containerId: "kit-cam-plus-que-incluye",
      folder: "kit-cam-plus-que-incluye",
      htmlFile: "kit-cam-plus-que-incluye.html"
    }
  ];

  const tareas = componentes.map(async ({ containerId, folder, htmlFile }) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      const response = await fetch(getSiteAssetUrl(`components/${folder}/${htmlFile}`));
      if (!response.ok) {
        throw new Error(`No se pudo cargar ${htmlFile}: ${response.status}`);
      }

      const html = await responseAsUtf8Text(response);
      container.innerHTML = html;

      const imageBase = getSiteAssetUrl(`components/${folder}/`);
      container.querySelectorAll("img").forEach((img) => {
        const currentSrc = img.getAttribute("src") || "";
        const fileName = currentSrc.split("/").pop();
        if (!fileName) return;
        img.src = imageBase + fileName;
      });

      const ctaWrapper = container.querySelector(".kit-incluye__cta");
      const ctaLink = ctaWrapper ? ctaWrapper.querySelector(".kit-incluye__cta-btn[href]") : null;

      if (ctaWrapper && ctaLink) {
        try {
          const currentUrl = new URL(window.location.href);
          const targetUrl = new URL(ctaLink.getAttribute("href"), currentUrl);

          const normalizePath = (path) => {
            const clean = (path || "/").replace(/\/+$/g, "") || "/";
            return clean.toLowerCase();
          };

          if (normalizePath(currentUrl.pathname) === normalizePath(targetUrl.pathname)) {
            ctaWrapper.style.display = "none";
            ctaWrapper.setAttribute("aria-hidden", "true");
          }
        } catch (e) {
          // Si no se puede resolver la URL, conservamos el CTA visible.
        }
      }

      initKitIncluyeSliders(container);
    } catch (error) {
      console.error(`Error cargando ${containerId}:`, error);
    }
  });

  await Promise.all(tareas);
}

function getKitIncluyeCardsPerView() {
  if (window.innerWidth <= 767.98) return 1;
  if (window.innerWidth <= 991.98) return 2;
  return 4;
}

function initKitIncluyeSliders(scope) {
  const root = scope || document;
  const sliders = root.querySelectorAll(".kit-incluye__slider");

  sliders.forEach((slider) => {
    if (slider.dataset.initialized === "true") return;
    slider.dataset.initialized = "true";

    const track = slider.querySelector(".kit-incluye__track");
    const cards = Array.from(slider.querySelectorAll(".kit-incluye__card"));
    const prevButton = slider.querySelector(".kit-incluye__arrow--prev");
    const nextButton = slider.querySelector(".kit-incluye__arrow--next");
    const dotsContainer = slider.parentElement.querySelector(".kit-incluye__dots");

    if (!track || !cards.length || !prevButton || !nextButton) return;

    let perView = getKitIncluyeCardsPerView();
    let logicalIndex = 0;
    let autoplayInterval = null;
    let isAnimating = false;

    function getTotalCards() {
      return cards.length;
    }

    function applyCardWidth() {
      const gap = 16;
      const currentCards = track.querySelectorAll(".kit-incluye__card");
      currentCards.forEach((card) => {
        card.style.flex = `0 0 calc((100% - ${(perView - 1) * gap}px) / ${perView})`;
      });
    }

    function getStepSize() {
      const firstCard = track.querySelector(".kit-incluye__card");
      if (!firstCard) return 0;

      const styles = window.getComputedStyle(track);
      const gap = parseFloat(styles.gap || styles.columnGap || "16") || 16;
      return firstCard.getBoundingClientRect().width + gap;
    }

    function updateDots() {
      if (!dotsContainer) return;
      const dots = dotsContainer.querySelectorAll(".kit-incluye__dot");
      dots.forEach((dot, index) => {
        dot.classList.toggle("is-active", index === logicalIndex);
      });
    }

    function buildDots() {
      if (!dotsContainer) return;
      const total = getTotalCards();
      dotsContainer.innerHTML = "";

      for (let i = 0; i < total; i += 1) {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "kit-incluye__dot";
        dot.setAttribute("aria-label", `Ir a tarjeta ${i + 1}`);
        dot.addEventListener("click", () => {
          goToLogicalIndex(i);
          restartAutoplay();
        });
        dotsContainer.appendChild(dot);
      }

      updateDots();
    }

    function goToLogicalIndex(targetIndex) {
      const total = getTotalCards();
      if (!total) return;
      if (targetIndex === logicalIndex) return;

      const moves = (targetIndex - logicalIndex + total) % total;
      for (let i = 0; i < moves; i += 1) {
        const first = track.firstElementChild;
        if (first) track.appendChild(first);
      }

      logicalIndex = targetIndex;
      track.style.transition = "none";
      track.style.transform = "translateX(0)";
      requestAnimationFrame(() => {
        track.style.transition = "transform 0.45s ease";
      });
      updateDots();
    }

    function goNext() {
      if (isAnimating) return;
      const step = getStepSize();
      if (!step) return;

      isAnimating = true;
      track.style.transition = "transform 0.45s ease";
      track.style.transform = `translateX(-${step}px)`;

      const onTransitionEnd = (event) => {
        if (event.propertyName !== "transform") return;
        track.removeEventListener("transitionend", onTransitionEnd);

        const first = track.firstElementChild;
        if (first) track.appendChild(first);

        track.style.transition = "none";
        track.style.transform = "translateX(0)";
        void track.offsetWidth;
        track.style.transition = "transform 0.45s ease";

        logicalIndex = (logicalIndex + 1) % getTotalCards();
        updateDots();
        isAnimating = false;
      };

      track.addEventListener("transitionend", onTransitionEnd);
    }

    function goPrev() {
      if (isAnimating) return;
      const step = getStepSize();
      if (!step) return;

      const last = track.lastElementChild;
      if (last) track.insertBefore(last, track.firstElementChild);

      track.style.transition = "none";
      track.style.transform = `translateX(-${step}px)`;
      void track.offsetWidth;

      isAnimating = true;
      track.style.transition = "transform 0.45s ease";
      track.style.transform = "translateX(0)";

      const onTransitionEnd = (event) => {
        if (event.propertyName !== "transform") return;
        track.removeEventListener("transitionend", onTransitionEnd);

        logicalIndex = (logicalIndex - 1 + getTotalCards()) % getTotalCards();
        updateDots();
        isAnimating = false;
      };

      track.addEventListener("transitionend", onTransitionEnd);
    }

    function stopAutoplay() {
      if (autoplayInterval) {
        clearInterval(autoplayInterval);
        autoplayInterval = null;
      }
    }

    function startAutoplay() {
      stopAutoplay();
      const delay = Number(slider.dataset.autoplay) || 5000;
      autoplayInterval = setInterval(goNext, delay);
    }

    function restartAutoplay() {
      startAutoplay();
    }

    prevButton.addEventListener("click", () => {
      goPrev();
      restartAutoplay();
    });

    nextButton.addEventListener("click", () => {
      goNext();
      restartAutoplay();
    });

    slider.addEventListener("mouseenter", stopAutoplay);
    slider.addEventListener("mouseleave", startAutoplay);

    window.addEventListener("resize", () => {
      const nextPerView = getKitIncluyeCardsPerView();
      if (nextPerView === perView) return;
      perView = nextPerView;
      applyCardWidth();
      goToLogicalIndex(logicalIndex);
    });

    applyCardWidth();
    buildDots();
    goToLogicalIndex(0);
    startAutoplay();
  });
}

/* =========================================================
   CARGAR COMPONENTE: BENEFICIOS CONFIANZA
   ========================================================= */

async function cargarBeneficiosConfianza() {
  const container = document.getElementById("beneficios-confianza");
  if (!container) return;

  try {
    const response = await fetch(getSiteAssetUrl("components/beneficios-confianza/beneficios-confianza.html"));
    if (!response.ok) {
      throw new Error(`No se pudo cargar beneficios-confianza.html: ${response.status}`);
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;

    await ensureSwiperResources();
    initBeneficiosConfianzaSlider();
  } catch (error) {
    console.error("Error cargando beneficios-confianza:", error);
  }
}

function initBeneficiosConfianzaSlider() {
  const sliderElement = document.getElementById("beneficiosConfianzaSlider");

  if (!sliderElement || typeof Swiper === "undefined") return;
  if (sliderElement.dataset.swiperInited === "true") return;
  sliderElement.dataset.swiperInited = "true";

  let beneficiosConfianzaSwiper = null;

  function enableBeneficiosConfianzaSwiper() {
    if (beneficiosConfianzaSwiper) return;

    beneficiosConfianzaSwiper = new Swiper(sliderElement, {
      loop: true,
      slidesPerView: 1,
      spaceBetween: 12,
      speed: 550,
      grabCursor: true,
      allowTouchMove: true,
      autoplay: {
        delay: 3000,
        disableOnInteraction: false,
        pauseOnMouseEnter: true
      }
    });
  }

  function disableBeneficiosConfianzaSwiper() {
    if (!beneficiosConfianzaSwiper) return;

    beneficiosConfianzaSwiper.destroy(true, true);
    beneficiosConfianzaSwiper = null;
  }

  function handleBeneficiosConfianzaSlider() {
    if (window.innerWidth <= 767.98) {
      enableBeneficiosConfianzaSwiper();
    } else {
      disableBeneficiosConfianzaSwiper();
    }
  }

  handleBeneficiosConfianzaSlider();
  window.addEventListener("resize", handleBeneficiosConfianzaSlider);
  window.addEventListener("orientationchange", handleBeneficiosConfianzaSlider);
}

/* =========================================================
   CARGAR COMPONENTE: KITS TIENDA
   ========================================================= */

async function cargarKitsTienda() {
  const container = document.getElementById("kits-tienda");
  if (!container) return;

  try {
    const response = await fetch(getSiteAssetUrl("components/kits-tienda/kits-tienda.html"));
    if (!response.ok) {
      throw new Error(`No se pudo cargar kits-tienda.html: ${response.status}`);
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;

    await ensureSwiperResources();
    initKitsTienda(container);
  } catch (error) {
    console.error("Error cargando kits-tienda:", error);
  }
}

/* =========================================================
   CARGAR COMPONENTE: CONTRATA EN 4 PASOS
   ========================================================= */

async function cargarContrata4Pasos() {
  const container = document.getElementById("contrata-4-pasos");
  if (!container) return;

  try {
    const response = await fetch(getSiteAssetUrl("components/contrata-4-pasos/contrata-4-pasos.html"));
    if (!response.ok) {
      throw new Error(`No se pudo cargar contrata-4-pasos.html: ${response.status}`);
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;

    await ensureSwiperResources();
    initContrata4PasosSlider();
  } catch (error) {
    console.error("Error cargando contrata-4-pasos:", error);
  }
}

function initContrata4PasosSlider() {
  const sliderElement = document.getElementById("contrataPasosSlider");

  if (!sliderElement || typeof Swiper === "undefined") return;
  if (sliderElement.dataset.swiperInited === "true") return;
  sliderElement.dataset.swiperInited = "true";

  let contrataPasosSwiper = null;

  function enableContrataPasosSwiper() {
    if (contrataPasosSwiper) return;

    contrataPasosSwiper = new Swiper(sliderElement, {
      loop: true,
      slidesPerView: 2,
      spaceBetween: 12,
      speed: 550,
      grabCursor: true,
      allowTouchMove: true,
      autoplay: {
        delay: 2800,
        disableOnInteraction: false,
        pauseOnMouseEnter: true
      }
    });
  }

  function disableContrataPasosSwiper() {
    if (!contrataPasosSwiper) return;

    contrataPasosSwiper.destroy(true, true);
    contrataPasosSwiper = null;
  }

  function handleContrataPasosSlider() {
    if (window.innerWidth <= 767.98) {
      enableContrataPasosSwiper();
    } else {
      disableContrataPasosSwiper();
    }
  }

  handleContrataPasosSlider();
  window.addEventListener("resize", handleContrataPasosSlider);
  window.addEventListener("orientationchange", handleContrataPasosSlider);
}

/* =========================================================
   CARGAR COMPONENTE: POR QUE ELEGIR
   ========================================================= */

async function cargarPorQueElegir() {
  const container = document.getElementById("por-que-elegir");
  if (!container) return;

  try {
    const response = await fetch(getSiteAssetUrl("components/por-que-elegir/por-que-elegir.html"));
    if (!response.ok) {
      throw new Error(`No se pudo cargar por-que-elegir.html: ${response.status}`);
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;
  } catch (error) {
    console.error("Error cargando por-que-elegir:", error);
  }
}

/* =========================================================
   CARGAR COMPONENTE: DETALLE PRODUCTO KIT
   ========================================================= */

async function cargarDetalleProductoKit() {
  const container = document.getElementById("kit-producto-detalle");
  if (!container) return;

  try {
    const response = await fetch(getSiteAssetUrl("components/kit-producto-detalle/kit-producto-detalle.html"));
    if (!response.ok) {
      throw new Error(`No se pudo cargar kit-producto-detalle.html: ${response.status}`);
    }

    container.innerHTML = await responseAsUtf8Text(response);

    const getPageSlug = (path) => {
      const cleanPath = String(path || "").split("?")[0].split("#")[0];
      const lastPart = cleanPath.split("/").filter(Boolean).pop() || "";
      return lastPart.replace(/\.html$/i, "").toLowerCase();
    };

    const slug = getPageSlug(window.location.pathname);

    const kitsBySlug = {
      "kit-cam-plus": {
        pricing: getStorefrontKitPricing("kit-cam-plus"),
        title: "Kit Cam+",
        subtitle: "Ideal para hogares y comercios.",
        planTitle: "Plan VIDEO Mensual",
        features: [
          "Monitoreo 24/7 con deteccion de sabotaje",
          "Camara incluida para visualizacion en tiempo real",
          "Arma y desarma tu alarma desde la App SmartHome",
          "Recibe alertas y notificaciones del estado del sistema"
        ],
        includes: [
          "Panel inteligente (incluye sistema)",
          "Panel interactivo",
          "Camara Full HD",
          "2 detectores de movimiento",
          "Placa disuasiva"
        ],
        includeFolder: "kit-cam-plus-que-incluye",
        galleryFiles: [
          "carteleria-smarthome.png",
          "camara-wifi-interior-exterior.png",
          "caja-estanca.png",
          "cable-conexion-energia.png",
          "tarjeta-memoria.png",
          "jaula-antivandalica.png"
        ]
      },
      "kit-smart-1-1": {
        pricing: getStorefrontKitPricing("kit-smart-1-1"),
        title: "Kit Smart 1.1",
        subtitle: "Ideal para hogares y comercios.",
        planTitle: "Plan BASIC Mensual",
        features: [
          "Monitoreo 24/7 con deteccion de sabotaje",
          "Personaliza codigos de usuario para saber quien ingresa y sale",
          "Arma y desarma tu alarma desde la App SmartHome",
          "Recibe alertas y notificaciones del estado del sistema"
        ],
        includes: [
          "Panel inteligente (incluye sistema)",
          "Panel interactivo",
          "1 sensor magnetico",
          "1 detector de movimiento",
          "Placa disuasiva"
        ],
        includeFolder: "kit-smart-1-1-que-incluye",
        galleryFiles: [
          "central-alarma.png",
          "sensor-apertura-magnetico-inalambrico.png",
          "sensor-movimiento-interior.png",
          "llavero-control-remoto.png",
          "gabinete-metalico.png",
          "fuente-alimentacion.png",
          "bateria-respaldo.png",
          "carteleria-smarthome.png",
          "sirena-interior.png"
        ]
      },
      "kit-smart-2-2": {
        pricing: getStorefrontKitPricing("kit-smart-2-2"),
        title: "Kit Smart 2.2",
        subtitle: "Ideal para hogares y comercios.",
        planTitle: "Plan PLUS Mensual",
        features: [
          "Monitoreo 24/7 con deteccion de sabotaje",
          "Personaliza codigos de usuario para saber quien ingresa y sale",
          "Arma y desarma tu alarma desde la App SmartHome",
          "Recibe alertas y notificaciones del estado del sistema"
        ],
        includes: [
          "Panel inteligente (incluye sistema)",
          "Panel interactivo",
          "2 sensores magneticos",
          "2 detectores de movimiento",
          "Placa disuasiva"
        ],
        includeFolder: "kit-smart-2-2-que-incluye",
        galleryFiles: [
          "central-alarma.png",
          "sensor-apertura-magnetico-inalambrico-x2.png",
          "sensor-movimiento-interior-x2.png",
          "llavero-control-remoto.png",
          "gabinete-metalico.png",
          "fuente-alimentacion.png",
          "bateria-respaldo.png",
          "carteleria-smarthome.png",
          "sirena-interior.png"
        ]
      },
      "kit-smart-cam-2-2": {
        pricing: getStorefrontKitPricing("kit-smart-cam-2-2"),
        title: "Kit Smart Cam 2.2",
        subtitle: "Ideal para hogares y comercios.",
        planTitle: "Plan PRO Mensual",
        features: [
          "Monitoreo 24/7 con deteccion de sabotaje",
          "Incluye camara para ver eventos en vivo",
          "Arma y desarma tu alarma desde la App SmartHome",
          "Recibe alertas y notificaciones del estado del sistema"
        ],
        includes: [
          "Panel inteligente (incluye sistema)",
          "Panel interactivo",
          "2 sensores magneticos",
          "2 detectores de movimiento",
          "Camara Full HD"
        ],
        includeFolder: "kit-smart-cam-2-2-que-incluye",
        galleryFiles: [
          "central-alarma.png",
          "sensor-apertura-magnetico-inalambrico-x2.png",
          "sensor-movimiento-interior-x2.png",
          "llavero-control-remoto.png",
          "gabinete-metalico.png",
          "fuente-alimentacion.png",
          "bateria-respaldo.png",
          "carteleria-seguridad.png",
          "sirena-interior.png",
          "camara-wifi-interior-exterior.png",
          "caja-estanca.png",
          "cable-conexion-energia.png",
          "tarjeta-memoria.png",
          "jaula-antivandalica.png"
        ]
      },
      "kit-industrial": {
        pricing: getStorefrontKitPricing("kit-industrial"),
        title: "Kit Industrial",
        subtitle: "Ideal para industrias y grandes superficies.",
        planTitle: "Plan COMERCIAL Mensual",
        features: [
          "Monitoreo 24/7 con deteccion de sabotaje",
          "Cobertura ampliada para mayor superficie",
          "Arma y desarma tu sistema desde la App SmartHome",
          "Recibe alertas y notificaciones en tiempo real"
        ],
        includes: [
          "Panel inteligente (incluye sistema)",
          "Panel interactivo",
          "4 sensores magneticos",
          "4 detectores de movimiento",
          "Sirena de alta potencia"
        ],
        includeFolder: "kit-industrial-que-incluye",
        galleryFiles: [
          "central-alarma.png",
          "sensor-apertura-magnetico-inalambrico.png",
          "sensor-movimiento-interior.png",
          "llavero-control-remoto.png",
          "gabinete-metalico.png",
          "fuente-alimentacion.png",
          "carteleria-smarthome.png",
          "sirena-interior.png",
          "sirena-exterior.png",
          "bateria-respaldo.png",
          "sensor-exterior-doble-tecnologia.png"
        ]
      }
    };

    const kit = kitsBySlug[slug];
    if (!kit) return;

    const galleryImages = Array.isArray(kit.galleryFiles)
      ? kit.galleryFiles.map((file, index) => ({
        src: getSiteAssetUrl(`components/${kit.includeFolder}/${file}`),
        alt: `${kit.title} - detalle ${index + 1}`
      }))
      : [];

    const images = [
      {
        src: getSiteAssetUrl(`pages/tienda/${slug}.webp`),
        alt: `${kit.title} - vista principal`
      },
      ...galleryImages
    ];

    const mainImage = container.querySelector("#kitProductoMainImage");
    const thumbs = container.querySelector("#kitProductoThumbs");
    const title = container.querySelector("#kitProductoTitle");
    const subtitle = container.querySelector("#kitProductoSubtitle");
    const price = container.querySelector("#kitProductoPrice");
    const installments = container.querySelector("#kitProductoInstallments");
    const features = container.querySelector("#kitProductoFeatures");
    const includes = container.querySelector("#kitProductoIncludes");
    const planTitle = container.querySelector("#kitProductoPlanTitle");
    const planList = container.querySelector("#kitProductoPlanList");
    const planSell = container.querySelector("#kitProductoPlanSell");
    const planPromo = container.querySelector("#kitProductoPlanPromo");
    const mainCta = container.querySelector("#kitProductoMainCta");
    const adviceCta = container.querySelector("#kitProductoAdviceCta");

    if (!mainImage || !thumbs || !title || !subtitle || !price || !installments || !features || !includes || !planTitle || !planList || !planSell || !planPromo || !mainCta || !adviceCta) {
      return;
    }

    title.textContent = kit.title;
    subtitle.textContent = kit.subtitle;
    price.textContent = kit.pricing.installationPriceFormatted;
    installments.textContent = kit.pricing.installmentsLabel;
    planTitle.textContent = kit.planTitle || "Plan Mensual";
    planList.textContent = kit.pricing.planListFormatted;
    planSell.textContent = kit.pricing.planFinalFormatted;
    planPromo.textContent = kit.pricing.planPromoLabel;

    features.innerHTML = kit.features
      .map((item) => `<li><i class="bi bi-shield-check"></i><span>${String(item)}</span></li>`)
      .join("");

    includes.innerHTML = kit.includes
      .map((item) => `<li>${String(item)}</li>`)
      .join("");

    let selectedImageIndex = 0;

    function updateMainImage(index) {
      const imageData = images[index];
      if (!imageData) return;

      selectedImageIndex = index;
      mainImage.src = imageData.src;
      mainImage.alt = imageData.alt;
      mainImage.classList.toggle("kit-producto__main-image--full", selectedImageIndex === 0);

      thumbs.querySelectorAll(".kit-producto__thumb").forEach((thumb, thumbIndex) => {
        thumb.classList.toggle("is-active", thumbIndex === selectedImageIndex);
      });
    }

    thumbs.innerHTML = images.map((image, index) => {
      const isActive = index === 0 ? " is-active" : "";
      return `
        <button class="kit-producto__thumb${isActive}" type="button" data-image-index="${index}" aria-label="Ver imagen ${index + 1}">
          <img src="${image.src}" alt="${image.alt}" loading="lazy">
        </button>
      `;
    }).join("");

    updateMainImage(0);

    thumbs.addEventListener("click", (event) => {
      const thumb = event.target.closest(".kit-producto__thumb");
      if (!thumb) return;

      const index = Number(thumb.getAttribute("data-image-index"));
      if (Number.isNaN(index)) return;

      updateMainImage(index);
    });

    const baseWhatsapp = "https://api.whatsapp.com/send?phone=5492646304866";
    const mainMessage = encodeURIComponent(`Hola, quiero contratar el ${kit.title}.`);
    const adviceMessage = encodeURIComponent(`Hola, quiero asesoramiento sobre el ${kit.title}.`);

    mainCta.href = `${baseWhatsapp}&text=${mainMessage}`;
    adviceCta.href = `${baseWhatsapp}&text=${adviceMessage}`;
  } catch (error) {
    console.error("Error cargando detalle de producto de kit:", error);
  }
}

function initKitsTienda(container) {
  const sliderElement = container.querySelector("#kitsTiendaSlider");
  const wrapper = container.querySelector("#kitsTiendaWrapper");
  const prevButton = container.querySelector("#kitsTiendaPrev");
  const nextButton = container.querySelector("#kitsTiendaNext");
  const modalElement = container.querySelector("#kitsTiendaModal");

  if (!sliderElement || !wrapper || !prevButton || !nextButton || !modalElement || typeof Swiper === "undefined") return;

  // =========================================================
  // DATOS DE KITS
  // Para agregar/quitar kits, editar solo este array.
  // El slider, modal y botones se construyen automáticamente.
  // =========================================================
  const kitsData = [
    {
      id: "kit-cam-plus",
      name: "KIT CAM+",
      image: "kit-cam-plus.webp",
      slug: "kit-cam-plus",
      description: "Camara Wi-Fi con grabacion en la nube, tarjeta de memoria, carteleria disuasiva y proteccion para exteriores.",
      pricing: getStorefrontKitPricing("kit-cam-plus"),
      features: ["Video en vivo desde la app", "Grabacion en la nube", "Carteleria disuasiva", "Gabinete y jaula de proteccion"]
    },
    {
      id: "kit-smart-1-1",
      name: "KIT SMART 1.1",
      image: "kit-smart-1-1.webp",
      slug: "kit-smart-1-1",
      description: "Sistema de alarma con central, sensor de movimiento, sensor magnetico inalambrico, sirena interior y llavero.",
      pricing: getStorefrontKitPricing("kit-smart-1-1"),
      features: ["Monitoreo 24/7", "1 sensor de movimiento", "1 sensor magnetico", "Control desde la app"]
    },
    {
      id: "kit-smart-2-2",
      name: "KIT SMART 2.2",
      image: "kit-smart-2-2.webp",
      slug: "kit-smart-2-2",
      description: "Sistema de alarma con central, 2 sensores de movimiento, 2 sensores magneticos inalambricos, sirena interior y llavero.",
      pricing: getStorefrontKitPricing("kit-smart-2-2"),
      features: ["Monitoreo 24/7", "2 sensores de movimiento", "2 sensores magneticos", "Control desde la app"]
    },
    {
      id: "kit-smart-cam-2-2",
      name: "KIT SMART CAM 2.2",
      image: "kit-smart-cam-2-2.webp",
      slug: "kit-smart-cam-2-2",
      description: "Todo lo del Kit Smart 2.2 mas una camara Wi-Fi con grabacion en la nube y carteleria disuasiva.",
      pricing: getStorefrontKitPricing("kit-smart-cam-2-2"),
      features: ["Monitoreo 24/7", "Camara Wi-Fi incluida", "Grabacion en la nube", "Alarma + video en un solo kit"]
    },
    {
      id: "kit-industrial",
      name: "KIT INDUSTRIAL",
      image: "kit-industrial.webp",
      slug: "kit-industrial",
      description: "Sistema de alarma con proteccion interior y exterior: sirena exterior, sensores de doble tecnologia y cobertura perimetral.",
      pricing: getStorefrontKitPricing("kit-industrial"),
      features: ["Monitoreo 24/7", "Sirena exterior disuasiva", "Sensores doble tecnologia exterior", "Cobertura perimetral"]
    }
  ];

  if (!kitsData.length) return;

  const getKitImageUrl = (imageName) => getSiteAssetUrl(`pages/tienda/${imageName}`);
  const getKitPageUrl = (slug) => getSiteAssetUrl(`pages/tienda/${slug}.html`);

  // La card KIT SMART 1.1 debe iniciar centrada en la carga.
  const preferredInitialIndex = kitsData.findIndex((kit) => kit.id === "kit-smart-1-1");
  const initialIndex = preferredInitialIndex >= 0 ? preferredInitialIndex : 0;

  function renderCards() {
    wrapper.innerHTML = kitsData.map((kit, index) => {
      const safeName = String(kit.name || "");
      const safeDescription = String(kit.description || "");
      const safePrice = String(kit.pricing?.installationPriceFormatted || "");
      const safeInstallments = String(kit.pricing?.installmentsLabel || "");
      const imageUrl = getKitImageUrl(kit.image);
      const pageUrl = getKitPageUrl(kit.slug);

      return `
        <div class="swiper-slide kits-tienda__slide" data-kit-index="${index}">
          <article class="kits-tienda__card" aria-label="${safeName}">
            <div class="kits-tienda__card-media">
              <img src="${imageUrl}" alt="${safeName}" loading="lazy">
            </div>

            <div class="kits-tienda__card-body">
              <div class="kits-tienda__card-top">
                <h3 class="kits-tienda__card-title">${safeName}</h3>
                <button class="kits-tienda__info-btn" type="button" data-kit-index="${index}">+ Info</button>
              </div>

              <p class="kits-tienda__card-description">${safeDescription}</p>

              <div class="kits-tienda__price-row">
                <div>
                  <p class="kits-tienda__price">${safePrice}</p>
                  <p class="kits-tienda__price-note">Costo instalacion</p>
                </div>
                <span class="kits-tienda__installments">${safeInstallments}</span>
              </div>

              <a class="kits-tienda__cta" href="${pageUrl}">Lo quiero</a>
            </div>
          </article>
        </div>
      `;
    }).join("");
  }

  renderCards();

  const desktopSlides = Math.min(3, kitsData.length);
  const shouldLoop = kitsData.length > 1;

  const kitsSwiper = new Swiper(sliderElement, {
    loop: shouldLoop,
    centeredSlides: true,
    slidesPerView: 1,
    spaceBetween: 16,
    speed: 550,
    grabCursor: true,
    allowTouchMove: true,
    navigation: {
      prevEl: prevButton,
      nextEl: nextButton
    },
    breakpoints: {
      768: {
        slidesPerView: desktopSlides,
        spaceBetween: 22
      }
    },
    on: {
      init: function (swiper) {
        if (swiper.params.loop) {
          swiper.slideToLoop(initialIndex, 0, false);
        } else {
          swiper.slideTo(initialIndex, 0, false);
        }
      }
    }
  });

  // Reforzar posición inicial al primer render visual.
  requestAnimationFrame(() => {
    if (kitsSwiper.params.loop) {
      kitsSwiper.slideToLoop(initialIndex, 0, false);
    } else {
      kitsSwiper.slideTo(initialIndex, 0, false);
    }
  });

  const modalImage = container.querySelector("#kitsTiendaModalImage");
  const modalTitle = container.querySelector("#kitsTiendaModalTitle");
  const modalDescription = container.querySelector("#kitsTiendaModalDescription");
  const modalPrice = container.querySelector("#kitsTiendaModalPrice");
  const modalInstallments = container.querySelector("#kitsTiendaModalInstallments");
  const modalFeatures = container.querySelector("#kitsTiendaModalFeatures");
  const modalProductLink = container.querySelector("#kitsTiendaModalProductLink");

  if (!modalImage || !modalTitle || !modalDescription || !modalPrice || !modalInstallments || !modalFeatures || !modalProductLink) return;

  let modalInstance = null;
  if (window.bootstrap && typeof window.bootstrap.Modal === "function") {
    modalInstance = window.bootstrap.Modal.getOrCreateInstance(modalElement);
  }

  function fillAndOpenModal(kitIndex) {
    const kit = kitsData[kitIndex];
    if (!kit) return;

    modalImage.src = getKitImageUrl(kit.image);
    modalImage.alt = kit.name;
    modalTitle.textContent = kit.name;
    modalDescription.textContent = kit.description;
    modalPrice.textContent = kit.pricing?.installationPriceFormatted || "";
    modalInstallments.textContent = kit.pricing?.installmentsLabel || "";
    modalProductLink.href = getKitPageUrl(kit.slug);

    modalFeatures.innerHTML = kit.features
      .map((feature) => `<li><i class="bi bi-gear"></i><span>${String(feature)}</span></li>`)
      .join("");

    if (modalInstance) {
      modalInstance.show();
    }
  }

  wrapper.addEventListener("click", (event) => {
    const button = event.target.closest(".kits-tienda__info-btn");
    if (!button) return;

    const index = Number(button.getAttribute("data-kit-index"));
    if (Number.isNaN(index)) return;

    fillAndOpenModal(index);
  });
}

/* =========================================================
   CARGAR COMPONENTE: EN CONSTRUCCION
   ========================================================= */

async function cargarEnConstruccion() {
  const container = document.getElementById("en-construccion");
  if (!container) return;

  try {
    const response = await fetch(getSiteAssetUrl("components/en-construccion/en-construccion.html"));
    if (!response.ok) {
      throw new Error(`No se pudo cargar en-construccion.html: ${response.status}`);
    }

    const html = await responseAsUtf8Text(response);
    container.innerHTML = html;

    const cta = container.querySelector(".en-construccion__cta");
    if (cta) {
      cta.href = getSiteAssetUrl("index.html");
    }
  } catch (error) {
    console.error("Error cargando en-construccion:", error);
  }
}

/* =========================================================
   INICIALIZAR SECCIÓN: CARACTERÍSTICAS DEL PANEL
   
   DESCRIPCIÓN:
   Slider automático con 5 características del panel inteligente.
   - Auto-advance cada 5 segundos
   - Navegación manual con flechas < >
   - Indicadores de posición
   
   ========================================================= */

function initCaracteristicasPanel() {
  const section = document.querySelector(".section--caracteristicas-panel");
  if (!section) return;

  const slider = document.getElementById("caracteristicas-slider");
  if (!slider) return;

  // Elementos
  const slides = slider.querySelectorAll(".caracteristicas-panel__slide");
  const arrowPrev = section.querySelector(".caracteristicas-panel__arrow--prev");
  const arrowNext = section.querySelector(".caracteristicas-panel__arrow--next");
  const indicators = section.querySelectorAll(".caracteristicas-panel__indicator");

  if (!slides.length) return;

  // Estado
  let currentSlide = 0;
  let autoPlayInterval = null;

  // ============================================================
  // FUNCIONES PRINCIPALES
  // ============================================================

  /**
   * Muestra un slide específico
   */
  function goToSlide(index) {
    // Asegurar que el índice está dentro del rango
    currentSlide = (index + slides.length) % slides.length;

    // Actualizar slides
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === currentSlide);
    });

    // Actualizar indicadores
    indicators.forEach((indicator, i) => {
      indicator.classList.toggle("is-active", i === currentSlide);
    });

    // Reiniciar autoplay
    resetAutoPlay();
  }

  /**
   * Ir al slide anterior
   */
  function prevSlide() {
    goToSlide(currentSlide - 1);
  }

  /**
   * Ir al siguiente slide
   */
  function nextSlide() {
    goToSlide(currentSlide + 1);
  }

  /**
   * Inicia el auto-play (avanza cada 5 segundos)
   */
  function startAutoPlay() {
    autoPlayInterval = setInterval(() => {
      nextSlide();
    }, 5000); // 5 segundos
  }

  /**
   * Detiene y reinicia el auto-play
   */
  function resetAutoPlay() {
    clearInterval(autoPlayInterval);
    startAutoPlay();
  }

  /**
   * Pausa el auto-play cuando el usuario interactúa
   */
  function pauseAutoPlay() {
    clearInterval(autoPlayInterval);
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================

  // Función auxiliar para remover clase después del click
  function handleTouchButton(button, callback) {
    button.addEventListener("touchstart", function(e) {
      e.preventDefault();
      this.classList.add("is-pressed");
    });
    button.addEventListener("touchend", function(e) {
      e.preventDefault();
      this.classList.remove("is-pressed");
      this.blur();
      callback();
    });
    button.addEventListener("click", function(e) {
      // El click en mobile ya se manejó en touchend
      if (e.isTrusted && e.pointerType === "") {
        return; // Es un click generado por touchend, ignorar
      }
      callback();
    });
  }

  // Botón anterior
  if (arrowPrev) {
    handleTouchButton(arrowPrev, () => {
      pauseAutoPlay();
      prevSlide();
    });
  }

  // Botón siguiente
  if (arrowNext) {
    handleTouchButton(arrowNext, () => {
      pauseAutoPlay();
      nextSlide();
    });
  }

  // Indicadores
  indicators.forEach((indicator, index) => {
    indicator.addEventListener("touchstart", function(e) {
      e.preventDefault();
      this.classList.add("is-pressed");
    });
    indicator.addEventListener("touchend", function(e) {
      e.preventDefault();
      this.classList.remove("is-pressed");
      this.blur();
      pauseAutoPlay();
      goToSlide(index);
    });
    indicator.addEventListener("click", function(e) {
      pauseAutoPlay();
      goToSlide(index);
    });
  });

  // Pausar autoplay cuando el usuario mueve el mouse sobre la sección
  section.addEventListener("mouseenter", pauseAutoPlay);
  section.addEventListener("mouseleave", resetAutoPlay);

  // ============================================================
  // INICIALIZACIÓN
  // ============================================================

  // Mostrar primer slide
  goToSlide(0);

  // Iniciar auto-play
  startAutoPlay();
}

