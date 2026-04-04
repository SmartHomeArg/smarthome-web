/**
 * Smarthome Chat IA - Backend Apps Script
 * Fase 3 base operativa
 *
 * Endpoints:
 * - doGet: health check
 * - doPost: procesa mensajes de chat
 *
 * Dependencias de Script Properties:
 * - DOC_INSTRUCCIONES_ID
 * - DOC_CONOCIMIENTO_ID
 * - DOC_EVENTOS_ID
 * - SHEET_CONFIG_ID
 * - SHEET_OPERACION_ID
 * - ALERT_EMAIL
 * - GEMINI_API_KEY (opcional)
 * - GEMINI_MODEL (opcional, ej: gemini-2.5-flash)
 * - FORMS_WEBAPP_URL (opcional)
 */

const CHAT_VERSION = '1.0.0';

const OP_SHEETS = {
  CHAT_LOGS: 'chat_logs',
  EVENTOS: 'eventos_chat',
  ERRORES: 'errores_chat',
  LEADS: 'leads_precalificados'
};

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const wantsChat = String(params.action || '').toLowerCase() === 'chat';

  if (!wantsChat) {
    return jsonResponse_({
      ok: true,
      service: 'smarthome-chat-ia',
      version: CHAT_VERSION,
      timestamp: new Date().toISOString()
    });
  }

  const result = processChatRequest_({
    sessionId: params.sessionId || '',
    message: params.message || '',
    sourcePage: params.sourcePage || '',
    userAgent: params.userAgent || 'browser',
    chatHistory: parseChatHistoryParam_(params.chatHistory || '')
  });

  const callback = cleanJsonpCallback_(params.callback || '');
  if (callback) {
    return jsResponse_(callback + '(' + JSON.stringify(result) + ');');
  }

  return jsonResponse_(result);
}

function doPost(e) {
  const payload = getRequestData_(e);
  const result = processChatRequest_(payload);
  return jsonResponse_(result);
}

function processChatRequest_(payload) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    lockAcquired = lock.tryLock(1000);

    const props = getScriptProps_();
    const cfg = loadRuntimeConfig_(props);

    const ctx = buildContext_(payload, cfg);
    validateInput_(ctx, cfg);

    const signal = detectCommercialSignal_(ctx.userMessage);
    const leadScore = scoreLead_(signal, ctx, cfg);
    const leadStatus = classifyLeadStatus_(leadScore, cfg);

    const botReplyResult = buildBotReply_(ctx, signal, props, cfg);

    const eventList = buildEvents_(signal, leadScore, leadStatus, botReplyResult, ctx, cfg);
    const resumen = buildConversationSummary_(ctx, signal, leadScore, leadStatus);

    writeChatLog_(ctx, botReplyResult.replyText, signal.intent, leadScore, leadStatus, cfg);
    writeEvents_(ctx.sessionId, eventList);
    writeLeadPrequal_(ctx, signal, leadScore, leadStatus, resumen, cfg);

    handleAlerts_(eventList, ctx, leadScore, props, cfg);

    const syncResult = maybeSyncLeadToForms_(ctx, signal, leadScore, leadStatus, props, cfg);

    return {
      ok: true,
      reply: botReplyResult.replyText,
      mode: botReplyResult.mode,
      data: {
        sessionId: ctx.sessionId,
        intent: signal.intent,
        leadScore: leadScore,
        leadStatus: leadStatus,
        canDeriveToAdvisor: leadStatus !== 'frio',
        syncedToOfficialLeads: syncResult.synced,
        syncDetail: syncResult.detail
      }
    };
  } catch (err) {
    const msg = (err && err.message) ? String(err.message) : String(err);
    writeErrorSafe_(null, 'runtime_error', msg, 'n/a', false);

    return {
      ok: false,
      message: msg || 'Error interno en chat IA'
    };
  } finally {
    if (lockAcquired) {
      try {
        lock.releaseLock();
      } catch (_ignored) {}
    }
  }
}

function parseChatHistoryParam_(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch (_err) {
    return [];
  }
}

function cleanJsonpCallback_(value) {
  const cb = String(value || '').trim();
  if (!cb) return '';
  if (!/^[a-zA-Z_$][0-9a-zA-Z_$\.]{0,120}$/.test(cb)) return '';
  return cb;
}

function getScriptProps_() {
  const p = PropertiesService.getScriptProperties();
  const obj = {
    DOC_INSTRUCCIONES_ID: p.getProperty('DOC_INSTRUCCIONES_ID') || '',
    DOC_CONOCIMIENTO_ID: p.getProperty('DOC_CONOCIMIENTO_ID') || '',
    DOC_EVENTOS_ID: p.getProperty('DOC_EVENTOS_ID') || '',
    SHEET_CONFIG_ID: p.getProperty('SHEET_CONFIG_ID') || '',
    SHEET_OPERACION_ID: p.getProperty('SHEET_OPERACION_ID') || '',
    ALERT_EMAIL: p.getProperty('ALERT_EMAIL') || '',
    GEMINI_API_KEY: p.getProperty('GEMINI_API_KEY') || '',
    GEMINI_MODEL: p.getProperty('GEMINI_MODEL') || 'gemini-2.5-flash',
    FORMS_WEBAPP_URL: p.getProperty('FORMS_WEBAPP_URL') || ''
  };

  const required = ['DOC_INSTRUCCIONES_ID', 'DOC_CONOCIMIENTO_ID', 'DOC_EVENTOS_ID', 'SHEET_CONFIG_ID', 'SHEET_OPERACION_ID', 'ALERT_EMAIL'];
  required.forEach(function(k) {
    if (!obj[k]) throw new Error('Falta Script Property: ' + k);
  });

  return obj;
}

