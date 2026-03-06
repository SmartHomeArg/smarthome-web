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
   NAVEGACIÓN
   ========================================================= */

function initNavigation() {

    if (!elementExists("header")) return;

    // Aquí se pueden agregar comportamientos del menú
    // Ejemplo: menú hamburguesa, scroll automático, etc

}

/* =========================================
   CARGA COMPONENTES GLOBALES
========================================= */

document.addEventListener("DOMContentLoaded", function () {
  cargarHeader();
  cargarHeroForm();
});

/* =========================================
   DETECTAR RUTA BASE
========================================= */

let basePath = "";

if (window.location.pathname.includes("/pages/")) {
  basePath = "../";
}


/* =========================================
   HEADER
========================================= */

function cargarHeader() {
  const enPages = window.location.pathname.includes('/pages/');
  const base = enPages ? '../' : '';

  fetch(base + 'components/header.html')
    .then(response => response.text())
    .then(data => {
      document.getElementById('header').innerHTML = data;

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
      document.getElementById('footer').innerHTML = data;

      const footerLogo = document.querySelector('.footer-brand img');
      if (footerLogo) {
        footerLogo.src = base + 'assets/img/logo.png';
      }
    })
    .catch(error => console.error('Error cargando footer:', error));
}

/* =========================================
   INICIALIZACION
========================================= */

document.addEventListener('DOMContentLoaded', () => {
  cargarHeader();
  cargarFooter();
});

/* =========================================================
   EFECTOS DE SCROLL
   ========================================================= */

function initScrollEffects() {

    window.addEventListener("scroll", handleHeaderOnScroll);

}


/**
 * Cambia estilo del header cuando se hace scroll
 */

function handleHeaderOnScroll() {

    const header = $("header");

    if (!header) return;

    if (window.scrollY > 50) {

        header.classList.add("scrolled");

    } else {

        header.classList.remove("scrolled");

    }

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

  } catch (error) {
    console.error("Error cargando hero-form.html:", error);
  }
}