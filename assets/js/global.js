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
  const areaInput = document.getElementById('lead-area');
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

  if (areaInput) {
    areaInput.addEventListener('input', function () {
      this.value = onlyDigits(this.value).slice(0, 5);
    });
  }

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

    [nombreInput, areaInput, telefonoInput, provinciaInput, emailInput].forEach(clearFieldError);
    showMessage('', '');

    const nombre = nombreInput ? nombreInput.value.trim() : '';
    const area = areaInput ? onlyDigits(areaInput.value) : '';
    const telefono = telefonoInput ? onlyDigits(telefonoInput.value) : '';
    const provincia = provinciaInput ? provinciaInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';

    if (nombre.length < 3) {
      setFieldError(nombreInput);
      isValid = false;
    }

    if (area.length < 2 || area.length > 5) {
      setFieldError(areaInput);
      isValid = false;
    }

    if (telefono.length < 6 || telefono.length > 10) {
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
      area: areaInput ? onlyDigits(areaInput.value) : '',
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