function loadRuntimeConfig_(props) {
  const cfgSheet = SpreadsheetApp.openById(props.SHEET_CONFIG_ID).getSheets()[0];
  const rows = cfgSheet.getDataRange().getValues();

  const kv = {};
  for (var i = 1; i < rows.length; i++) {
    const key = cleanText_(rows[i][0]);
    const valueRaw = rows[i][1];
    if (!key) continue;
    kv[key] = normalizeConfigValue_(valueRaw);
  }

  return {
    version: cleanText_(kv.version || CHAT_VERSION),
    emailDestinoAlertas: cleanText_(kv.email_destino_alertas || props.ALERT_EMAIL),
    umbralLeadCaliente: toNumber_(kv.umbral_lead_caliente, 70),
    scorePideCotizacion: toNumber_(kv.score_pide_cotizacion, 25),
    scoreDeclaraUrgencia: toNumber_(kv.score_declara_urgencia, 20),
    scoreContactoValido: toNumber_(kv.score_contacto_valido, 25),
    scoreConfirmaInstalacion: toNumber_(kv.score_confirma_instalacion, 15),
    scoreAceptaContactoAsesor: toNumber_(kv.score_acepta_contacto_asesor, 15),
    fallbackModoFaqActivo: toBool_(kv.fallback_modo_faq_activo, true),
    fallbackPermitirCapturaLead: toBool_(kv.fallback_permitir_captura_lead, true),
    mensajeFallbackUsuario: cleanText_(kv.mensaje_fallback_usuario || 'Puedo ayudarte con informacion general y derivarte a un asesor.'),
    maxCaracteresPregunta: toNumber_(kv.max_caracteres_pregunta, 700),
    telefonoMinDigitos: toNumber_(kv.telefono_min_digitos, 8),
    requerirConsentimiento: toBool_(kv.requerir_consentimiento, true),
    alertaCuotaCooldownMin: toNumber_(kv.alerta_cuota_cooldown_min, 360)
  };
}

function buildContext_(payload, cfg) {
  const lead = payload.leadData || {};

  return {
    sessionId: cleanText_(payload.sessionId) || ('sess_' + Utilities.getUuid().slice(0, 8)),
    userMessage: cleanText_(payload.message),
    sourcePage: cleanText_(payload.sourcePage),
    userAgent: cleanText_(payload.userAgent),
    chatHistory: normalizeChatHistory_(payload.chatHistory),
    consent: toBool_(lead.consentimientoContacto, false),
    lead: {
      nombre: cleanText_(lead.nombre),
      telefono: onlyDigits_(lead.telefono),
      email: cleanText_(lead.email).toLowerCase(),
      tipoCliente: cleanText_(lead.tipoCliente).toLowerCase(),
      localidad: cleanText_(lead.localidad),
      interes: cleanText_(lead.interes),
      urgencia: cleanText_(lead.urgencia).toLowerCase(),
      franjaHoraria: cleanText_(lead.franjaHoraria)
    },
    timestamp: new Date().toISOString(),
    cfg: cfg
  };
}

function normalizeChatHistory_(historyRaw) {
  if (!Array.isArray(historyRaw)) return [];

  return historyRaw
    .slice(-8)
    .map(function(item) {
      return {
        role: cleanText_(item && item.role),
        text: cleanText_(item && item.text)
      };
    })
    .filter(function(item) {
      return (item.role === 'user' || item.role === 'bot') && !!item.text;
    });
}

function formatHistoryForPrompt_(history) {
  if (!history || !history.length) return 'Sin historial previo.';

  return history
    .map(function(item) {
      const roleLabel = item.role === 'user' ? 'CLIENTE' : 'ASESOR';
      return roleLabel + ': ' + item.text;
    })
    .join('\n');
}

function validateInput_(ctx, cfg) {
  if (!ctx.userMessage) throw new Error('El campo message es obligatorio');
  if (ctx.userMessage.length > cfg.maxCaracteresPregunta) {
    throw new Error('Tu mensaje supera el maximo permitido de ' + cfg.maxCaracteresPregunta + ' caracteres');
  }

  if (ctx.lead.tipoCliente && ['hogar', 'comercio'].indexOf(ctx.lead.tipoCliente) === -1) {
    throw new Error('tipoCliente invalido. Valores permitidos: hogar, comercio');
  }
}

function detectCommercialSignal_(text) {
  const t = String(text || '').toLowerCase();

  const hasQuote = /(precio|cotiza|cotizacion|presupuesto|cuanto sale|valor|plan)/.test(t);
  const hasUrgency = /(hoy|urgente|esta semana|ya|cuanto antes|rapido)/.test(t);
  const hasInstallIntent = /(instalar|instalacion|contratar|quiero contratar|quiero poner)/.test(t);
  const asksAdvisor = /(asesor|llamenme|llamame|contactenme|me contactan)/.test(t);

  let intent = 'info';
  if (hasQuote) intent = 'cotizacion';
  if (hasInstallIntent || /(comprar|quiero avanzar|cerrar)/.test(t)) intent = 'compra';

  return {
    intent: intent,
    hasQuote: hasQuote,
    hasUrgency: hasUrgency,
    hasInstallIntent: hasInstallIntent,
    asksAdvisor: asksAdvisor
  };
}

