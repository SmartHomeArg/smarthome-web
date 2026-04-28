/**
 * =========================================================
 * SmartHome Web - Global Analytics
 * Archivo: assets/js/analytics.js
 *
 * Capa centralizada de analitica comercial para el sitio.
 * - Compatible con sitios multipagina estaticos
 * - Sin dependencias externas
 * - Seguro ante ausencia de gtag
 * - Preparado para contenido dinamico
 * =========================================================
 */

(function () {
  "use strict";

  const ANALYTICS_ENABLED = window.SM_ANALYTICS_ENABLED ?? true;
  const DEBUG_ANALYTICS = window.SM_ANALYTICS_DEBUG ?? false;
  const GA_MEASUREMENT_ID = "G-77RYQCPCD4";

  const PAGE_SESSION_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const EVENT_NAMESPACE = "smarthome_analytics";

  const firedEvents = new Set();
  const trackedFormSubmissions = new WeakSet();
  const trackedClickElements = new WeakMap();
  const pageTimers = new Map();
  const performanceObserverEntries = {
    firstPaint: null,
    firstContentfulPaint: null
  };

  let scrollTrackingBound = false;
  let clickTrackingBound = false;
  let submitTrackingBound = false;
  let errorTrackingBound = false;
  let performanceTrackingBound = false;

  function debugLog(message, payload) {
    if (!DEBUG_ANALYTICS) return;
    if (typeof payload === "undefined") {
      console.log(`[Analytics] ${message}`);
      return;
    }
    console.log(`[Analytics] ${message}`, payload);
  }

  function isAnalyticsEnabled() {
    return Boolean(ANALYTICS_ENABLED);
  }

  function hasGtag() {
    return typeof window.gtag === "function";
  }

  function safeString(value) {
    if (value === null || typeof value === "undefined") return "";
    return String(value).trim();
  }

  function getElementText(element) {
    if (!element) return "";

    const ariaLabel = safeString(element.getAttribute?.("aria-label"));
    const text = safeString(element.textContent);
    const title = safeString(element.getAttribute?.("title"));
    const value = safeString(element.getAttribute?.("value"));

    return ariaLabel || text || title || value;
  }

  function getClassName(element) {
    if (!element) return "";
    if (typeof element.className === "string") return element.className.trim();
    return safeString(element.getAttribute?.("class"));
  }

  function getClosestSection(element) {
    if (!element || !(element instanceof Element)) return "unknown";

    const explicitSection = element.closest("[data-section]");
    if (explicitSection) {
      return safeString(explicitSection.getAttribute("data-section")) || "unknown";
    }

    const sectionById = element.closest("section[id]");
    if (sectionById) {
      return safeString(sectionById.id) || "unknown";
    }

    const landmark = element.closest("main, header, footer, nav, aside, form");
    if (landmark) {
      return safeString(landmark.id) || landmark.tagName.toLowerCase();
    }

    return "unknown";
  }

  function normalizeHref(href) {
    return safeString(href);
  }

  function getLinkUrl(element) {
    if (!element || !(element instanceof Element)) return null;

    const href = element.getAttribute("href");
    if (!href) return null;

    try {
      return new URL(href, window.location.href);
    } catch (error) {
      debugLog("URL invalida detectada", { href, error });
      return null;
    }
  }

  function getBaseEventParams() {
    return {
      measurement_id: GA_MEASUREMENT_ID,
      page_session_id: PAGE_SESSION_ID,
      page_title: document.title,
      page_path: window.location.pathname,
      page_location: window.location.href,
      hostname: window.location.hostname,
      language: navigator.language || "",
      screen_width: window.innerWidth,
      screen_height: window.innerHeight,
      timestamp: new Date().toISOString()
    };
  }

  function createEventKey(eventName, params) {
    return JSON.stringify({
      eventName,
      href: params?.href || "",
      id: params?.id || "",
      cta_name: params?.cta_name || "",
      form_id: params?.form_id || "",
      scroll_depth: params?.scroll_depth || "",
      engaged_seconds: params?.engaged_seconds || "",
      page_path: window.location.pathname
    });
  }

  function trackEvent(eventName, params = {}, options = {}) {
    const { once = false, dedupeKey = "" } = options;

    if (!isAnalyticsEnabled()) {
      debugLog(`Evento omitido por ANALYTICS_ENABLED=false: ${eventName}`, params);
      return false;
    }

    if (!hasGtag()) {
      debugLog(`gtag no disponible. Evento no enviado: ${eventName}`, params);
      return false;
    }

    const eventParams = {
      ...getBaseEventParams(),
      ...params
    };

    const uniqueKey = dedupeKey || (once ? createEventKey(eventName, eventParams) : "");
    if (uniqueKey && firedEvents.has(uniqueKey)) {
      debugLog(`Evento deduplicado: ${eventName}`, eventParams);
      return false;
    }

    if (uniqueKey) {
      firedEvents.add(uniqueKey);
    }

    window.gtag("event", eventName, eventParams);
    debugLog(`Evento enviado: ${eventName}`, eventParams);
    return true;
  }

  function markElementTracked(element, marker, cooldownMs = 800) {
    if (!element) return false;

    let markers = trackedClickElements.get(element);
    if (!markers) {
      markers = new Map();
      trackedClickElements.set(element, markers);
    }

    const now = Date.now();
    const lastTrackedAt = markers.get(marker) || 0;

    if (now - lastTrackedAt < cooldownMs) {
      return false;
    }

    markers.set(marker, now);
    return true;
  }

  function buildElementParams(element) {
    const href = normalizeHref(element?.getAttribute?.("href") || element?.href || "");

    return {
      href,
      anchor_text: getElementText(element),
      css_class: getClassName(element),
      id: safeString(element?.id),
      source_section: getClosestSection(element)
    };
  }

  function isWhatsappLink(url) {
    if (!url) return false;
    const value = url.href || url.toString();
    return /wa\.me|api\.whatsapp\.com|whatsapp:\/\//i.test(value);
  }

  function isPhoneLink(url) {
    return Boolean(url && /^tel:/i.test(url.href));
  }

  function isEmailLink(url) {
    return Boolean(url && /^mailto:/i.test(url.href));
  }

  function isOutboundLink(url) {
    if (!url) return false;
    if (!/^https?:$/i.test(url.protocol)) return false;
    return url.hostname !== window.location.hostname;
  }

  function getClickableTarget(target) {
    if (!(target instanceof Element)) return null;
    return target.closest("a, button, [data-cta]");
  }

  function trackCommercialClick(target) {
    if (!target) return;

    const clickable = getClickableTarget(target);
    if (!clickable) return;

    const url = getLinkUrl(clickable);
    const params = buildElementParams(clickable);

    if (url && isWhatsappLink(url)) {
      if (markElementTracked(clickable, "click_whatsapp")) {
        trackEvent("click_whatsapp", params);
      }
    }

    if (url && isPhoneLink(url)) {
      if (markElementTracked(clickable, "click_call")) {
        trackEvent("click_call", params);
      }
    }

    if (url && isEmailLink(url)) {
      if (markElementTracked(clickable, "click_email")) {
        trackEvent("click_email", params);
      }
    }

    if (url && isOutboundLink(url)) {
      const outboundKey = `outbound:${url.href}`;
      if (markElementTracked(clickable, outboundKey)) {
        trackEvent("outbound_click", {
          href: url.href,
          domain: url.hostname,
          anchor_text: params.anchor_text,
          css_class: params.css_class,
          id: params.id,
          source_section: params.source_section
        });
      }
    }

    const ctaElement = clickable.matches("[data-cta]") ? clickable : clickable.closest("[data-cta]");
    if (ctaElement) {
      const ctaValue = safeString(ctaElement.getAttribute("data-cta"));
      const ctaHref = normalizeHref(ctaElement.getAttribute("href") || ctaElement.href || "");
      const ctaKey = `cta:${ctaValue}:${ctaHref}:${getClosestSection(ctaElement)}`;

      if (markElementTracked(ctaElement, ctaKey)) {
        trackEvent("cta_click", {
          cta_name: ctaValue,
          text: getElementText(ctaElement),
          href: ctaHref,
          source_section: getClosestSection(ctaElement)
        });
      }
    }
  }

  function handleDocumentClick(event) {
    trackCommercialClick(event.target);
  }

  function handleFormSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (trackedFormSubmissions.has(form)) return;

    trackedFormSubmissions.add(form);

    const formAction = safeString(form.getAttribute("action")) || window.location.href;
    const formMethod = safeString(form.getAttribute("method")) || "get";

    trackEvent("lead_form_submit", {
      form_id: safeString(form.id),
      form_name: safeString(form.getAttribute("name")),
      action: formAction,
      method: formMethod.toLowerCase(),
      source_section: getClosestSection(form)
    });

    window.setTimeout(() => {
      trackedFormSubmissions.delete(form);
    }, 1200);
  }

  function getScrollProgress() {
    const scrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    );

    const scrollableHeight = Math.max(documentHeight - viewportHeight, 0);

    if (scrollableHeight === 0) {
      return documentHeight > 0 ? 100 : 0;
    }

    return Math.min(100, Math.max(0, Math.round((scrollTop / scrollableHeight) * 100)));
  }

  function getDocumentMetrics() {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    );

    return {
      viewportHeight,
      documentHeight,
      scrollableHeight: Math.max(documentHeight - viewportHeight, 0)
    };
  }

  function handleScrollDepth() {
    const thresholds = [25, 50, 75, 100];
    const progress = getScrollProgress();
    const { scrollableHeight } = getDocumentMetrics();

    if (scrollableHeight <= 0) {
      const key = `scroll_100:${window.location.pathname}`;
      if (!firedEvents.has(key)) {
        trackEvent("scroll_100", {
          scroll_depth: 100
        }, {
          dedupeKey: key
        });
      }
      return;
    }

    thresholds.forEach((threshold) => {
      const key = `scroll_${threshold}:${window.location.pathname}`;
      if (progress >= threshold && !firedEvents.has(key)) {
        trackEvent(`scroll_${threshold}`, {
          scroll_depth: threshold
        }, {
          dedupeKey: key
        });
      }
    });
  }

  function throttle(callback, wait) {
    let timeoutId = null;
    let lastExecution = 0;

    return function throttled() {
      const now = Date.now();
      const remaining = wait - (now - lastExecution);

      if (remaining <= 0) {
        lastExecution = now;
        callback();
        return;
      }

      if (timeoutId) return;

      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        lastExecution = Date.now();
        callback();
      }, remaining);
    };
  }

  function startEngagementTimers() {
    [30, 60, 120].forEach((seconds) => {
      const timeoutId = window.setTimeout(() => {
        trackEvent(`engaged_${seconds}s`, {
          engaged_seconds: seconds
        }, {
          dedupeKey: `engaged_${seconds}:${window.location.pathname}`
        });
      }, seconds * 1000);

      pageTimers.set(`engaged_${seconds}s`, timeoutId);
    });
  }

  function setupPerformanceObserver() {
    if (!("PerformanceObserver" in window)) return;

    try {
      const paintObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.name === "first-paint") {
            performanceObserverEntries.firstPaint = Math.round(entry.startTime);
          }

          if (entry.name === "first-contentful-paint") {
            performanceObserverEntries.firstContentfulPaint = Math.round(entry.startTime);
          }
        });
      });

      paintObserver.observe({
        type: "paint",
        buffered: true
      });
    } catch (error) {
      debugLog("No se pudo iniciar PerformanceObserver", error);
    }
  }

  function sendPerformanceMetrics() {
    if (!("performance" in window) || !performance.timing) return;

    const timing = performance.timing;
    const navigationStart = timing.navigationStart || 0;
    const domContentLoaded = timing.domContentLoadedEventEnd > 0
      ? Math.max(0, timing.domContentLoadedEventEnd - navigationStart)
      : null;
    const loadComplete = timing.loadEventEnd > 0
      ? Math.max(0, timing.loadEventEnd - navigationStart)
      : null;

    trackEvent("page_performance", {
      domContentLoaded,
      loadComplete,
      firstPaint: performanceObserverEntries.firstPaint,
      firstContentfulPaint: performanceObserverEntries.firstContentfulPaint
    }, {
      dedupeKey: `page_performance:${window.location.pathname}`
    });
  }

  function handleWindowError(message, source, lineno, colno, error) {
    trackEvent("javascript_error", {
      message: safeString(message),
      file: safeString(source),
      line: typeof lineno === "number" ? lineno : null,
      column: typeof colno === "number" ? colno : null,
      stack: safeString(error?.stack)
    });
  }

  function handleUnhandledRejection(event) {
    const reason = event?.reason;
    const message = typeof reason === "string"
      ? reason
      : safeString(reason?.message) || "Unhandled promise rejection";

    trackEvent("javascript_error", {
      message,
      file: "",
      line: null,
      column: null,
      stack: safeString(reason?.stack)
    });
  }

  function trackInitialPageContext() {
    const bodySection = safeString(document.body?.getAttribute("data-section")) || "body";
    trackEvent("page_context_ready", {
      event_namespace: EVENT_NAMESPACE,
      body_section: bodySection,
      referrer: document.referrer || "",
      viewport: `${window.innerWidth}x${window.innerHeight}`
    }, {
      dedupeKey: `page_context_ready:${window.location.pathname}`
    });
  }

  function bindClickTracking() {
    if (clickTrackingBound) return;
    clickTrackingBound = true;
    document.addEventListener("click", handleDocumentClick, true);
  }

  function bindFormTracking() {
    if (submitTrackingBound) return;
    submitTrackingBound = true;
    document.addEventListener("submit", handleFormSubmit, true);
  }

  function bindScrollTracking() {
    if (scrollTrackingBound) return;
    scrollTrackingBound = true;
    const throttledScrollHandler = throttle(handleScrollDepth, 250);
    window.addEventListener("scroll", throttledScrollHandler, { passive: true });
    window.addEventListener("resize", throttledScrollHandler, { passive: true });
    throttledScrollHandler();
  }

  function bindErrorTracking() {
    if (errorTrackingBound) return;
    errorTrackingBound = true;
    window.addEventListener("error", function (event) {
      handleWindowError(event.message, event.filename, event.lineno, event.colno, event.error);
    });
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
  }

  function bindPerformanceTracking() {
    if (performanceTrackingBound) return;
    performanceTrackingBound = true;
    setupPerformanceObserver();
    window.addEventListener("load", function () {
      window.setTimeout(sendPerformanceMetrics, 0);
    }, { once: true });
  }

  function clearTimersOnPageHide() {
    window.addEventListener("pagehide", function () {
      pageTimers.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      pageTimers.clear();
    }, { once: true });
  }

  function initAnalytics() {
    debugLog("Inicializando analytics", {
      analyticsEnabled: ANALYTICS_ENABLED,
      debugEnabled: DEBUG_ANALYTICS,
      measurementId: GA_MEASUREMENT_ID,
      pageSessionId: PAGE_SESSION_ID
    });

    if (!isAnalyticsEnabled()) return;

    bindClickTracking();
    bindFormTracking();
    bindScrollTracking();
    bindErrorTracking();
    bindPerformanceTracking();
    clearTimersOnPageHide();
    startEngagementTimers();
    trackInitialPageContext();
  }

  initAnalytics();
})();
