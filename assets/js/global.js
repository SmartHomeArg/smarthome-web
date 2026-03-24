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

/* =========================================
   MARCAR MENU ACTIVO
========================================= */

function activarMenu() {

  const path = window.location.pathname;
  const links = document.querySelectorAll(".main-menu a");

  links.forEach(link => {

    const href = link.getAttribute("href");

    if (path.includes(href) && !href.includes("index")) {
      link.classList.add("active");
    }

  });

}

/* =========================================
   CARGA COMPONENTES GLOBALES (HEADER / FOOTER)
========================================= */

document.addEventListener("DOMContentLoaded", async function () {
  cargarHeader();
  cargarFooter();

  await cargarHero();
  cargarHeroForm();
  cargarPorQueSmartHome();
  await cargarPlanesSlide();
  await cargarCotizar();
  await cargarEquipamiento();
  await cargarFuncionalidades();
  await cargarTuHogarProtegido();
  await cargarTuComercioProtegido();

  cargarContactate();
  cargarWhatsappFloat();
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
    .then(response => response.text())
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
    .then(response => response.text())
    .then(data => {
      const footerEl = document.getElementById('footer');
      if (footerEl) footerEl.innerHTML = data;
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
        title: '<span class="text-brand">Seguridad inteligente</span> para tu hogar',
        description: "Alarmas, cámaras y monitoreo profesional para proteger tu casa con una solución moderna y confiable.",
        origen: "index"
      },
      hogar: {
        title: '<span class="text-brand">Seguridad inteligente</span> para tu hogar',
        description: "Alarmas, cámaras y monitoreo profesional para proteger tu casa con una solución moderna y confiable.",
        origen: "hogar"
      },
      comercio: {
        title: '<span class="text-brand">Seguridad inteligente</span> para tu comercio',
        description: "Alarmas, cámaras y monitoreo profesional para proteger tu comercio con una solución moderna y confiable.",
        origen: "comercio"
      }
    };

    const pageKey = heroConfig[pageSlug] ? pageSlug : "index";

    const resolveHeroImagePath = async (slug) => {
      const candidate = getSiteAssetUrl(`components/hero/hero-${slug}.jpg`);
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

    const heroHTML = await response.text();
    heroContainer.innerHTML = heroHTML;

    const config = heroConfig[pageKey] || heroConfig.index;
    const heroImage = await resolveHeroImagePath(pageSlug);

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
      return response.text();
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

    const html = await response.text();
    container.innerHTML = html;

    const imageBase = getSiteAssetUrl("components/planes-slide/");
    container.querySelectorAll(".plan-home-card__image").forEach((img) => {
      const currentSrc = img.getAttribute("src") || "";
      const fileName = currentSrc.split("/").pop();
      if (fileName) {
        img.src = imageBase + fileName;
      }
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

    const html = await response.text();
    container.innerHTML = html;

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

    const html = await response.text();
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

    const html = await response.text();
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

    const html = await response.text();
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

    const html = await response.text();
    container.innerHTML = html;

    const images = container.querySelectorAll("img");
    if (images[0]) images[0].src = getSiteAssetUrl("components/tu-comercio-protegido/comercio-protegido.jpg");
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

function initHeroLeadForm() {
  const form = document.getElementById('hero-lead-form');
  if (!form) return;

  const scriptURL = 'https://script.google.com/macros/s/AKfycbzxkHX0fbZlJiENW5xcMq-CAkGLS3K3aI18A0vVuEySE079E1JOddCB-s6xDa3bEIasjw/exec';

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
    });
  }

  function clearFieldError(field) {
    if (field) field.classList.remove('is-invalid');
  }

  function setFieldError(field) {
    if (field) field.classList.add('is-invalid');
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
      setFieldError(nombreInput);
      isValid = false;
    }

    // Ahora requerimos exactamente 10 dígitos para teléfono
    if (telefono.length !== 10) {
      setFieldError(telefonoInput);
      isValid = false;
    }

    if (!provincia) {
      setFieldError(provinciaInput);
      isValid = false;
    }

    if (!emailIsValid(email)) {
      setFieldError(emailInput);
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
    // Determinar número de slides y usar el índice central como inicio
    const slides = sliderElement.querySelectorAll('.swiper-slide');
    const slidesCount = Math.max(1, slides.length);
    const initialIndex = Math.floor(slidesCount / 2) || 0;

    plansHomeSwiper = new Swiper(sliderElement, {
      loop: true,
      slidesPerView: 1.12,
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
    .then(response => response.text())
    .then(data => {
      placeholder.innerHTML = data;

      const imagen = placeholder.querySelector(".contactate-home__image img");
      if (imagen) {
        imagen.src = getSiteAssetUrl("components/contactate/contactate.jpg");
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
    .then(response => response.text())
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
          if (d !== drop) d.classList.remove('is-open');
        });

        if (isOpen) {
          drop.classList.remove('is-open');
        } else {
          drop.classList.add('is-open');
        }
      };

      toggle.addEventListener('click', handler, false);
    });

    // Cerrar al tocar fuera
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.como-dropdown')) return;
      document.querySelectorAll('.como-dropdown.is-open').forEach(d => d.classList.remove('is-open'));
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

    const html = await response.text();
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
    const rutasComponente = [
      getSiteAssetUrl("components/zonas-proteccion-comercio/zonas-proteccion-comercio.html"),
      getSiteAssetUrl("components/zonas-proteccion-comercio/zonas-proteccion-hogar.html")
    ];

    let html = "";
    let cargado = false;

    for (const ruta of rutasComponente) {
      const response = await fetch(ruta);
      if (!response.ok) continue;
      html = await response.text();
      cargado = true;
      break;
    }

    if (!cargado) {
      throw new Error("No se pudo cargar el componente zonas-proteccion-comercio");
    }

    container.innerHTML = html;

    initZonasProteccionHogar({
      root: container,
      componentFolder: "zonas-proteccion-comercio",
      mainSceneImage: "escena-comercio.png"
    });
  } catch (error) {
    console.error("Error al cargar la sección zonas-proteccion-comercio:", error);
  }
}

/* =========================================================
   INICIALIZAR SECCIÓN: ZONAS DE PROTECCIÓN DEL HOGAR
   
   DESCRIPCIÓN:
   Controla un sistema interactivo de pestañas (tabs) que permite
   cambiar entre diferentes tipos de protección. Cada pestaña 
   muestra una serie de items (productos/servicios) con:
   - Iconos flotantes posicionables en la imagen
   - Panel lateral con detalles del producto seleccionado
   - Navegación entre items con flechas
   
   ESTRUCTURA DE DATOS (sectionData):
   Contiene arrays de items por cada pestaña. Cada item es un objeto
   con título, descripción, imagen, icono y posición.
   
   ========================================================= */

function initZonasProteccionHogar(options = {}) {
  const root = options.root || document;
  const componentFolder = options.componentFolder || "zonas-proteccion-hogar";
  const mainSceneImage = options.mainSceneImage || "escena-hogar.png";

  // ============================================================
  // PASO 1: OBTENER ELEMENTOS DEL DOM
  // ============================================================
  
  const section = root.querySelector(".zonas-proteccion-hogar, .zonas-proteccion-comercio");
  if (!section) return;

  // Elements para controlar las pestañas
  const tabs = Array.from(section.querySelectorAll(".zonas-proteccion-hogar__tab"));
  
  // Elements para los marcadores/iconos flotantes
  const markers = Array.from(section.querySelectorAll(".zonas-proteccion-hogar__marker"));
  
  // Elements para el panel lateral de detalles
  const panel = section.querySelector(".zonas-proteccion-hogar__panel");
  const panelTitle = section.querySelector(".zonas-proteccion-hogar__panel-title");
  const panelDescription = section.querySelector(".zonas-proteccion-hogar__panel-description");
  const productImage = section.querySelector(".zonas-proteccion-hogar__product-image");
  const mainImage = section.querySelector(".zonas-proteccion-hogar__main-image");
  const benefitsSection = section.querySelector(".zonas-proteccion-hogar__benefits");
  
  // Botones de navegación
  const prevButton = section.querySelector(".zonas-proteccion-hogar__arrow--prev");
  const nextButton = section.querySelector(".zonas-proteccion-hogar__arrow--next");
  const closeButton = section.querySelector(".zonas-proteccion-hogar__panel-close");

  // Validar que todos los elementos existan
  if (
    !tabs.length ||
    !markers.length ||
    !panel ||
    !panelTitle ||
    !panelDescription ||
    !productImage ||
    !prevButton ||
    !nextButton
  ) {
    console.error("Zonas Protección Hogar: faltan elementos DOM requeridos");
    return;
  }

  // ============================================================
  // PASO 2: CONFIGURACIÓN DE RUTAS Y VARIABLES
  // ============================================================
  
  const imageBasePath = getSiteAssetUrl("assets/img/");
  const componentImageBasePath = getSiteAssetUrl(`components/${componentFolder}/`);

  // Imágenes que fueron movidas de assets/img a components/zonas-proteccion-hogar
  const movedImages = new Set([
    "escena-hogar.png",
    "escena-comercio.png",
    "escena-hogar-mag.png",
    "escena-hogar-pir-mov.png"
  ]);

  const getImagePath = (fileName, preferComponent = false) => {
    if (!fileName) return "";
    if (preferComponent || movedImages.has(fileName)) {
      return componentImageBasePath + fileName;
    }
    return imageBasePath + fileName;
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

    imgElement.dataset.fallbackApplied = "false";
    imgElement.src = primarySrc;
  };

  if (mainImage) {
    setImageSourceWithFallback(mainImage, mainSceneImage, true);
  }

  // ============================================================
  // PASO 3: ESTRUCTURA DE DATOS - CONFIGURACIÓN POR PESTAÑA
  // 
  // GUÍA DE EDICIÓN:
  // 
  // Para AGREGAR un nuevo ITEM a una pestaña:
  // 1. Copia un objeto existente dentro del array de la pestaña
  // 2. Edita title, description, image, alt
  // 3. Cambia los valores de marker.top y marker.left en porcentaje
  //    (ej: "23%" significa 23% desde arriba y desde la izquierda)
  // 4. Cambia el icon a un código de Bootstrap Icons
  //    (ej: "lock-fill", "camera-fill", ver https://icons.getbootstrap.com/)
  // 5. Agrega más botones <button> al HTML si necesitas más de 6 items
  //
  // Para QUITAR un ITEM:
  // 1. Borra el objeto completo del array
  // 2. No es necesario quitar el botón del HTML (se oculta automático)
  //
  // ============================================================

  const sectionData = {
    
    // PESTAÑA 1: PROTECCIÓN PERIMETRAL
    perimetral: [
      {
        title: "Contacto magnético exterior",
        description: "Detector de contacto ideal para proteger accesos exteriores, puertas y ventanas del perímetro del hogar.",
        image: "escena-hogar-mag.png",
        alt: "Contacto magnético exterior",
        icon: "door-closed",  // ← CAMBIAR ICONO: busca en https://icons.getbootstrap.com/
        marker: { top: "23%", left: "9%" }  // ← CAMBIAR POSICIÓN
      },
      {
        title: "Sensor PIR de movimiento",
        description: "Detecta movimiento en zonas de paso y dispara alertas cuando hay actividad no autorizada.",
        image: "escena-hogar-pir-mov.png",
        alt: "Sensor de movimiento PIR",
        icon: "motion",  // ← CAMBIAR ICONO
        marker: { top: "36%", left: "26%" }  // ← CAMBIAR POSICIÓN
      },
      {
        title: "Sirena disuasiva",
        description: "Al activarse, emite sonido y señal visual para advertir y ayudar a disuadir intrusiones.",
        image: "escena-hogar-mag.png",
        alt: "Sirena disuasiva exterior",
        icon: "exclamation-triangle-fill",  // ← CAMBIAR ICONO
        marker: { top: "69%", left: "48%" }  // ← CAMBIAR POSICIÓN
      },
      {
        title: "Refuerzo en accesos laterales",
        description: "Cobertura en zonas laterales y puntos ciegos para completar la protección perimetral.",
        image: "escena-hogar-pir-mov.png",
        alt: "Protección de accesos laterales",
        icon: "shield-check",  // ← CAMBIAR ICONO
        marker: { top: "49%", left: "86%" }  // ← CAMBIAR POSICIÓN
      }
    ],
    
    // PESTAÑA 2: PROTECCIÓN INTERIOR
    interior: [
      {
        title: "Panel inteligente",
        description: "El panel centraliza la operación y comunica el estado del sistema para una gestión simple y segura.",
        image: "equipamiento-panel.png",
        alt: "Panel inteligente de alarma",
        icon: "cpu",  // ← CAMBIAR ICONO
        marker: { top: "29%", left: "34%" }  // ← CAMBIAR POSICIÓN
      },
      {
        title: "Monitoreo de ambientes",
        description: "Control continuo de áreas internas para detectar cambios y eventos importantes en tiempo real.",
        image: "tu-hogar-protegido-2.png",
        alt: "Monitoreo de ambientes interiores",
        icon: "eye-fill",  // ← CAMBIAR ICONO
        marker: { top: "53%", left: "19%" }  // ← CAMBIAR POSICIÓN
      },
      {
        title: "Control desde celular",
        description: "Gestioná armado, desarmado y estado del sistema con acceso rápido desde la app.",
        image: "tu-hogar-protegido-3.png",
        alt: "Control del sistema desde celular",
        icon: "phone",  // ← CAMBIAR ICONO
        marker: { top: "63%", left: "57%" }  // ← CAMBIAR POSICIÓN
      },
      {
        title: "Cobertura integral interior",
        description: "Integración de dispositivos para proteger espacios internos clave de forma coordinada.",
        image: "tu-hogar-protegido.png",
        alt: "Cobertura integral interior",
        icon: "house-fill",  // ← CAMBIAR ICONO
        marker: { top: "43%", left: "82%" }  // ← CAMBIAR POSICIÓN
      }
    ],
    
    // PESTAÑA 3: VIDEO
    video: [
      {
        title: "Video inteligente",
        description: "Visualización y verificación remota para responder con más contexto ante eventos de seguridad.",
        image: "funcionalidades-video-inteligencia.jpg",
        alt: "Video inteligente",
        icon: "camera-video",  // ← CAMBIAR ICONO
        marker: { top: "28%", left: "17%" }  // ← CAMBIAR POSICIÓN
      },
      {
        title: "Smart cam interior",
        description: "Seguimiento de actividad en espacios internos con acceso desde la aplicación.",
        image: "funcionalidades-smart-cam.jpg",
        alt: "Camara inteligente interior",
        icon: "camera-fill",  // ← CAMBIAR ICONO
        marker: { top: "49%", left: "33%" }  // ← CAMBIAR POSICIÓN
      },
      {
        title: "Registro de eventos",
        description: "Historial visual para consultar eventos detectados y facilitar la toma de decisiones.",
        image: "funcionalidades-hogar-y-mascotas.jpg",
        alt: "Registro de eventos de seguridad",
        icon: "clock-history",  // ← CAMBIAR ICONO
        marker: { top: "67%", left: "54%" }  // ← CAMBIAR POSICIÓN
      },
      {
        title: "Cobertura de zonas críticas",
        description: "Distribución de cámaras para cubrir puntos de ingreso y circulación con mayor precisión.",
        image: "funcionalidades-smart-cam.jpg",
        alt: "Cobertura de zonas criticas",
        icon: "crosshair",  // ← CAMBIAR ICONO
        marker: { top: "47%", left: "82%" }  // ← CAMBIAR POSICIÓN
      }
    ],
    
    // PESTAÑA 4: CONECTIVIDAD
    conectividad: [
      {
        title: "Conectividad del sistema",
        description: "Comunicación estable entre dispositivos para sostener la protección y el monitoreo en todo momento.",
        image: "plan-home-control.jpg",
        alt: "Conectividad del sistema de seguridad",
        icon: "wifi",  // ← CAMBIAR ICONO
        marker: { top: "31%", left: "25%" }  // ← CAMBIAR POSICIÓN
      },
      {
        title: "Integracion con app",
        description: "Control unificado para visualizar estado del hogar y gestionar acciones desde cualquier lugar.",
        image: "plan-home-live.jpg",
        alt: "Integracion de la app con la alarma",
        icon: "app",  // ← CAMBIAR ICONO
        marker: { top: "48%", left: "42%" }  // ← CAMBIAR POSICIÓN
      },
      {
        title: "Automatizacion de rutinas",
        description: "Programación de acciones y notificaciones para una experiencia de seguridad más cómoda.",
        image: "plan-home-plus.jpg",
        alt: "Automatizacion del sistema",
        icon: "gear-fill",  // ← CAMBIAR ICONO
        marker: { top: "64%", left: "61%" }  // ← CAMBIAR POSICIÓN
      },
      {
        title: "Canales de respaldo",
        description: "Redundancia de comunicación para mantener disponibilidad ante cortes o interferencias.",
        image: "equipamiento-panel.png",
        alt: "Canales de respaldo de conectividad",
        icon: "diagram-3-fill",  // ← CAMBIAR ICONO
        marker: { top: "40%", left: "84%" }  // ← CAMBIAR POSICIÓN
      }
    ]
  };

  // ============================================================
  // PASO 4: VARIABLES DE ESTADO
  // ============================================================
  
  let activeTab = "perimetral";      // Pestaña activa actual
  let activeIndex = 0;               // Índice del item activo en la pestaña

  // ============================================================
  // PASO 5: FUNCIONES AUXILIARES
  // ============================================================
  
  /**
   * Detects if the viewport is mobile/tablet (max-width: 991.98px)
   */
  const isMobileViewport = () => window.matchMedia("(max-width: 991.98px)").matches;

  /**
   * Normaliza un índice para que esté dentro del rango válido
   * Ej: con total=4, índice -1 → 3, índice 5 → 1
   */
  const clampIndex = (index, total) => {
    if (!total) return 0;
    return ((index % total) + total) % total;
  };

  /**
   * Abre el panel lateral (lo muestra en mobile)
   */
  const openPanel = () => {
    panel.classList.remove("is-collapsed");
    panel.setAttribute("aria-hidden", "false");
    // Remueve la clase que sube los beneficios (vuelven a su posición normal)
    if (benefitsSection) {
      benefitsSection.classList.remove("benefits-collapsed");
    }
  };

  /**
   * Cierra el panel lateral en mobile
   */
  const closePanel = () => {
    if (!isMobileViewport()) return;
    panel.classList.add("is-collapsed");
    panel.setAttribute("aria-hidden", "true");
    // Agrega clase que sube los beneficios dinámicamente
    if (benefitsSection) {
      benefitsSection.classList.add("benefits-collapsed");
    }
  };

  /**
   * Obtiene el array de items de la pestaña activa
   */
  const getActiveItems = () => sectionData[activeTab] || [];

  /**
   * Renderiza el estado actual de la UI
   * - Actualiza la clase "is-active" en las pestañas
   * - Posiciona y muestra/oculta los marcadores
   * - Carga el contenido del panel con el item seleccionado
   */
  function render() {
    const items = getActiveItems();
    if (!items.length) return;

    // Ajusta el índice activo si está fuera de rango
    activeIndex = clampIndex(activeIndex, items.length);
    const currentItem = items[activeIndex];

    // ========================================================
    // Actualizar estado de las pestañas
    // ========================================================
    tabs.forEach((tab) => {
      const isActive = tab.dataset.tab === activeTab;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    // ========================================================
    // Actualizar marcadores (iconos flotantes)
    // ========================================================
    markers.forEach((marker, index) => {
      const markerItem = items[index];
      
      if (!markerItem) {
        // Si no hay item para este marcador, ocúltalo
        marker.style.display = "none";
        marker.classList.remove("is-active");
        marker.removeAttribute("aria-current");
        return;
      }

      // Mostrar el marcador
      marker.style.display = "inline-flex";
      marker.style.top = markerItem.marker.top;
      marker.style.left = markerItem.marker.left;
      
      // Insertar el icono de Bootstrap Icons
      // Se inserta como: <i class="bi bi-icon-name"></i>
      // Si Bootstrap Icons no carga, usamos un símbolo Unicode como fallback
      const iconCode = markerItem.icon;
      
      // Mapa de iconos a símbolos Unicode (fallback si Bootstrap Icons no carga)
      const iconFallback = {
        'door-closed': '🚪',
        'motion': '⚡',
        'exclamation-triangle-fill': '⚠️',
        'shield-check': '🛡️',
        'cpu': '💾',
        'eye-fill': '👁️',
        'phone': '📱',
        'house-fill': '🏠',
        'camera-video': '📹',
        'camera-fill': '📷',
        'clock-history': '⏰',
        'crosshair': '🎯',
        'wifi': '📡',
        'app': '💻',
        'gear-fill': '⚙️',
        'diagram-3-fill': '🔗',
        'lightbulb-fill': '💡',
        'thermometer-half': '🌡️'
      };
      
      const fallbackSymbol = iconFallback[iconCode] || '•';
      marker.innerHTML = `<i class="bi bi-${iconCode}" style="display: inline-block; font-size: 1.2rem; line-height: 1;">${fallbackSymbol}</i>`;
      
      // Marcar como activo si corresponde
      marker.classList.toggle("is-active", index === activeIndex);

      if (index === activeIndex) {
        marker.setAttribute("aria-current", "true");
      } else {
        marker.removeAttribute("aria-current");
      }
    });

    // ========================================================
    // Actualizar contenido del panel lateral
    // ========================================================
    panelTitle.textContent = currentItem.title;
    panelDescription.textContent = currentItem.description;
    setImageSourceWithFallback(productImage, currentItem.image);
    productImage.alt = currentItem.alt;
  }

  // ============================================================
  // PASO 6: EVENT LISTENERS - INTERACTIVIDAD
  // ============================================================
  
  /**
   * Cambiar entre pestañas (tabs)
   */
  tabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      const nextTab = this.dataset.tab;
      if (!nextTab || nextTab === activeTab) return;
      
      activeTab = nextTab;
      activeIndex = 0;  // Resetea al primer item de la nueva pestaña
      openPanel();
      render();
    });
  });

  /**
   * Seleccionar un item por su marcador
   */
  markers.forEach((marker, index) => {
    marker.addEventListener("click", function () {
      const total = getActiveItems().length;
      if (index >= total) return;
      
      activeIndex = index;
      openPanel();
      render();
    });
  });

  /**
   * Botón anterior (navegación entre items)
   */
  prevButton.addEventListener("click", function () {
    activeIndex -= 1;
    openPanel();
    render();
  });

  /**
   * Botón siguiente (navegación entre items)
   */
  nextButton.addEventListener("click", function () {
    activeIndex += 1;
    openPanel();
    render();
  });

  /**
   * Botón cerrar panel (solo en mobile)
   */
  if (closeButton) {
    closeButton.addEventListener("click", closePanel);
  }

  /**
   * Al cambiar el tamaño de pantalla, abre el panel en desktop
   */
  window.addEventListener("resize", function () {
    if (!isMobileViewport()) {
      openPanel();
    }
  });

  // ============================================================
  // PASO 7: INICIALIZACIÓN FINAL
  // ============================================================
  
  panel.setAttribute("aria-hidden", "false");
  render();  // Renderiza el estado inicial
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

    const html = await response.text();
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

    const html = await response.text();
    container.innerHTML = html;

    const imageBase = getSiteAssetUrl("components/comparacion-caracteristicas-planes/");
    container
      .querySelectorAll(".comparacion-caracteristicas-planes__plan-image[data-image]")
      .forEach((img) => {
        img.src = imageBase + img.dataset.image;
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

    const html = await response.text();
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

    const html = await response.text();
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
      title: "Todo en uno",
      description: "En vez de administrar tus ubicaciones de forma individual, nuestra Consola Empresarial te permite agruparlas, asignar accesos a tu equipo y ver cámaras desde un solo lugar."
    },
    {
      title: "Ahorrá tiempo",
      description: "Las notificaciones empresariales te permiten recibir alertas oportunas de varias ubicaciones a la vez, sin crear reglas individuales por cada comercio."
    },
    {
      title: "Enteráte primero sin estar allí",
      description: "Desde la web o tu aplicación móvil podrás ver un resumen del estado de todas tus ubicaciones, enterarte de aperturas y cierres fuera de horario y del estado del panel."
    },
    {
      title: "Organizá tus ubicaciones como prefieras",
      description: "Agrupá tus ubicaciones por zona geográfica, tipo de propiedad o departamento, para tener una operación ordenada y una gestión más ágil."
    },
    {
      title: "Vos decidís quién sí y quién no",
      description: "Asigná códigos de usuario a tus colaboradores para todas las ubicaciones y definí qué permisos tiene cada perfil dentro de la plataforma."
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

    const html = await response.text();
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

      const html = await response.text();
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

      const html = await response.text();
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

      const html = await response.text();
      container.innerHTML = html;

      const imageBase = getSiteAssetUrl(`components/${folder}/`);
      container.querySelectorAll("img").forEach((img) => {
        const currentSrc = img.getAttribute("src") || "";
        const fileName = currentSrc.split("/").pop();
        if (!fileName) return;
        img.src = imageBase + fileName;
      });

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

    const html = await response.text();
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

    const html = await response.text();
    container.innerHTML = html;

    await ensureSwiperResources();
    initKitsTienda(container);
  } catch (error) {
    console.error("Error cargando kits-tienda:", error);
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

    container.innerHTML = await response.text();

    const getPageSlug = (path) => {
      const cleanPath = String(path || "").split("?")[0].split("#")[0];
      const lastPart = cleanPath.split("/").filter(Boolean).pop() || "";
      return lastPart.replace(/\.html$/i, "").toLowerCase();
    };

    const slug = getPageSlug(window.location.pathname);

    const kitsBySlug = {
      "kit-cam-plus": {
        title: "Kit Cam+",
        subtitle: "Ideal para hogares y comercios.",
        price: "$ 89.999",
        installments: "6 cuotas sin interes",
        priceWithoutTax: "$ 74.379,34",
        planList: "$ 59.900",
        planSell: "$ 41.930",
        planPromo: "30% de descuento por 6 meses",
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
        includeFolder: "kit-cam-plus-que-incluye"
      },
      "kit-smart-1-1": {
        title: "Kit Smart 1.1",
        subtitle: "Ideal para hogares y comercios.",
        price: "$ 108.999",
        installments: "6 cuotas sin interes",
        priceWithoutTax: "$ 90.081,82",
        planList: "$ 61.900",
        planSell: "$ 43.399",
        planPromo: "30% de descuento por 6 meses",
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
        includeFolder: "kit-smart-1-1-que-incluye"
      },
      "kit-smart-2-2": {
        title: "Kit Smart 2.2",
        subtitle: "Ideal para hogares y comercios.",
        price: "$ 126.999",
        installments: "6 cuotas sin interes",
        priceWithoutTax: "$ 104.957,85",
        planList: "$ 65.900",
        planSell: "$ 46.130",
        planPromo: "30% de descuento por 6 meses",
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
        includeFolder: "kit-smart-2-2-que-incluye"
      },
      "kit-smart-cam-2-2": {
        title: "Kit Smart Cam 2.2",
        subtitle: "Ideal para hogares y comercios.",
        price: "$ 134.999",
        installments: "6 cuotas sin interes",
        priceWithoutTax: "$ 111.569,42",
        planList: "$ 66.900",
        planSell: "$ 46.830",
        planPromo: "30% de descuento por 6 meses",
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
        includeFolder: "kit-smart-cam-2-2-que-incluye"
      },
      "kit-industrial": {
        title: "Kit Industrial",
        subtitle: "Ideal para industrias y grandes superficies.",
        price: "$ 179.999",
        installments: "6 cuotas sin interes",
        priceWithoutTax: "$ 148.759,50",
        planList: "$ 79.900",
        planSell: "$ 55.930",
        planPromo: "30% de descuento por 6 meses",
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
        includeFolder: "kit-industrial-que-incluye"
      }
    };

    const kit = kitsBySlug[slug];
    if (!kit) return;

    const images = [
      {
        src: getSiteAssetUrl(`pages/tienda/${slug}.webp`),
        alt: `${kit.title} - vista principal`
      },
      {
        src: getSiteAssetUrl(`components/${kit.includeFolder}/tarjeta-1.png`),
        alt: `${kit.title} - item 1`
      },
      {
        src: getSiteAssetUrl(`components/${kit.includeFolder}/tarjeta-2.png`),
        alt: `${kit.title} - item 2`
      },
      {
        src: getSiteAssetUrl(`components/${kit.includeFolder}/tarjeta-3.png`),
        alt: `${kit.title} - item 3`
      },
      {
        src: getSiteAssetUrl(`components/${kit.includeFolder}/tarjeta-4.png`),
        alt: `${kit.title} - item 4`
      }
    ];

    const mainImage = container.querySelector("#kitProductoMainImage");
    const thumbs = container.querySelector("#kitProductoThumbs");
    const title = container.querySelector("#kitProductoTitle");
    const subtitle = container.querySelector("#kitProductoSubtitle");
    const price = container.querySelector("#kitProductoPrice");
    const installments = container.querySelector("#kitProductoInstallments");
    const priceWithoutTax = container.querySelector("#kitProductoPriceWithoutTax");
    const features = container.querySelector("#kitProductoFeatures");
    const includes = container.querySelector("#kitProductoIncludes");
    const planList = container.querySelector("#kitProductoPlanList");
    const planSell = container.querySelector("#kitProductoPlanSell");
    const planPromo = container.querySelector("#kitProductoPlanPromo");
    const qtyInput = container.querySelector("#kitProductoQtyInput");
    const qtyMinus = container.querySelector("#kitProductoQtyMinus");
    const qtyPlus = container.querySelector("#kitProductoQtyPlus");
    const mainCta = container.querySelector("#kitProductoMainCta");
    const adviceCta = container.querySelector("#kitProductoAdviceCta");

    if (!mainImage || !thumbs || !title || !subtitle || !price || !installments || !priceWithoutTax || !features || !includes || !planList || !planSell || !planPromo || !qtyInput || !qtyMinus || !qtyPlus || !mainCta || !adviceCta) {
      return;
    }

    title.textContent = kit.title;
    subtitle.textContent = kit.subtitle;
    price.textContent = kit.price;
    installments.textContent = kit.installments;
    priceWithoutTax.textContent = `Precio sin impuestos nacionales ${kit.priceWithoutTax}`;
    planList.textContent = kit.planList;
    planSell.textContent = kit.planSell;
    planPromo.textContent = kit.planPromo;

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

    function normalizeQuantity(value) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 1) return 1;
      return Math.floor(parsed);
    }

    qtyMinus.addEventListener("click", () => {
      qtyInput.value = String(Math.max(1, normalizeQuantity(qtyInput.value) - 1));
    });

    qtyPlus.addEventListener("click", () => {
      qtyInput.value = String(normalizeQuantity(qtyInput.value) + 1);
    });

    qtyInput.addEventListener("change", () => {
      qtyInput.value = String(normalizeQuantity(qtyInput.value));
    });

    const baseWhatsapp = "https://api.whatsapp.com/send?phone=541134245573";
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
      description: "Ideal para hogares y comercios.",
      price: "$ 89.999",
      installments: "6 cuotas sin interes",
      features: ["Monitoreo 24/7", "App SmartHome", "Recibe alertas", "Soporte tecnico"]
    },
    {
      id: "kit-smart-1-1",
      name: "KIT SMART 1.1",
      image: "kit-smart-1-1.webp",
      slug: "kit-smart-1-1",
      description: "Ideal para hogares y comercios.",
      price: "$ 108.999",
      installments: "6 cuotas sin interes",
      features: ["Monitoreo 24/7", "Personaliza codigos", "Arma/desarma con la App", "Recibe alertas"]
    },
    {
      id: "kit-smart-2-2",
      name: "KIT SMART 2.2",
      image: "kit-smart-2-2.webp",
      slug: "kit-smart-2-2",
      description: "Ideal para hogares y comercios.",
      price: "$ 126.999",
      installments: "6 cuotas sin interes",
      features: ["Monitoreo 24/7", "2 sensores + 2 controles", "Panel interactivo", "Recibe alertas"]
    },
    {
      id: "kit-smart-cam-2-2",
      name: "KIT SMART CAM 2.2",
      image: "kit-smart-cam-2-2.webp",
      slug: "kit-smart-cam-2-2",
      description: "Ideal para hogares y comercios.",
      price: "$ 134.999",
      installments: "6 cuotas sin interes",
      features: ["Monitoreo 24/7", "Camara incluida", "Panel interactivo", "Recibe alertas"]
    },
    {
      id: "kit-industrial",
      name: "KIT INDUSTRIAL",
      image: "kit-industrial.webp",
      slug: "kit-industrial",
      description: "Ideal para industrias y grandes superficies.",
      price: "$ 179.999",
      installments: "6 cuotas sin interes",
      features: ["Monitoreo 24/7", "Cobertura ampliada", "Panel interactivo", "Soporte tecnico"]
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
      const safePrice = String(kit.price || "");
      const safeInstallments = String(kit.installments || "");
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
    modalPrice.textContent = kit.price;
    modalInstallments.textContent = kit.installments;
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

    const html = await response.text();
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