function scoreLead_(signal, ctx, cfg) {
  var score = 0;
  if (signal.hasQuote) score += cfg.scorePideCotizacion;
  if (signal.hasUrgency) score += cfg.scoreDeclaraUrgencia;

  if (hasValidContact_(ctx, cfg)) score += cfg.scoreContactoValido;
  if (signal.hasInstallIntent) score += cfg.scoreConfirmaInstalacion;
  if (signal.asksAdvisor) score += cfg.scoreAceptaContactoAsesor;

  return Math.max(0, Math.min(100, score));
}

function classifyLeadStatus_(score, cfg) {
  if (score >= cfg.umbralLeadCaliente) return 'caliente';
  if (score >= 40) return 'tibio';
  return 'frio';
}

function buildBotReply_(ctx, signal, props, cfg) {
  const docs = readKnowledgeDocs_(props);
  const historyText = formatHistoryForPrompt_(ctx.chatHistory);

  const prompt = [
    docs.instructions,
    '\n\nCONOCIMIENTO:\n',
    docs.knowledge,
    '\n\nEVENTOS:\n',
    docs.events,
    '\n\nHISTORIAL RECIENTE:\n',
    historyText,
    '\n\nMENSAJE CLIENTE:\n',
    ctx.userMessage,
    '\n\nDATOS LEAD PARCIALES:\n',
    JSON.stringify(ctx.lead),
    '\n\nINTENCION DETECTADA: ', signal.intent,
    '\n\nREGLAS DE RESPUESTA:',
    '\n- No te vuelvas a presentar si ya hay historial.',
    '\n- No repitas saludo inicial en cada turno.',
    '\n- Responde en espanol, maximo 120 palabras.',
    '\n- Evita frases de relleno como "hola de nuevo" o "estoy aqui para ayudarte" si no aportan informacion.',
    '\n- Si ya hay historial, no saludes.',
    '\n- No cierres con frases incompletas (ej: "para poder").',
    '\n- Evita frases de relleno como "hola de nuevo" o "estoy aqui para ayudarte" si no aportan informacion.',
    '\n- Escribe en tono humano y natural, sin formato markdown.',
    '\n- No uses asteriscos, ni listas con guiones, ni encabezados tipo "Info util".',
    '\n- Da una respuesta util y luego 1 pregunta puntual para avanzar comercialmente.',
    '\n- Si piden alarma sin mas datos, pregunta si es para hogar o comercio y cantidad aproximada de ambientes o accesos.'
  ].join('');

  if (props.GEMINI_API_KEY) {
    try {
      const text = callGemini_(prompt, props.GEMINI_API_KEY, props.GEMINI_MODEL);
      return { mode: 'ia', replyText: postProcessReply_(text, ctx) };
    } catch (err) {
      const errMsg = String(err);
      const providerCode = detectProviderCode_(errMsg);
      writeErrorSafe_(ctx.sessionId, 'ia_provider_error', errMsg, providerCode, true);

      if (cfg.fallbackModoFaqActivo) {
        return {
          mode: 'fallback_faq',
          replyText: buildFaqFallbackReply_(ctx, signal, docs.knowledge, cfg)
        };
      }

      throw err;
    }
  }

  return {
    mode: 'fallback_faq',
    replyText: buildFaqFallbackReply_(ctx, signal, docs.knowledge, cfg)
  };
}

function readKnowledgeDocs_(props) {
  return {
    instructions: DocumentApp.openById(props.DOC_INSTRUCCIONES_ID).getBody().getText(),
    knowledge: DocumentApp.openById(props.DOC_CONOCIMIENTO_ID).getBody().getText(),
    events: DocumentApp.openById(props.DOC_EVENTOS_ID).getBody().getText()
  };
}

function callGemini_(prompt, apiKey, modelName) {
  const model = cleanText_(modelName) || 'gemini-2.5-flash';
  const url = 'https://generativelanguage.googleapis.com/v1/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 500
    }
  };

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  const txt = res.getContentText() || '';

  if (code < 200 || code >= 300) {
    throw new Error('Gemini HTTP ' + code + ': ' + txt.slice(0, 600));
  }

  const data = JSON.parse(txt);
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  const output = Array.isArray(parts)
    ? parts.map(function(p) { return p && p.text ? String(p.text) : ''; }).join('')
    : '';

  if (!output) throw new Error('Respuesta vacia de Gemini');

  return String(output).trim();
}

