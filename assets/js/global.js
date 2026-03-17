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

document.addEventListener("DOMContentLoaded", function () {
  cargarHeader();
  cargarFooter();
  cargarHeroForm();
  cargarContactateHome();
  cargarWhatsappFloat();
  cargarZonasProteccionHogar();

});


/* =========================================
   HEADER
========================================= */

function cargarHeader() {
  const enPages = window.location.pathname.includes('/pages/');
  const base = enPages ? '../' : '';

  fetch(base + 'components/header.html')
    .then(response => response.text())
    .then(data => {
      const headerEl = document.getElementById('header');
      if (headerEl) headerEl.innerHTML = data;

      const logo = document.querySelector('.navbar-brand img');
      if (logo) {
        logo.src = base + 'assets/img/logo.png';
      }

      const brandLink = document.querySelector('.navbar-brand');
      if (brandLink) {
        brandLink.href = base + 'index.html';
      }

      document.querySelectorAll('.menu-principal a').forEach(link => {
        const href = link.getAttribute('href');

        if (!href || href.startsWith('#') || href.startsWith('http')) return;

        if (enPages) {
          if (href.startsWith('pages/')) {
            link.href = '../' + href;
          } else {
            link.href = base + href;
          }
        } else {
          link.href = href;
        }
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
  const enPages = window.location.pathname.includes('/pages/');
  const base = enPages ? '../' : '';

  fetch(base + 'components/footer.html')
    .then(response => response.text())
    .then(data => {
      const footerEl = document.getElementById('footer');
      if (footerEl) footerEl.innerHTML = data;
      const footerLogo = document.querySelector('.footer-brand img');
      if (footerLogo) {
        footerLogo.src = base + 'assets/img/logo-blanco.png';
      }
    })
    .catch(error => console.error('Error cargando footer:', error));
}

/* =========================================================
   FORMULARIO GLOBAL DEL HERO
   Carga el componente hero-form.html en la página actual
   y asigna automáticamente el origen del lead.
========================================================= */

async function cargarHeroForm() {
  const heroFormContainer = document.getElementById("hero-form-container");

  /* Si la página no tiene contenedor, no hacemos nada */
  if (!heroFormContainer) return;

  try {
    /* Detecta si estamos en index o dentro de /pages */
    const isInPagesFolder = window.location.pathname.includes("/pages/");
    const formPath = isInPagesFolder
      ? "../components/hero-form.html"
      : "components/hero-form.html";

    /* Trae el HTML del formulario */
    const response = await fetch(formPath);

    if (!response.ok) {
      throw new Error(`No se pudo cargar el formulario: ${response.status}`);
    }

    const formHTML = await response.text();
    heroFormContainer.innerHTML = formHTML;

    /* Toma el origen desde el data attribute del contenedor */
    const origen = heroFormContainer.dataset.origen || "desconocido";

    /* Completa el input hidden del formulario */
    const origenInput = document.getElementById("lead-origen");
    if (origenInput) {
      origenInput.value = origen;
    }

    /* Inicializa la lógica del formulario una vez que el HTML ya fue insertado */
    initHeroLeadForm();

  } catch (error) {
    console.error("Error cargando hero-form.html:", error);
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

(function () {
  const sliderElement = document.getElementById("plansHomeSlider");

  if (!sliderElement || typeof Swiper === "undefined") return;

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

})();

/* =========================================================
   SECCION FUNCIONALIDADES HOME
========================================================= */

(function () {
  const sliderElement = document.getElementById("funcionalidadesHomeSlider");

  if (!sliderElement || typeof Swiper === "undefined") return;

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
})();

/* =========================================
   CONTACTATE HOME
========================================= */

function cargarContactateHome() {
  const placeholder = document.getElementById("contactate-home-placeholder");
  if (!placeholder) return;

  fetch("components/contactate-home.html")
    .then(response => response.text())
    .then(data => {
      placeholder.innerHTML = data;
    })
    .catch(error => {
      console.error("Error al cargar contactate-home:", error);
    });
}

/* =========================================
   BOTON FLOTANTE DE WHATSAPP
========================================= */

function cargarWhatsappFloat() {
  const contenedor = document.getElementById("whatsapp-float-container");
  if (!contenedor) return;

  const rutaBase = window.location.pathname.includes("/pages/") ? "../" : "./";

  fetch(`${rutaBase}components/whatsapp-float.html`)
    .then(response => response.text())
    .then(data => {
      contenedor.innerHTML = data;

      const imagen = contenedor.querySelector("img");
      if (imagen) {
        imagen.src = `${rutaBase}assets/img/whatsapp-logo.png`;
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
      toggle.addEventListener('touchend', handler, false);
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

    // Detectar scroll / gestures que indican intención de interacción fuera
    const closeOnScrollOrTouch = () => {
      if (isOpen()) closeMenu();
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
  const container = document.getElementById("zonas-proteccion-hogar-container");
  if (!container) return;

  try {
    const enPages = window.location.pathname.includes("/pages/");
    const rutaComponente = enPages
      ? "../components/zonas-proteccion-hogar.html"
      : "components/zonas-proteccion-hogar.html";

    const response = await fetch(rutaComponente);

    if (!response.ok) {
      throw new Error("No se pudo cargar el componente zonas-proteccion-hogar.html");
    }

    const html = await response.text();
    container.innerHTML = html;

    initZonasProteccionHogar();
  } catch (error) {
    console.error("Error al cargar la sección zonas-proteccion-hogar:", error);
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

function initZonasProteccionHogar() {
  // ============================================================
  // PASO 1: OBTENER ELEMENTOS DEL DOM
  // ============================================================
  
  const section = document.querySelector(".zonas-proteccion-hogar");
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
  
  const enPages = window.location.pathname.includes("/pages/");
  const imageBasePath = enPages ? "../assets/img/" : "assets/img/";

  if (mainImage) {
    mainImage.src = imageBasePath + "escena-hogar.png";
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
    productImage.src = imageBasePath + currentItem.image;
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