function postProcessReply_(text, ctx) {
  let out = cleanText_(text);
  if (!out) return 'Puedo ayudarte con una recomendacion concreta. Es para hogar o comercio?';

  // Limpiar restos de markdown para que suene a chat humano.
  out = out
    .replace(/\*\*/g, '')
    .replace(/__+/g, '')
    .replace(/`+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (ctx && ctx.chatHistory && ctx.chatHistory.length > 0) {
    out = out.replace(/^\s*[¡!]*\s*(hola|hola de nuevo|buenas|buen dia|buenas tardes|buenas noches)[\s!,.:;-]*/i, '');
    out = cleanText_(out);
  }

  // Reparaciones puntuales de cortes frecuentes observados en produccion.
  out = out.replace(/si buscas seguridad para tu hogar\.$/i, 'si buscas seguridad para tu hogar o para tu comercio?');
  out = out.replace(/base de alarma, sire\.$/i, 'base de alarma, sirena y sensores para proteger accesos clave.');

  // Si termina con palabras de enlace o fragmentos demasiado cortos, completar con una pregunta util.
  if (/(para|con|de|y|o|si|que|en|por|como|tu|su)\.$/i.test(out) || /,\s*[a-zA-Z]{1,7}\.$/.test(out)) {
    const hasTipo = !!(ctx && ctx.lead && ctx.lead.tipoCliente);
    if (hasTipo) {
      out = out.replace(/\.?$/, '') + '. Para avanzar, decime cuantos accesos o ambientes queres cubrir?';
    } else {
      out = out.replace(/\.?$/, '') + '. Para avanzar, es para hogar o comercio y cuantos accesos o ambientes queres cubrir?';
    }
  }

  // Si la respuesta termina en frase incompleta, completar con pregunta comercial util.
  if (/(para poder|para ayudarte|necesito saber|necesito|para recomendarte)\.?$/i.test(out)) {
    const hasTipo = !!(ctx && ctx.lead && ctx.lead.tipoCliente);
    if (hasTipo) {
      out = out.replace(/\.?$/,'') + ', decime aproximadamente cuantos ambientes o accesos queres cubrir?';
    } else {
      out = out.replace(/\.?$/,'') + ', es para hogar o comercio y cuantos ambientes o accesos queres cubrir?';
    }
  }

  // Evitar finales tipo ",." o ":." generados por post-proceso sobre texto incompleto.
  out = out.replace(/[,:;]+\.$/, '.');

  // Completar nombres de kit comunes si quedaron truncados por el modelo.
  out = out.replace(/\bKit Smart 1\.(?!\d)/g, 'Kit Smart 1.1');
  out = out.replace(/\bKit Smart 2\.(?!\d)/g, 'Kit Smart 2.2');

  if (!/[.!?]$/.test(out)) {
    out += '.';
  }

  if (out.length < 24) {
    out += ' Es para hogar o comercio?';
  }

  // Normalizar espacios y duplicados de puntuacion residuales.
  out = out.replace(/\s{2,}/g, ' ').replace(/([!?.,])\1+/g, '$1').trim();

  return out;
}

function buildFaqFallbackReply_(ctx, signal, knowledgeText, cfg) {
  const userText = String(ctx.userMessage || '').toLowerCase();
  const hasHistory = !!(ctx && ctx.chatHistory && ctx.chatHistory.length);

  if (isTruncationComplaint_(userText)) {
    const lastBot = getLastBotMessage_(ctx);
    if (lastBot) {
      return 'Gracias por avisar. Te lo repito claro: ' + ensureEndsWithQuestionOrDot_(lastBot);
    }
    return 'Gracias por avisar. Retomemos bien: es para hogar o comercio y cuantos accesos o ambientes queres cubrir?';
  }

  if (isStopIntent_(userText)) {
    return 'Entiendo, no hay problema. Si mas adelante quieres retomar, aqui estoy para ayudarte con kits, planes y cotizacion.';
  }

  if (isGreetingOnly_(userText) && !hasHistory) {
    return 'Hola, soy el asistente de SmartHome. Te puedo ayudar a elegir kit, plan y cotizacion segun tu caso. Si quieres, empezamos por esto: es para hogar o comercio?';
  }

  if (isConfusionTurn_(userText)) {
    return 'Buena pregunta. Te ayudo a elegir una opcion de seguridad segun tu caso y presupuesto. Para orientarte bien, confirmame si es para hogar o comercio.';
  }

  if (isFrustrationTurn_(userText)) {
    return 'Tenes razon, vamos simple y sin vueltas. Decime solo esto: es para hogar o comercio, y con eso te doy una recomendacion puntual.';
  }

  if (isOutOfScopeQuestion_(userText)) {
    return 'Puedo ayudarte con seguridad para hogar o comercio (alarmas, camaras, monitoreo y cotizacion). Si quieres, te asesoro con una opcion concreta para tu caso.';
  }

  const inferredType = inferClientType_(ctx);
  const inferredCoverage = inferCoverageNeed_(ctx);

  if (/(precio|cuanto sale|cuanto cuesta|valor|costo|sale\?)/.test(userText)) {
    if (!inferredType) {
      return 'Claro. Para cotizarte bien, decime si es para hogar o comercio y cuantos accesos o ambientes queres cubrir.';
    }
    if (!inferredCoverage) {
      return 'Perfecto. Para darte un valor estimado, necesito cuantos accesos o ambientes queres cubrir y en que localidad seria la instalacion.';
    }
    return 'Perfecto. Con esos datos te preparo una cotizacion estimada. Decime tu localidad y, si queres, un telefono de contacto para derivarte con un asesor.';
  }

  // Flujo guiado deterministico para evitar respuestas repetidas o ambiguas.
  if (!inferredType) {
    return avoidRepeatedBotReply_('Para recomendarte bien necesito un dato: es para hogar o comercio?', ctx);
  }

  if (!inferredCoverage) {
    if (inferredType === 'comercio') {
      return avoidRepeatedBotReply_('Excelente, para comercio. Para recomendarte bien, decime aproximadamente cuantos accesos o ambientes queres cubrir.', ctx);
    }
    return avoidRepeatedBotReply_('Genial, para hogar. Para recomendarte bien, decime aproximadamente cuantos ambientes o accesos queres cubrir.', ctx);
  }

  const deterministic = buildDeterministicRecommendation_(inferredType, inferredCoverage, signal.intent);
  const safeReply = avoidRepeatedBotReply_(deterministic, ctx);
  if (safeReply) return safeReply;

  const brief = extractRelevantKnowledge_(ctx.userMessage, knowledgeText);
  const cta = buildFallbackCta_(ctx, signal, inferredType);

  return avoidRepeatedBotReply_([brief, ' ', cta].join('').replace(/\s{2,}/g, ' ').trim(), ctx);
}

function extractRelevantKnowledge_(query, text) {
  const q = String(query || '').toLowerCase();
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(function(line) {
      return String(line || '')
        .replace(/^\s*[-*]+\s*/,'')
        .replace(/^\s*-\s*-\s*/, '')
        .replace(/^\s*\d+\)\s*/, '')
        .trim();
    })
    .filter(function(line) {
      if (!line) return false;
      if (/^\[[^\]]+\]$/.test(line)) return false;
      if (line.length < 8) return false;
      return true;
    });

  const scored = lines.map(function(line) {
    const l = line.toLowerCase();
    var score = 0;
    if (/kit|plan|monitoreo|camara|alarma|comercio|hogar/.test(l)) score += 1;
    if (q && l.indexOf(q.split(' ')[0]) !== -1) score += 2;
    if (q && /precio|cotiz|plan|kit/.test(q) && /precio|plan|kit/.test(l)) score += 2;
    return { line: line, score: score };
  });

  scored.sort(function(a, b) { return b.score - a.score; });
  const top = scored.filter(function(s) { return s.score > 0; }).slice(0, 2).map(function(s) { return normalizeKnowledgeLine_(s.line); });

  if (!top.length) return 'Te ayudo a elegir una opcion de seguridad segun tu necesidad y presupuesto.';
  return top.join(' ');
}

function normalizeKnowledgeLine_(line) {
  const t = String(line || '')
    .replace(/^Segmento:\s*/i, 'Trabajamos para ')
    .replace(/^Propuesta:\s*/i, 'La propuesta incluye ')
    .replace(/^Nota:\s*/i, '')
    .replace(/^No,\s*/i, '')
    .trim();

  if (!t) return '';
  return /[.!?]$/.test(t) ? t : (t + '.');
}

function buildFallbackCta_(ctx, signal, inferredType) {
  if (!inferredType) {
    return 'Si te parece, empezamos por lo básico: es para hogar o comercio?';
  }

  if (signal.intent === 'cotizacion' || signal.intent === 'compra') {
    return 'Si queres, avanzamos con una cotizacion estimada: decime cuantos accesos o ambientes queres cubrir.';
  }

  return 'Si queres, te recomiendo el kit y plan mas conveniente para tu caso.';
}

function inferClientType_(ctx) {
  if (ctx && ctx.lead && (ctx.lead.tipoCliente === 'hogar' || ctx.lead.tipoCliente === 'comercio')) {
    return ctx.lead.tipoCliente;
  }

  const fromCurrent = detectTypeInText_(ctx && ctx.userMessage);
  if (fromCurrent) return fromCurrent;

  const history = (ctx && ctx.chatHistory) || [];
  for (var i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== 'user' && history[i].role !== 'bot') continue;
    const t = detectTypeInText_(history[i].text);
    if (t) return t;
  }

  return '';
}

function detectTypeInText_(text) {
  const t = String(text || '').toLowerCase();
  if (/\bcomercio\b|\bcomercial\b|\blocal\b|\bnegocio\b/.test(t)) return 'comercio';
  if (/\bhogar\b|\bcasa\b|\bdepartamento\b/.test(t)) return 'hogar';
  return '';
}

function inferCoverageNeed_(ctx) {
  const candidates = [];
  candidates.push(String((ctx && ctx.userMessage) || ''));

  const history = (ctx && ctx.chatHistory) || [];
  history.forEach(function(item) {
    if (item.role === 'user') candidates.push(item.text || '');
  });

  var best = 0;
  for (var i = 0; i < candidates.length; i++) {
    const t = String(candidates[i] || '').toLowerCase();
    if (!t) continue;

    var explicitMax = 0;
    var explicitSum = 0;
    const rgx = /(\d{1,2})\s*(accesos|acceso|ambientes|ambiente|puertas|zonas|salones|salon)/g;
    var m;
    while ((m = rgx.exec(t)) !== null) {
      const n = Number(m[1]) || 0;
      if (n > explicitMax) explicitMax = n;
      explicitSum += n;
    }

    var adjectiveFloor = 0;
    if (/chico|pequeno|pequeño/.test(t)) adjectiveFloor = 2;
    if (/mediano/.test(t)) adjectiveFloor = Math.max(adjectiveFloor, 4);
    if (/grande/.test(t)) adjectiveFloor = Math.max(adjectiveFloor, 6);

    var candidateCoverage = 0;
    if (explicitSum > 0) {
      // Cuando hay varios numeros relevantes (ej: 2 puertas y 2 salones), usar suma.
      candidateCoverage = explicitSum;
    } else if (explicitMax > 0) {
      candidateCoverage = explicitMax;
    }

    if (adjectiveFloor > candidateCoverage) {
      candidateCoverage = adjectiveFloor;
    }

    if (candidateCoverage > best) best = candidateCoverage;
  }

  return best;
}

function buildDeterministicRecommendation_(clientType, coverage, intent) {
  const isHotIntent = intent === 'cotizacion' || intent === 'compra';

  if (clientType === 'comercio') {
    if (coverage <= 2) {
      return isHotIntent
        ? 'Para un comercio chico, te recomiendo empezar con un kit base para 1 o 2 accesos y escalar despues. Si queres, te cotizo una opcion inicial y otra intermedia para comparar.'
        : 'Para un comercio chico, te recomiendo empezar con un kit base para 1 o 2 accesos y escalar despues. Si queres, te explico la diferencia con una opcion intermedia.';
    }
    if (coverage <= 4) {
      return isHotIntent
        ? 'Con esa cobertura, te conviene una opcion intermedia para comercio con monitoreo y gestion por app. Si queres, te cotizo rango estimado de instalacion y plan mensual.'
        : 'Con esa cobertura, te conviene una opcion intermedia para comercio con monitoreo y gestion por app. Si queres, te digo pros y contras frente a una opcion basica.';
    }
    return isHotIntent
      ? 'Para esa cobertura de comercio, te conviene una opcion robusta con expansion por zonas. Si queres, avanzamos con cotizacion estimada y luego derivacion a asesor.'
      : 'Para esa cobertura de comercio, te conviene una opcion robusta con expansion por zonas. Si queres, te explico una configuracion sugerida paso a paso.';
  }

  if (coverage <= 2) {
    return isHotIntent
      ? 'Para hogar con cobertura chica, una opcion base suele alcanzar y permite crecer despues. Si queres, te cotizo una opcion inicial y una alternativa superior.'
      : 'Para hogar con cobertura chica, una opcion base suele alcanzar y permite crecer despues. Si queres, te explico la diferencia con una alternativa superior.';
  }

  if (coverage <= 4) {
    return isHotIntent
      ? 'Para ese nivel de cobertura en hogar, conviene una opcion intermedia con mejor equilibrio entre costo y proteccion. Si queres, te paso una cotizacion estimada.'
      : 'Para ese nivel de cobertura en hogar, conviene una opcion intermedia con mejor equilibrio entre costo y proteccion. Si queres, te cuento que incluye y que no incluye.';
  }

  return isHotIntent
    ? 'Para cobertura amplia en hogar, te recomiendo una opcion escalable por zonas. Si queres, avanzamos con una cotizacion estimada segun tu localidad.'
    : 'Para cobertura amplia en hogar, te recomiendo una opcion escalable por zonas. Si queres, te explico una propuesta por etapas para empezar sin sobredimensionar.';
}

function avoidRepeatedBotReply_(reply, ctx) {
  const candidate = cleanText_(reply);
  const history = (ctx && ctx.chatHistory) || [];

  for (var i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== 'bot') continue;
    const lastBot = cleanText_(history[i].text);
    if (lastBot && lastBot.toLowerCase() === candidate.toLowerCase()) {
      return candidate + ' Si queres, en el siguiente mensaje te hago una recomendacion puntual para tu caso.';
    }
    break;
  }

  return candidate;
}

function isOutOfScopeQuestion_(text) {
  const t = String(text || '');
  if (!t) return false;

  const hasSecurityContext = /(alarma|camar|monitoreo|kit|plan|seguridad|hogar|comercio|cotiz|presupuesto|instal)/.test(t);
  if (hasSecurityContext) return false;

  const clearlyOffTopic = /(bebes|reptil|reptiloide|perro|gato|futbol|receta|astrolog|politic|distancia del sol|luna)/.test(t);
  return clearlyOffTopic;
}

function isGreetingOnly_(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return false;
  return /^(hola+|buenas|buen dia|buenas tardes|buenas noches|hello|hi|holi)[!.\s]*$/.test(t);
}

function isStopIntent_(text) {
  const t = String(text || '').toLowerCase();
  return /(no quiero nada|ya no quiero|no me interesa|dejalo ahi|deja ahi|cancelar|chau|adios|hasta luego)/.test(t);
}

function isConfusionTurn_(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return false;
  if (t.length <= 8 && /que+/.test(t)) return true;
  return /(con que|con quee|en que me ayudas|en que ayudas|que haces|que ofreces)/.test(t);
}

function isFrustrationTurn_(text) {
  const t = String(text || '').toLowerCase();
  return /(fome|wea|wea fome|wea\s+fome|aburrido|malo|pesimo|horrible|broma|no sirve|errores por todos lados)/.test(t);
}

function isTruncationComplaint_(text) {
  const t = String(text || '').toLowerCase();
  return /(llego cortado|lleg[oó] cortado|mensaje cortado|se corto|quedo cortado|sale cortado|respuesta cortada)/.test(t);
}

function getLastBotMessage_(ctx) {
  const history = (ctx && ctx.chatHistory) || [];
  for (var i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== 'bot') continue;
    const txt = cleanText_(history[i].text);
    if (txt) return txt;
  }
  return '';
}

function ensureEndsWithQuestionOrDot_(text) {
  const t = cleanText_(text);
  if (!t) return '';
  if (/[.!?]$/.test(t)) return t;
  return t + '.';
}

function buildEvents_(signal, score, status, botReplyResult, ctx, cfg) {
  const events = [];

  if (signal.intent === 'cotizacion') {
    events.push({ type: 'cotizacion_solicitada', payload: { intent: signal.intent } });
  }

  if (status === 'caliente' && hasValidContact_(ctx, cfg) && consentOk_(ctx, cfg)) {
    events.push({ type: 'lead_caliente', payload: { score: score, status: status } });
  }

  if (signal.intent === 'compra' && (ctx.lead.urgencia === 'media' || ctx.lead.urgencia === 'alta')) {
    events.push({ type: 'cierre_probable', payload: { intent: signal.intent, urgencia: ctx.lead.urgencia } });
  }

  if (botReplyResult.mode === 'fallback_faq') {
    events.push({ type: 'fallback_activado', payload: { reason: 'ia_no_disponible_o_desactivada' } });
  }

  return events;
}

function buildConversationSummary_(ctx, signal, score, status) {
  return [
    'session_id: ' + ctx.sessionId,
    'fecha_hora_utc: ' + ctx.timestamp,
    'pagina_origen: ' + (ctx.sourcePage || 'n/a'),
    'tipo_cliente: ' + (ctx.lead.tipoCliente || 'no_definido'),
    'localidad: ' + (ctx.lead.localidad || 'no_definida'),
    'intencion_compra: ' + signal.intent,
    'urgencia: ' + (ctx.lead.urgencia || 'no_definida'),
    'lead_score: ' + score,
    'lead_estado: ' + status,
    'consentimiento: ' + (ctx.consent ? 'si' : 'no'),
    'interes: ' + (ctx.lead.interes || 'no_definido')
  ].join('\n');
}

function writeChatLog_(ctx, botResponse, intent, score, leadStatus, cfg) {
  const row = [
    new Date(),
    ctx.sessionId,
    ctx.userMessage,
    botResponse,
    intent,
    score,
    leadStatus,
    ctx.consent,
    ctx.sourcePage
  ];
  appendRow_(OP_SHEETS.CHAT_LOGS, row, cfg);
}

function writeEvents_(sessionId, eventList) {
  eventList.forEach(function(evt) {
    appendRow_(OP_SHEETS.EVENTOS, [
      new Date(),
      sessionId,
      evt.type,
      JSON.stringify(evt.payload || {}),
      false,
      ''
    ]);
  });
}

function writeLeadPrequal_(ctx, signal, score, status, resumen, cfg) {
  appendRow_(OP_SHEETS.LEADS, [
    new Date(),
    ctx.sessionId,
    ctx.lead.nombre,
    ctx.lead.telefono,
    ctx.lead.email,
    ctx.lead.tipoCliente,
    ctx.lead.localidad,
    ctx.lead.interes,
    ctx.lead.urgencia,
    score,
    ctx.consent,
    false
  ], cfg);

  if (resumen) {
    appendRow_(OP_SHEETS.EVENTOS, [
      new Date(),
      ctx.sessionId,
      'resumen_conversacion',
      JSON.stringify({ resumen: resumen, intent: signal.intent, score: score, status: status }),
      false,
      ''
    ]);
  }
}

function handleAlerts_(eventList, ctx, score, props, cfg) {
  const hasHotLead = eventList.some(function(e) { return e.type === 'lead_caliente'; });
  if (hasHotLead) {
    const body = [
      'Nuevo lead caliente detectado.',
      '',
      'Session: ' + ctx.sessionId,
      'Score: ' + score,
      'Nombre: ' + (ctx.lead.nombre || 'n/a'),
      'Telefono: ' + (ctx.lead.telefono || 'n/a'),
      'Email: ' + (ctx.lead.email || 'n/a'),
      'Tipo cliente: ' + (ctx.lead.tipoCliente || 'n/a'),
      'Localidad: ' + (ctx.lead.localidad || 'n/a'),
      'Interes: ' + (ctx.lead.interes || 'n/a')
    ].join('\n');

    MailApp.sendEmail({
      to: cfg.emailDestinoAlertas || props.ALERT_EMAIL,
      subject: '[Smarthome Chat IA] Lead caliente',
      body: body
    });
  }
}

function maybeSyncLeadToForms_(ctx, signal, score, status, props, cfg) {
  if (!props.FORMS_WEBAPP_URL) {
    return { synced: false, detail: 'FORMS_WEBAPP_URL no configurado' };
  }

  if (!(signal.intent === 'cotizacion' || signal.intent === 'compra' || score >= cfg.umbralLeadCaliente)) {
    return { synced: false, detail: 'Lead sin criterio de derivacion' };
  }

  if (!consentOk_(ctx, cfg)) return { synced: false, detail: 'Sin consentimiento' };

  if (!ctx.lead.nombre || !ctx.lead.telefono || !ctx.lead.email || !ctx.lead.localidad) {
    return { synced: false, detail: 'Faltan datos para hoja oficial (nombre/telefono/email/localidad)' };
  }

  const payload = {
    formType: 'lead',
    nombreApellido: ctx.lead.nombre,
    telefono: ctx.lead.telefono,
    provincia: ctx.lead.localidad,
    mail: ctx.lead.email,
    pagina: ctx.sourcePage || 'chat',
    url: ctx.sourcePage || 'chat',
    userAgent: ctx.userAgent || 'chat-widget',
    website: '',
    tiempoSegundos: 10
  };

  try {
    const res = UrlFetchApp.fetch(props.FORMS_WEBAPP_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    const body = res.getContentText() || '';

    const synced = code >= 200 && code < 300 && /"ok"\s*:\s*true/.test(body);

    markLeadSyncFlag_(ctx.sessionId, synced);

    return {
      synced: synced,
      detail: 'HTTP ' + code + (synced ? ' OK' : (' body: ' + body.slice(0, 300)))
    };
  } catch (err) {
    writeErrorSafe_(ctx.sessionId, 'sync_forms_error', String(err), 'sync_error', false);
    return { synced: false, detail: 'Error al sincronizar: ' + String(err) };
  }
}

function markLeadSyncFlag_(sessionId, synced) {
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_OPERACION_ID'));
  const sh = ss.getSheetByName(OP_SHEETS.LEADS);
  if (!sh) return;

  const values = sh.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][1]) === String(sessionId)) {
      sh.getRange(i + 1, 12).setValue(!!synced);
      return;
    }
  }
}

function appendRow_(sheetName, row) {
  const opId = PropertiesService.getScriptProperties().getProperty('SHEET_OPERACION_ID');
  const ss = SpreadsheetApp.openById(opId);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('No existe la pestana: ' + sheetName);
  sh.appendRow(row);
}

function writeErrorSafe_(sessionId, type, message, providerCode, handledFallback) {
  try {
    appendRow_(OP_SHEETS.ERRORES, [
      new Date(),
      sessionId || '',
      type,
      String(message || '').slice(0, 1000),
      providerCode || '',
      !!handledFallback
    ]);
  } catch (_ignored) {}
}

function detectProviderCode_(errMsg) {
  const t = String(errMsg || '').toLowerCase();
  if (t.indexOf('quota') !== -1 || t.indexOf('resource_exhausted') !== -1) return 'quota_exceeded';
  if (t.indexOf('429') !== -1) return 'rate_limited';
  if (t.indexOf('401') !== -1 || t.indexOf('403') !== -1) return 'auth_error';
  return 'provider_error';
}

function hasValidContact_(ctx, cfg) {
  const phoneOk = ctx.lead.telefono && ctx.lead.telefono.length >= cfg.telefonoMinDigitos;
  const emailOk = isValidEmail_(ctx.lead.email);
  return !!(phoneOk || emailOk);
}

function consentOk_(ctx, cfg) {
  if (!cfg.requerirConsentimiento) return true;
  return !!ctx.consent;
}

function getRequestData_(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (_err) {}
  }
  return e.parameter || {};
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsResponse_(text) {
  return ContentService
    .createTextOutput(String(text || ''))
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function cleanText_(value) {
  return String(value || '').trim();
}

function onlyDigits_(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function toNumber_(value, fallback) {
  const n = Number(value);
  return isNaN(n) ? fallback : n;
}

function toBool_(value, fallback) {
  if (typeof value === 'boolean') return value;
  const t = String(value || '').toLowerCase();
  if (t === 'true') return true;
  if (t === 'false') return false;
  return fallback;
}

function normalizeConfigValue_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value).trim();
}

/**
 * Test manual en editor Apps Script
 * Ejecutar luego de cargar Script Properties.
 */
function testConfigAndAccess() {
  const props = getScriptProps_();
  const cfg = loadRuntimeConfig_(props);

  const out = {
    ok: true,
    propsLoaded: {
      DOC_INSTRUCCIONES_ID: !!props.DOC_INSTRUCCIONES_ID,
      DOC_CONOCIMIENTO_ID: !!props.DOC_CONOCIMIENTO_ID,
      DOC_EVENTOS_ID: !!props.DOC_EVENTOS_ID,
      SHEET_CONFIG_ID: !!props.SHEET_CONFIG_ID,
      SHEET_OPERACION_ID: !!props.SHEET_OPERACION_ID,
      ALERT_EMAIL: !!props.ALERT_EMAIL,
      GEMINI_API_KEY: !!props.GEMINI_API_KEY,
      GEMINI_MODEL: props.GEMINI_MODEL || 'gemini-2.5-flash',
      FORMS_WEBAPP_URL: !!props.FORMS_WEBAPP_URL
    },
    cfgPreview: cfg,
    docsPreview: {
      instruccionesChars: DocumentApp.openById(props.DOC_INSTRUCCIONES_ID).getBody().getText().length,
      conocimientoChars: DocumentApp.openById(props.DOC_CONOCIMIENTO_ID).getBody().getText().length,
      eventosChars: DocumentApp.openById(props.DOC_EVENTOS_ID).getBody().getText().length
    },
    timestamp: new Date().toISOString()
  };

  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

/**
 * Lista modelos disponibles para tu API key y muestra solo los que aceptan generateContent.
 */
function testListGeminiModels() {
  const p = PropertiesService.getScriptProperties();
  const apiKey = p.getProperty('GEMINI_API_KEY') || '';
  if (!apiKey) throw new Error('Falta GEMINI_API_KEY en Script Properties');

  const url = 'https://generativelanguage.googleapis.com/v1/models?key=' + encodeURIComponent(apiKey);
  const res = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
  const code = res.getResponseCode();
  const txt = res.getContentText() || '';

  if (code < 200 || code >= 300) {
    throw new Error('ListModels HTTP ' + code + ': ' + txt.slice(0, 800));
  }

  const data = JSON.parse(txt);
  const models = (data.models || [])
    .filter(function(m) {
      const methods = m.supportedGenerationMethods || [];
      return methods.indexOf('generateContent') !== -1;
    })
    .map(function(m) {
      return {
        name: m.name,
        displayName: m.displayName,
        supportedGenerationMethods: m.supportedGenerationMethods || []
      };
    });

  Logger.log(JSON.stringify(models, null, 2));
  return models;
}

