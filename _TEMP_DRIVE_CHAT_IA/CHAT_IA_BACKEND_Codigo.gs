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

var CHAT_VERSION = '1.0.0';

var OP_SHEETS = {
  CHAT_LOGS: 'chat_logs',
  EVENTOS: 'eventos_chat',
  ERRORES: 'errores_chat',
  LEADS: 'leads_precalificados'
};

var PROMPT_OPT = {
  HISTORY_ITEMS: 6,
  MAX_INSTRUCTIONS_CHARS: 1400,
  MAX_KNOWLEDGE_CHARS: 1000,
  MAX_EVENTS_CHARS: 650,
  DOCS_CACHE_SECONDS: 300,
  MAX_OUTPUT_TOKENS: 280
};

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var wantsChat = String(params.action || '').toLowerCase() === 'chat';

  if (!wantsChat) {
    return jsonResponse_({
      ok: true,
      service: 'smarthome-chat-ia',
      version: CHAT_VERSION,
      timestamp: new Date().toISOString()
    });
  }

  var result = processChatRequest_({
    sessionId: params.sessionId || '',
    message: params.message || '',
    sourcePage: params.sourcePage || '',
    userAgent: params.userAgent || 'browser',
    chatHistory: parseChatHistoryParam_(params.chatHistory || '')
  });

  var callback = cleanJsonpCallback_(params.callback || '');
  if (callback) {
    return jsResponse_(callback + '(' + JSON.stringify(result) + ');');
  }

  return jsonResponse_(result);
}

function doPost(e) {
  var payload = getRequestData_(e);
  var result = processChatRequest_(payload);
  return jsonResponse_(result);
}

function processChatRequest_(payload) {
  var lock = LockService.getScriptLock();
  var lockAcquired = false;

  try {
    lockAcquired = lock.tryLock(1000);

    var props = getScriptProps_();
    var cfg = loadRuntimeConfig_(props);

    var ctx = buildContext_(payload, cfg);
    var prevState = loadSessionState_(ctx.sessionId);
    hydrateContextFromState_(ctx, prevState);
    validateInput_(ctx, cfg);

    var signal = detectCommercialSignal_(ctx.userMessage);
    var leadScore = scoreLead_(signal, ctx, cfg);
    var leadStatus = classifyLeadStatus_(leadScore, cfg);

    var botReplyResult = buildBotReply_(ctx, signal, props, cfg);
    var transcript = persistConversationTranscript_(ctx, botReplyResult.replyText, props);

    var nextState = buildNextSessionState_(ctx, signal, botReplyResult, prevState, transcript);
    saveSessionState_(ctx.sessionId, nextState);

    var eventList = buildEvents_(signal, leadScore, leadStatus, botReplyResult, ctx, cfg);
    var resumen = buildConversationSummary_(ctx, signal, leadScore, leadStatus);

    writeChatLog_(ctx, botReplyResult.replyText, signal.intent, leadScore, leadStatus, cfg, transcript, nextState);
    writeEvents_(ctx.sessionId, eventList, transcript, nextState);
    writeLeadPrequal_(ctx, signal, leadScore, leadStatus, resumen, cfg, transcript, nextState);

    handleAlerts_(eventList, ctx, leadScore, props, cfg);

    var syncResult = maybeSyncLeadToForms_(ctx, signal, leadScore, leadStatus, props, cfg);

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
        syncDetail: syncResult.detail,
        transcriptDocId: transcript.docId,
        transcriptDocUrl: transcript.docUrl
      }
    };
  } catch (err) {
    var msg = (err && err.message) ? String(err.message) : String(err);
    writeErrorSafe_(null, 'runtime_error', msg, 'n/a', false);

    var safeMessage = isIaUnavailableError_(msg)
      ? 'En este momento no hay operador disponible. Por favor comunicate por WhatsApp y te asistimos a la brevedad.'
      : (msg || 'Error interno en chat IA');

    return {
      ok: false,
      message: safeMessage
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
  var raw = String(value || '').trim();
  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch (_err) {
    return [];
  }
}

function cleanJsonpCallback_(value) {
  var cb = String(value || '').trim();
  if (!cb) return '';
  if (!/^[a-zA-Z_$][0-9a-zA-Z_$\.]{0,120}$/.test(cb)) return '';
  return cb;
}

function getScriptProps_() {
  var p = PropertiesService.getScriptProperties();
  var obj = {
    DOC_INSTRUCCIONES_ID: p.getProperty('DOC_INSTRUCCIONES_ID') || '',
    DOC_CONOCIMIENTO_ID: p.getProperty('DOC_CONOCIMIENTO_ID') || '',
    DOC_EVENTOS_ID: p.getProperty('DOC_EVENTOS_ID') || '',
    SHEET_CONFIG_ID: p.getProperty('SHEET_CONFIG_ID') || '',
    SHEET_OPERACION_ID: p.getProperty('SHEET_OPERACION_ID') || '',
    ALERT_EMAIL: p.getProperty('ALERT_EMAIL') || '',
    GEMINI_API_KEY: p.getProperty('GEMINI_API_KEY') || '',
    GEMINI_MODEL: p.getProperty('GEMINI_MODEL') || 'gemini-2.5-flash',
    FORMS_WEBAPP_URL: p.getProperty('FORMS_WEBAPP_URL') || '',
    CHAT_TRANSCRIPTS_FOLDER_ID: p.getProperty('CHAT_TRANSCRIPTS_FOLDER_ID') || ''
  };

  var required = ['DOC_INSTRUCCIONES_ID', 'DOC_CONOCIMIENTO_ID', 'DOC_EVENTOS_ID', 'SHEET_CONFIG_ID', 'SHEET_OPERACION_ID', 'ALERT_EMAIL'];
  required.forEach(function(k) {
    if (!obj[k]) throw new Error('Falta Script Property: ' + k);
  });

  return obj;
}

function loadRuntimeConfig_(props) {
  var cfgSheet = SpreadsheetApp.openById(props.SHEET_CONFIG_ID).getSheets()[0];
  var rows = cfgSheet.getDataRange().getValues();

  var kv = {};
  for (var i = 1; i < rows.length; i++) {
    var key = cleanText_(rows[i][0]);
    var valueRaw = rows[i][1];
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
  var lead = payload.leadData || {};

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

function loadSessionState_(sessionId) {
  try {
    if (!sessionId) return {};
    var raw = CacheService.getScriptCache().get('chat_state_' + sessionId);
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (_err) {
    return {};
  }
}

function saveSessionState_(sessionId, state) {
  try {
    if (!sessionId) return;
    CacheService.getScriptCache().put(
      'chat_state_' + sessionId,
      JSON.stringify(state || {}),
      21600
    );
  } catch (_err) {}
}

function hydrateContextFromState_(ctx, state) {
  if (!state) return;
  if (!ctx.lead.tipoCliente && state.clientType && state.clientTypeLocked && isStateFresh_(state.lastUpdatedAt, 90)) {
    ctx.lead.tipoCliente = state.clientType;
  }
  if (!ctx.lead.localidad && state.localidad) ctx.lead.localidad = state.localidad;
  ctx.sessionState = state;
}

function buildNextSessionState_(ctx, signal, botReplyResult, prevState, transcript) {
  var prev = prevState || {};
  var next = {
    sessionId: ctx.sessionId,
    turnCount: toNumber_(prev.turnCount, 0) + 1,
    lastUpdatedAt: new Date().toISOString(),
    clientType: prev.clientType || '',
    clientTypeLocked: !!prev.clientTypeLocked,
    coverage: toNumber_(prev.coverage, 0),
    localidad: prev.localidad || '',
    hasRecommendation: !!prev.hasRecommendation,
    awaitingLocalidad: !!prev.awaitingLocalidad,
    lastIntent: signal.intent,
    transcriptDocId: transcript.docId || prev.transcriptDocId || '',
    transcriptDocUrl: transcript.docUrl || prev.transcriptDocUrl || ''
  };

  var inferredType = inferClientType_(ctx);
  if (inferredType) next.clientType = inferredType;

  var explicitTypeNow = detectTypeInText_(ctx.userMessage || '');
  if (explicitTypeNow) {
    next.clientType = explicitTypeNow;
    next.clientTypeLocked = true;
  }

  if (isTypeDisputeTurn_(ctx.userMessage || '')) {
    next.clientType = '';
    next.clientTypeLocked = false;
  }

  var inferredCoverage = inferCoverageNeed_(ctx);
  if (inferredCoverage > 0) next.coverage = inferredCoverage;

  var inferredLocalidad = inferLocalidadFromText_(ctx.userMessage || '');
  if (inferredLocalidad) next.localidad = inferredLocalidad;

  var replyText = String((botReplyResult && botReplyResult.replyText) || '').toLowerCase();
  if (/te conviene|te recomiendo|opcion intermedia|opcion base|cobertura/.test(replyText)) {
    next.hasRecommendation = true;
  }
  next.awaitingLocalidad = /pasame tu localidad|decime tu localidad|localidad/.test(replyText);

  return next;
}

function inferLocalidadFromText_(text) {
  var t = String(text || '').trim();
  if (!t) return '';

  var m = t.match(/(?:soy de|estoy en|vivo en|desde)\s+([a-zA-Z\s\-\.]{2,40})/i);
  if (!m || !m[1]) return '';

  var candidate = cleanText_(m[1]).replace(/[.,;:!?]+$/, '');
  if (!candidate) return '';

  return candidate;
}

function persistConversationTranscript_(ctx, botReplyText, props) {
  var out = { docId: '', docUrl: '' };

  try {
    var state = loadSessionState_(ctx.sessionId);
    var docId = state.transcriptDocId || '';
    var doc;

    if (docId) {
      doc = DocumentApp.openById(docId);
    } else {
      var title = 'chat_' + ctx.sessionId;
      doc = DocumentApp.create(title);
      docId = doc.getId();

      if (props.CHAT_TRANSCRIPTS_FOLDER_ID) {
        try {
          var file = DriveApp.getFileById(docId);
          var folder = DriveApp.getFolderById(props.CHAT_TRANSCRIPTS_FOLDER_ID);
          folder.addFile(file);
          DriveApp.getRootFolder().removeFile(file);
        } catch (_moveErr) {}
      }

      var head = doc.getBody();
      head.appendParagraph('Session: ' + ctx.sessionId);
      head.appendParagraph('Creado UTC: ' + new Date().toISOString());
      head.appendParagraph('Pagina origen: ' + (ctx.sourcePage || 'n/a'));
      head.appendParagraph('---');
    }

    var body = doc.getBody();
    body.appendParagraph('[' + new Date().toISOString() + '] CLIENTE: ' + (ctx.userMessage || ''));
    body.appendParagraph('[' + new Date().toISOString() + '] ASESOR: ' + (botReplyText || ''));

    out.docId = docId;
    out.docUrl = 'https://docs.google.com/document/d/' + docId + '/edit';
  } catch (_err) {}

  return out;
}

function normalizeChatHistory_(historyRaw) {
  if (!Array.isArray(historyRaw)) return [];

  return historyRaw
    .slice(-PROMPT_OPT.HISTORY_ITEMS)
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
      var roleLabel = item.role === 'user' ? 'CLIENTE' : 'ASESOR';
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
  var t = String(text || '').toLowerCase();

  var hasQuote = /(precio|cotiza|cotizacion|presupuesto|cuanto sale|valor|plan)/.test(t);
  var hasUrgency = /(hoy|urgente|esta semana|ya|cuanto antes|rapido)/.test(t);
  var hasInstallIntent = /(instalar|instalacion|contratar|quiero contratar|quiero poner)/.test(t);
  var asksAdvisor = /(asesor|llamenme|llamame|contactenme|me contactan)/.test(t);

  var intent = 'info';
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
  var docs = readKnowledgeDocs_(props);

  var historyText = formatHistoryForPrompt_(ctx.chatHistory);
  var instructionsCompact = trimForPrompt_(docs.instructions, PROMPT_OPT.MAX_INSTRUCTIONS_CHARS);
  var knowledgeCompact = buildCompactKnowledgeContext_(docs.knowledge, ctx, signal);
  var eventsCompact = buildCompactEventsContext_(docs.events, ctx, signal);

  var prompt = [
    instructionsCompact,
    '\n\nCONOCIMIENTO:\n',
    knowledgeCompact,
    '\n\nEVENTOS:\n',
    eventsCompact,
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

  if (!props.GEMINI_API_KEY) {
    throw new Error('IA no disponible: falta GEMINI_API_KEY en Script Properties');
  }

  try {
    var text = callGeminiWithFallbackModels_(prompt, props.GEMINI_API_KEY, props.GEMINI_MODEL);
    var processed = postProcessReply_(text, ctx);
    if (looksWeakOrTruncatedReply_(processed)) {
      throw new Error('Respuesta IA debil o truncada');
    }
    return { mode: 'ia', replyText: processed };
  } catch (err) {
    var errMsg = String(err);
    var providerCode = detectProviderCode_(errMsg);
    writeErrorSafe_(ctx.sessionId, 'ia_provider_error', errMsg, providerCode, false);
    throw err;
  };
}

function buildCompactKnowledgeContext_(knowledgeText, ctx, signal) {
  var q = [
    String((ctx && ctx.userMessage) || ''),
    String((signal && signal.intent) || ''),
    String((ctx && ctx.lead && ctx.lead.tipoCliente) || ''),
    String((ctx && ctx.lead && ctx.lead.interes) || '')
  ].join(' ').trim();

  var extracted = extractRelevantKnowledge_(q, knowledgeText);
  return trimForPrompt_(extracted, PROMPT_OPT.MAX_KNOWLEDGE_CHARS);
}

function buildCompactEventsContext_(eventsText, ctx, signal) {
  var keywords = [
    String((signal && signal.intent) || ''),
    String((ctx && ctx.lead && ctx.lead.urgencia) || ''),
    'cotizacion',
    'compra',
    'asesor',
    'whatsapp',
    'lead'
  ];

  var picked = pickRelevantLinesByKeywords_(eventsText, keywords, 6);
  if (!picked) picked = 'Priorizar respuesta comercial clara y derivacion a asesor cuando corresponda.';
  return trimForPrompt_(picked, PROMPT_OPT.MAX_EVENTS_CHARS);
}

function pickRelevantLinesByKeywords_(text, keywords, maxLines) {
  var lines = String(text || '')
    .split(/\r?\n/)
    .map(function(line) { return cleanText_(line); })
    .filter(function(line) { return line && line.length >= 8; });

  if (!lines.length) return '';

  var kws = (keywords || [])
    .map(function(k) { return String(k || '').toLowerCase(); })
    .filter(function(k) { return !!k; });

  var scored = lines.map(function(line) {
    var l = line.toLowerCase();
    var score = 0;
    for (var i = 0; i < kws.length; i++) {
      if (l.indexOf(kws[i]) !== -1) score += 2;
    }
    if (/cotiz|precio|plan|kit|asesor|lead|urgencia|contacto/.test(l)) score += 1;
    return { line: line, score: score };
  });

  scored.sort(function(a, b) { return b.score - a.score; });

  var top = scored
    .filter(function(item) { return item.score > 0; })
    .slice(0, Math.max(1, toNumber_(maxLines, 6)))
    .map(function(item) { return item.line; });

  return top.join(' ');
}

function callGeminiWithFallbackModels_(prompt, apiKey, preferredModel) {
  var models = buildGeminiModelCandidates_(preferredModel);
  var errors = [];

  for (var i = 0; i < models.length; i++) {
    var model = models[i];
    try {
      return callGemini_(prompt, apiKey, model);
    } catch (err) {
      var msg = String(err && err.message ? err.message : err);
      errors.push(model + ' -> ' + msg.slice(0, 220));

      // Si es un tema de cuota/rate-limit, probar siguiente modelo.
      if (isQuotaOrRateError_(msg)) {
        continue;
      }

      // Errores no relacionados a cuota se propagan de inmediato.
      throw err;
    }
  }

  throw new Error('Gemini sin cupo disponible en modelos probados: ' + errors.join(' || '));
}

function buildGeminiModelCandidates_(preferredModel) {
  var primary = cleanText_(preferredModel) || 'gemini-2.5-flash';
  var candidates = [
    primary,
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro'
  ];

  var seen = {};
  var unique = [];
  for (var i = 0; i < candidates.length; i++) {
    var model = cleanText_(candidates[i]);
    if (!model || seen[model]) continue;
    seen[model] = true;
    unique.push(model);
  }

  return unique;
}

function isQuotaOrRateError_(errMsg) {
  var t = String(errMsg || '').toLowerCase();
  return (
    t.indexOf('429') !== -1 ||
    t.indexOf('quota') !== -1 ||
    t.indexOf('resource_exhausted') !== -1 ||
    t.indexOf('rate limit') !== -1 ||
    t.indexOf('rate_limited') !== -1
  );
}

function readKnowledgeDocs_(props) {
  var cache = CacheService.getScriptCache();
  var cacheKey = buildDocsCacheKey_(props);

  try {
    var cached = cache.get(cacheKey);
    if (cached) {
      var parsed = JSON.parse(cached);
      if (parsed && parsed.instructions && parsed.knowledge && parsed.events) {
        return parsed;
      }
    }
  } catch (_cacheReadErr) {}

  var docs = {
    instructions: DocumentApp.openById(props.DOC_INSTRUCCIONES_ID).getBody().getText(),
    knowledge: DocumentApp.openById(props.DOC_CONOCIMIENTO_ID).getBody().getText(),
    events: DocumentApp.openById(props.DOC_EVENTOS_ID).getBody().getText()
  };

  try {
    cache.put(cacheKey, JSON.stringify(docs), PROMPT_OPT.DOCS_CACHE_SECONDS);
  } catch (_cacheWriteErr) {}

  return docs;
}

function buildDocsCacheKey_(props) {
  var seed = [
    props.DOC_INSTRUCCIONES_ID,
    props.DOC_CONOCIMIENTO_ID,
    props.DOC_EVENTOS_ID,
    CHAT_VERSION
  ].join('|');

  var enc = Utilities.base64EncodeWebSafe(seed).replace(/=+$/g, '');
  return 'chat_docs_' + enc.slice(0, 120);
}

function callGemini_(prompt, apiKey, modelName) {
  var model = cleanText_(modelName) || 'gemini-2.5-flash';
  var url = 'https://generativelanguage.googleapis.com/v1/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);
  var body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: PROMPT_OPT.MAX_OUTPUT_TOKENS
    }
  };

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  var txt = res.getContentText() || '';

  if (code < 200 || code >= 300) {
    throw new Error('Gemini HTTP ' + code + ': ' + txt.slice(0, 600));
  }

  var data = JSON.parse(txt);
  var firstCandidate = data && data.candidates && data.candidates[0];
  var finishReason = String((firstCandidate && firstCandidate.finishReason) || '').toUpperCase();
  var parts = firstCandidate && firstCandidate.content && firstCandidate.content.parts;
  var output = Array.isArray(parts)
    ? parts.map(function(p) { return p && p.text ? String(p.text) : ''; }).join('')
    : '';

  if (finishReason && finishReason !== 'STOP' && finishReason !== 'FINISH_REASON_UNSPECIFIED') {
    throw new Error('Gemini salida incompleta (' + finishReason + '): ' + String(output || '').slice(0, 240));
  }

  if (!output) throw new Error('Respuesta vacia de Gemini');

  return String(output).trim();
}

function postProcessReply_(text, ctx) {
  var out = cleanText_(text);
  if (!out) return 'Puedo ayudarte con una recomendacion concreta. Es para hogar o comercio?';

  // Limpiar restos de markdown para que suene a chat humano.
  out = out
    .replace(/\*\*/g, '')
    .replace(/__+/g, '')
    .replace(/`+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (ctx && ctx.chatHistory && ctx.chatHistory.length > 0) {
    out = out.replace(/^\s*[!]*\s*(hola|hola de nuevo|buenas|buen dia|buenas tardes|buenas noches)[\s!,.:;-]*/i, '');
    out = cleanText_(out);
  }

  // Reparaciones puntuales de cortes frecuentes observados en produccion.
  out = out.replace(/si buscas seguridad para tu hogar\.$/i, 'si buscas seguridad para tu hogar o para tu comercio?');
  out = out.replace(/base de alarma, sire\.$/i, 'base de alarma, sirena y sensores para proteger accesos clave.');

  // Si termina con palabras de enlace o fragmentos demasiado cortos, completar con una pregunta util.
  if (/(para|con|de|y|o|si|que|en|por|como|tu|su)\.$/i.test(out) || /,\s*[a-zA-Z]{1,7}\.$/.test(out)) {
    var hasTipo = !!(ctx && ctx.lead && ctx.lead.tipoCliente);
    if (hasTipo) {
      out = out.replace(/\.?$/, '') + '. Para avanzar, decime cuantos accesos o ambientes queres cubrir?';
    } else {
      out = out.replace(/\.?$/, '') + '. Para avanzar, es para hogar o comercio y cuantos accesos o ambientes queres cubrir?';
    }
  }

  // Si la respuesta termina en frase incompleta, completar con pregunta comercial util.
  if (/(para poder|para ayudarte|necesito saber|necesito|para recomendarte)\.?$/i.test(out)) {
    var hasTipo = !!(ctx && ctx.lead && ctx.lead.tipoCliente);
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

  if (hasAbruptEnding_(out)) {
    var hasTipo = !!(ctx && ctx.lead && ctx.lead.tipoCliente);
    if (hasTipo) {
      out = out.replace(/\.?$/, '') + '. Si queres, te paso las opciones recomendadas para tu caso y el rango estimado de precio.';
    } else {
      out = out.replace(/\.?$/, '') + '. Si queres, te paso opciones recomendadas y un rango estimado de precio para hogar o comercio.';
    }
  }

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

function trimForPrompt_(text, maxChars) {
  var t = cleanText_(text);
  var max = toNumber_(maxChars, 1200);
  if (!t) return '';
  if (t.length <= max) return t;
  return t.slice(0, Math.max(100, max)).replace(/\s+\S*$/, '').trim();
}

function hasAbruptEnding_(text) {
  var t = cleanText_(text).toLowerCase();
  if (!t) return false;

  // Finales cortados observados en produccion.
  if (/\s+[a-z]\.$/.test(t)) return true; // ejemplo: "... o."
  if (/\bmonit\.$/.test(t)) return true; // ejemplo: "... monit."
  if (/\b(opcion|kit|plan)\s+[a-z]\.$/.test(t)) return true;

  // Conectores colgando al final.
  if (/\s+(o|y|de|con|para|por)\.$/.test(t)) return true;

  return false;
}

function buildFaqFallbackReply_(ctx, signal, knowledgeText, cfg) {
  var deterministic = buildDeterministicFlowReply_(ctx, signal);
  if (deterministic && deterministic.force && deterministic.reply) {
    return deterministic.reply;
  }

  var userText = String(ctx.userMessage || '').toLowerCase();
  var hasHistory = !!(ctx && ctx.chatHistory && ctx.chatHistory.length);

  if (isTruncationComplaint_(userText)) {
    var lastBot = getLastBotMessage_(ctx);
    if (lastBot) {
      return 'Gracias por avisar. Te lo repito claro: ' + ensureEndsWithQuestionOrDot_(lastBot);
    }
    return 'Gracias por avisar. Retomemos bien: es para hogar o comercio y cuantos accesos o ambientes queres cubrir?';
  }

  if (isStopIntent_(userText)) {
    return 'Entiendo, no hay problema. Si mas adelante quieres retomar, aqui estoy para ayudarte con kits, planes y cotizacion.';
  }

  if (isGreetingOnly_(userText)) {
    return buildGreetingReply_(ctx, inferClientType_(ctx), inferCoverageNeed_(ctx));
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

  var inferredType = inferClientType_(ctx);
  var inferredCoverage = inferCoverageNeed_(ctx);

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

  var deterministicRec = buildDeterministicRecommendation_(inferredType, inferredCoverage, signal.intent);
  var safeReply = avoidRepeatedBotReply_(deterministicRec, ctx);
  if (safeReply) return safeReply;

  var brief = extractRelevantKnowledge_(ctx.userMessage, knowledgeText);
  var cta = buildFallbackCta_(ctx, signal, inferredType);

  return avoidRepeatedBotReply_([brief, ' ', cta].join('').replace(/\s{2,}/g, ' ').trim(), ctx);
}

function buildDeterministicFlowReply_(ctx, signal) {
  var userText = String((ctx && ctx.userMessage) || '').toLowerCase();
  var state = buildConversationState_(ctx, signal);
  var progress = analyzeConversationProgress_(ctx);
  var userTurns = countUserTurns_(ctx);

  if (isStopIntent_(userText)) {
    return {
      force: true,
      reply: 'Entiendo, no hay problema. Si mas adelante queres retomar, te ayudo cuando quieras.'
    };
  }

  if (isTruncationComplaint_(userText)) {
    return {
      force: true,
      reply: state.lastBot
        ? ('Gracias por avisar. Te lo repito claro: ' + ensureEndsWithQuestionOrDot_(state.lastBot))
        : 'Gracias por avisar. Retomemos desde cero: es para hogar o comercio?'
    };
  }

  if (isGreetingOnly_(userText)) {
    return {
      force: false,
      reply: buildGreetingReply_(ctx, state.clientType, state.coverage, userTurns)
    };
  }

  if (isConfusionTurn_(userText)) {
    return {
      force: true,
      reply: 'Te ayudo a definir una opcion concreta de seguridad segun tu caso y presupuesto. Arrancamos por un dato: es para hogar o comercio?'
    };
  }

  if (isTypeDisputeTurn_(userText)) {
    return {
      force: true,
      reply: 'Tenes razon, mala mia por asumirlo. Confirmame por favor si es para hogar o comercio y seguimos desde ahi.'
    };
  }

  if (isGreetingComplaintTurn_(userText)) {
    return {
      force: true,
      reply: 'Tenes razon, disculpas por eso. Hola y gracias por escribirnos. Para ayudarte bien, confirmame si es para hogar o comercio.'
    };
  }

  if (isFrustrationTurn_(userText)) {
    return {
      force: true,
      reply: 'Tenes razon. Vamos directo y sin vueltas: decime si es hogar o comercio, y despues te pido solo un dato mas para recomendarte algo puntual.'
    };
  }

  if (isOutOfScopeQuestion_(userText)) {
    return {
      force: true,
      reply: 'Puedo ayudarte con seguridad para hogar o comercio: alarmas, camaras, monitoreo y cotizacion. Si queres, empezamos por tu caso concreto.'
    };
  }

  if (isAcknowledgementTurn_(userText) && state.coverage > 0 && progress.hasRecommendation) {
    return {
      force: true,
      reply: 'Perfecto. Si queres, seguimos con una cotizacion estimada: pasame tu localidad y te comparto un rango de instalacion y plan mensual.'
    };
  }

  if (!state.clientType) {
    return {
      force: true,
      reply: avoidRepeatedBotReply_('Para recomendarte bien necesito un dato: es para hogar o comercio?', ctx)
    };
  }

  if (!state.coverage) {
    if (state.clientType === 'comercio') {
      return {
        force: true,
        reply: avoidRepeatedBotReply_('Perfecto, para comercio. Decime cuantos accesos o ambientes queres cubrir (por ejemplo: 2 puertas y 2 salones).', ctx)
      };
    }
    return {
      force: true,
      reply: avoidRepeatedBotReply_('Perfecto, para hogar. Decime cuantos accesos o ambientes queres cubrir (por ejemplo: 2 puertas y living-comedor).', ctx)
    };
  }

  if (state.contradiction) {
    return {
      force: true,
      reply: 'Para no recomendarte mal, veo datos mezclados: dijiste lugar grande, pero los ambientes/accesos detectados dan cobertura media. Confirmame si queres cubrir mas zonas o si avanzamos con cobertura media.'
    };
  }

  if (state.hotIntent) {
    return {
      force: true,
      reply: buildDeterministicQuoteReply_(state)
    };
  }

  return {
    force: false,
    reply: buildDeterministicAdviceReply_(state)
  };
}

function countUserTurns_(ctx) {
  var history = (ctx && ctx.chatHistory) || [];
  var count = 0;

  for (var i = 0; i < history.length; i++) {
    if (history[i] && history[i].role === 'user' && cleanText_(history[i].text)) {
      count++;
    }
  }

  var current = cleanText_(ctx && ctx.userMessage);
  if (current) count += 1;

  return count;
}

function buildGreetingReply_(ctx, clientType, coverage, userTurns) {
  var turns = toNumber_(userTurns, countUserTurns_(ctx));
  var openers = [
    'Hola, gracias por escribirnos.',
    'Hola, bienvenido a SmartHome.',
    'Hola, un gusto ayudarte con seguridad.'
  ];
  var opener = openers[Math.abs(turns) % openers.length];

  if (!clientType) {
    return opener + ' Para orientarte bien desde el inicio, confirmame si es para hogar o comercio.';
  }

  if (!coverage) {
    if (clientType === 'comercio') {
      return opener + ' Perfecto, es para comercio. Decime cuantos accesos o ambientes queres cubrir y te recomiendo una opcion concreta.';
    }
    return opener + ' Perfecto, es para hogar. Decime cuantos accesos o ambientes queres cubrir y te recomiendo una opcion concreta.';
  }

  return opener + ' Si queres, con los datos que ya tenemos te doy una recomendacion puntual y luego una cotizacion estimada.';
}

function buildConversationState_(ctx, signal) {
  var userText = String((ctx && ctx.userMessage) || '').toLowerCase();
  var history = (ctx && ctx.chatHistory) || [];
  var coverage = inferCoverageNeed_(ctx);
  var type = inferClientType_(ctx);
  var size = inferSizeWord_(ctx);
  var lastBot = getLastBotMessage_(ctx);
  var state = (ctx && ctx.sessionState) || {};
  var localidadNow = inferLocalidadFromText_(userText) || (ctx && ctx.lead && ctx.lead.localidad) || state.localidad || '';
  var shouldForceQuoteStep = !!state.awaitingLocalidad || !!localidadNow;

  var contradiction = isSizeCoverageContradiction_(size, coverage);

  return {
    hasHistory: history.length > 0,
    clientType: type,
    coverage: coverage,
    localidad: localidadNow,
    sizeWord: size,
    contradiction: contradiction,
    hotIntent: !!(shouldForceQuoteStep || (signal && (signal.intent === 'cotizacion' || signal.intent === 'compra' || /(precio|cuanto sale|cuanto cuesta|valor|costo|presupuesto)/.test(userText)))),
    lastBot: lastBot
  };
}

function inferSizeWord_(ctx) {
  var texts = [String((ctx && ctx.userMessage) || '')];
  var history = (ctx && ctx.chatHistory) || [];
  history.forEach(function(item) {
    if (item.role === 'user') texts.push(item.text || '');
  });

  var result = '';
  for (var i = texts.length - 1; i >= 0; i--) {
    var t = String(texts[i] || '').toLowerCase();
    if (/grande/.test(t)) return 'grande';
    if (/mediano/.test(t)) result = result || 'mediano';
    if (/chico|pequeno/.test(t)) result = result || 'chico';
  }
  return result;
}

function isSizeCoverageContradiction_(sizeWord, coverage) {
  if (!sizeWord || !coverage) return false;
  if (sizeWord === 'grande' && coverage <= 4) return true;
  if (sizeWord === 'chico' && coverage >= 6) return true;
  return false;
}

function buildDeterministicAdviceReply_(state) {
  var segment = coverageSegment_(state.coverage);

  if (state.clientType === 'comercio') {
    if (segment === 'small') {
      return 'Para comercio con cobertura chica, te conviene una opcion base escalable. Si queres, te explico que incluye una opcion inicial y una intermedia para comparar.';
    }
    if (segment === 'medium') {
      return 'Para comercio con esa cobertura, te conviene una opcion intermedia con monitoreo y gestion por app. Si queres, te detallo que incluye y que no incluye.';
    }
    return 'Para comercio con cobertura amplia, conviene una solucion robusta y escalable por zonas. Si queres, te propongo una configuracion recomendada por etapas.';
  }

  if (segment === 'small') {
    return 'Para hogar con cobertura chica, una opcion base suele funcionar bien y luego podes escalar. Si queres, te explico diferencia con una alternativa superior.';
  }
  if (segment === 'medium') {
    return 'Para hogar con esa cobertura, te conviene una opcion intermedia por equilibrio entre costo y proteccion. Si queres, te detallo componentes y plan sugerido.';
  }
  return 'Para hogar con cobertura amplia, te conviene una opcion escalable por zonas para proteger mejor sin sobredimensionar de entrada. Si queres, te paso propuesta por etapas.';
}

function buildDeterministicQuoteReply_(state) {
  if (state.localidad) {
    return 'Excelente, con localidad ' + state.localidad + ' te puedo preparar el rango estimado final. Si queres, pasame un telefono y te deriva un asesor para cerrar la cotizacion.';
  }

  var segment = coverageSegment_(state.coverage);
  if (state.clientType === 'comercio') {
    if (segment === 'small') {
      return 'Para cotizar comercio con cobertura chica, preparo dos alternativas: base e intermedia. Si queres, te pido localidad y te paso rango estimado de instalacion y plan mensual.';
    }
    if (segment === 'medium') {
      return 'Para cotizar comercio con cobertura media, te preparo una opcion intermedia con monitoreo. Pasame localidad y te comparto rango estimado de instalacion y plan mensual.';
    }
    return 'Para cotizar comercio con cobertura amplia, conviene armar propuesta por zonas. Si queres, pasame localidad y te doy rango estimado para avanzar con asesor.';
  }

  if (segment === 'small') {
    return 'Para cotizar hogar con cobertura chica, te puedo pasar dos opciones: inicial y superior. Decime localidad y te doy rango estimado de instalacion y plan mensual.';
  }
  if (segment === 'medium') {
    return 'Para cotizar hogar con cobertura media, te conviene opcion intermedia. Pasame localidad y te comparto rango estimado de instalacion y plan mensual.';
  }
  return 'Para cotizar hogar con cobertura amplia, te recomiendo una propuesta escalable por zonas. Si queres, pasame localidad y te doy rango estimado para avanzar.';
}

function coverageSegment_(coverage) {
  if (coverage <= 2) return 'small';
  if (coverage <= 5) return 'medium';
  return 'large';
}

function looksWeakOrTruncatedReply_(text) {
  var t = cleanText_(text).toLowerCase();
  if (!t) return true;
  if (t.length < 26) return true;
  // Solo marcar como debil cuando ademas sea relativamente corta.
  // Evita falsos positivos en respuestas validas que terminan con palabras comunes.
  if (t.length < 70 && /(para poder|para ayudarte|necesito|y\.|de\.|con\.)$/.test(t)) return true;
  return false;
}

function extractRelevantKnowledge_(query, text) {
  var q = String(query || '').toLowerCase();
  var lines = String(text || '')
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

  var scored = lines.map(function(line) {
    var l = line.toLowerCase();
    var score = 0;
    if (/kit|plan|monitoreo|camara|alarma|comercio|hogar/.test(l)) score += 1;
    if (q && l.indexOf(q.split(' ')[0]) !== -1) score += 2;
    if (q && /precio|cotiz|plan|kit/.test(q) && /precio|plan|kit/.test(l)) score += 2;
    return { line: line, score: score };
  });

  scored.sort(function(a, b) { return b.score - a.score; });
  var top = scored.filter(function(s) { return s.score > 0; }).slice(0, 2).map(function(s) { return normalizeKnowledgeLine_(s.line); });

  if (!top.length) return 'Te ayudo a elegir una opcion de seguridad segun tu necesidad y presupuesto.';
  return top.join(' ');
}

function normalizeKnowledgeLine_(line) {
  var t = String(line || '')
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
    return 'Si te parece, empezamos por lo basico: es para hogar o comercio?';
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

  if (
    ctx &&
    ctx.sessionState &&
    ctx.sessionState.clientTypeLocked &&
    isStateFresh_(ctx.sessionState.lastUpdatedAt, 90) &&
    (ctx.sessionState.clientType === 'hogar' || ctx.sessionState.clientType === 'comercio')
  ) {
    return ctx.sessionState.clientType;
  }

  var fromCurrent = detectTypeInText_(ctx && ctx.userMessage);
  if (fromCurrent) return fromCurrent;

  var history = (ctx && ctx.chatHistory) || [];
  for (var i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== 'user') continue;
    var t = detectTypeInText_(history[i].text);
    if (t) return t;
  }

  return '';
}

function detectTypeInText_(text) {
  var t = String(text || '').toLowerCase();
  if (/\bcomercio\b|\bcomercial\b|\blocal\b|\bnegocio\b/.test(t)) return 'comercio';
  if (/\bhogar\b|\bcasa\b|\bdepartamento\b/.test(t)) return 'hogar';
  return '';
}

function inferCoverageNeed_(ctx) {
  var candidates = [];
  candidates.push(String((ctx && ctx.userMessage) || ''));

  var history = (ctx && ctx.chatHistory) || [];
  history.forEach(function(item) {
    if (item.role === 'user') candidates.push(item.text || '');
  });

  var best = 0;
  if (ctx && ctx.sessionState && toNumber_(ctx.sessionState.coverage, 0) > 0) {
    best = toNumber_(ctx.sessionState.coverage, 0);
  }
  for (var i = 0; i < candidates.length; i++) {
    var t = String(candidates[i] || '').toLowerCase();
    if (!t) continue;
    var parsed = extractCoverageFromText_(t);
    var explicitMax = parsed.max;
    var explicitSum = parsed.sum;

    var adjectiveFloor = 0;
    if (/chico|chiquito|chiquitito|pequeno/.test(t)) adjectiveFloor = 2;
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

function extractCoverageFromText_(text) {
  var t = String(text || '').toLowerCase();
  t = t
    .replace(/\buna\b/g, '1')
    .replace(/\bun\b/g, '1')
    .replace(/\bdos\b/g, '2')
    .replace(/\btres\b/g, '3')
    .replace(/\bcuatro\b/g, '4')
    .replace(/\bcinco\b/g, '5')
    .replace(/\bseis\b/g, '6');
  var rgx = /(\d{1,2})\s*(accesos|acceso|ambientes|ambiente|puertas|ouertas|ventanas|ventana|zonas|zona|salones|salon|habitaciones|habitacion|dormitorios|dormitorio)/g;
  var out = { max: 0, sum: 0 };
  var m;

  while ((m = rgx.exec(t)) !== null) {
    var n = Number(m[1]) || 0;
    if (n > out.max) out.max = n;
    out.sum += n;
  }

  return out;
}

function buildDeterministicRecommendation_(clientType, coverage, intent) {
  var isHotIntent = intent === 'cotizacion' || intent === 'compra';

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
  var candidate = cleanText_(reply);
  var history = (ctx && ctx.chatHistory) || [];

  for (var i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== 'bot') continue;
    var lastBot = cleanText_(history[i].text);
    if (lastBot && lastBot.toLowerCase() === candidate.toLowerCase()) {
      return candidate + ' Si queres, en el siguiente mensaje te hago una recomendacion puntual para tu caso.';
    }
    break;
  }

  return candidate;
}

function isOutOfScopeQuestion_(text) {
  var t = String(text || '');
  if (!t) return false;

  var hasSecurityContext = /(alarma|camar|monitoreo|kit|plan|seguridad|hogar|comercio|cotiz|presupuesto|instal)/.test(t);
  if (hasSecurityContext) return false;

  var clearlyOffTopic = /(bebes|reptil|reptiloide|perro|gato|futbol|receta|astrolog|politic|distancia del sol|luna)/.test(t);
  return clearlyOffTopic;
}

function isGreetingOnly_(text) {
  var t = String(text || '').toLowerCase().trim();
  if (!t) return false;
  return /^(hola+|buenas|buen dia|buenas tardes|buenas noches|hello|hi|holi)[!.\s]*$/.test(t);
}

function isStopIntent_(text) {
  var t = String(text || '').toLowerCase();
  return /(no quiero nada|ya no quiero|no me interesa|dejalo ahi|deja ahi|cancelar|chau|adios|hasta luego)/.test(t);
}

function isConfusionTurn_(text) {
  var t = String(text || '').toLowerCase();
  if (!t) return false;
  if (t.length <= 8 && /que+/.test(t)) return true;
  return /(con que|con quee|en que me ayudas|en que ayudas|que haces|que ofreces)/.test(t);
}

function isFrustrationTurn_(text) {
  var t = String(text || '').toLowerCase();
  return /(fome|wea|wea fome|wea\s+fome|aburrido|malo|pesimo|horrible|broma|no sirve|errores por todos lados|falta de respeto|cagada)/.test(t);
}

function isGreetingComplaintTurn_(text) {
  var t = String(text || '').toLowerCase();
  return /(no saludas|ni saludas|sin saludar|falta de respeto)/.test(t);
}

function isTypeDisputeTurn_(text) {
  var t = String(text || '').toLowerCase();
  return /(como sabes.*comercio|como sabes.*hogar|no te he dado|no te di|quien dijo comercio|quien dijo hogar|no dije comercio|no dije hogar|por que asum)/.test(t);
}

function isStateFresh_(isoDate, maxMinutes) {
  try {
    if (!isoDate) return false;
    var then = new Date(String(isoDate)).getTime();
    if (!then) return false;
    var now = Date.now();
    var diffMin = (now - then) / 60000;
    return diffMin >= 0 && diffMin <= toNumber_(maxMinutes, 90);
  } catch (_err) {
    return false;
  }
}

function isTruncationComplaint_(text) {
  var t = String(text || '').toLowerCase();
  return /(llego cortado|mensaje cortado|se corto|quedo cortado|sale cortado|respuesta cortada)/.test(t);
}

function isAcknowledgementTurn_(text) {
  var t = String(text || '').toLowerCase().trim();
  if (!t) return false;
  return /^(ok|okay|dale|bueno|bueno si|perfecto|genial|listo|si|si dale|de una|va|joya|bien)$/.test(t);
}

function analyzeConversationProgress_(ctx) {
  var history = (ctx && ctx.chatHistory) || [];
  var hasRecommendation = false;

  for (var i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== 'bot') continue;
    var t = String(history[i].text || '').toLowerCase();
    if (/te conviene|te recomiendo|cobertura|opcion intermedia|opcion base|escalable/.test(t)) {
      hasRecommendation = true;
      break;
    }
  }

  return {
    hasRecommendation: hasRecommendation
  };
}

function getLastBotMessage_(ctx) {
  var history = (ctx && ctx.chatHistory) || [];
  for (var i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== 'bot') continue;
    var txt = cleanText_(history[i].text);
    if (txt) return txt;
  }
  return '';
}

function ensureEndsWithQuestionOrDot_(text) {
  var t = cleanText_(text);
  if (!t) return '';
  if (/[.!?]$/.test(t)) return t;
  return t + '.';
}

function buildEvents_(signal, score, status, botReplyResult, ctx, cfg) {
  var events = [];

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

function writeChatLog_(ctx, botResponse, intent, score, leadStatus, cfg, transcript, state) {
  var row = [
    new Date(),
    ctx.sessionId,
    ctx.userMessage,
    botResponse,
    intent,
    score,
    leadStatus,
    ctx.consent,
    ctx.sourcePage,
    transcript.docId || '',
    transcript.docUrl || '',
    (state && state.turnCount) || 1,
    new Date().toISOString()
  ];
  upsertRowBySession_(OP_SHEETS.CHAT_LOGS, ctx.sessionId, row);
}

function writeEvents_(sessionId, eventList, transcript, state) {
  var eventTypes = eventList.map(function(evt) { return evt.type; });
  var payload = {
    eventos: eventList,
    eventTypes: eventTypes,
    turnCount: (state && state.turnCount) || 1,
    updatedAt: new Date().toISOString(),
    transcriptDocId: transcript.docId || '',
    transcriptDocUrl: transcript.docUrl || ''
  };

  upsertRowBySession_(OP_SHEETS.EVENTOS, sessionId, [
    new Date(),
    sessionId,
    eventTypes.join('|') || 'sin_eventos',
    JSON.stringify(payload),
    false,
    transcript.docId || ''
  ]);
}

function writeLeadPrequal_(ctx, signal, score, status, resumen, cfg, transcript, state) {
  var payloadResumen = resumen
    ? JSON.stringify({ resumen: resumen, intent: signal.intent, score: score, status: status })
    : '';

  upsertRowBySession_(OP_SHEETS.LEADS, ctx.sessionId, [
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
    false,
    transcript.docId || '',
    transcript.docUrl || '',
    payloadResumen,
    (state && state.turnCount) || 1
  ]);
}

function handleAlerts_(eventList, ctx, score, props, cfg) {
  var hasHotLead = eventList.some(function(e) { return e.type === 'lead_caliente'; });
  if (hasHotLead) {
    var body = [
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

  var payload = {
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
    var res = UrlFetchApp.fetch(props.FORMS_WEBAPP_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var code = res.getResponseCode();
    var body = res.getContentText() || '';

    var synced = code >= 200 && code < 300 && /"ok"\s*:\s*true/.test(body);

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
  var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_OPERACION_ID'));
  var sh = ss.getSheetByName(OP_SHEETS.LEADS);
  if (!sh) return;

  var values = sh.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][1]) === String(sessionId)) {
      sh.getRange(i + 1, 12).setValue(!!synced);
      return;
    }
  }
}

function upsertRowBySession_(sheetName, sessionId, row) {
  var opId = PropertiesService.getScriptProperties().getProperty('SHEET_OPERACION_ID');
  var ss = SpreadsheetApp.openById(opId);
  var sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('No existe la pestana: ' + sheetName);

  var values = sh.getDataRange().getValues();
  var foundRow = 0;
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][1]) === String(sessionId)) {
      foundRow = i + 1;
      break;
    }
  }

  if (!foundRow) {
    sh.appendRow(row);
    return;
  }

  var targetColumns = Math.max(row.length, sh.getLastColumn());
  var padded = [];
  for (var c = 0; c < targetColumns; c++) {
    padded.push(c < row.length ? row[c] : '');
  }

  sh.getRange(foundRow, 1, 1, targetColumns).setValues([padded]);
}

function appendRow_(sheetName, row) {
  var opId = PropertiesService.getScriptProperties().getProperty('SHEET_OPERACION_ID');
  var ss = SpreadsheetApp.openById(opId);
  var sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('No existe la pestana: ' + sheetName);
  sh.appendRow(row);
}

function writeErrorSafe_(sessionId, type, message, providerCode, handledFallback) {
  try {
    var sid = sessionId || 'runtime';
    upsertRowBySession_(OP_SHEETS.ERRORES, sid, [
      new Date(),
      sid,
      type,
      String(message || '').slice(0, 1000),
      providerCode || '',
      !!handledFallback,
      new Date().toISOString()
    ]);
  } catch (_ignored) {}
}

function detectProviderCode_(errMsg) {
  var t = String(errMsg || '').toLowerCase();
  if (t.indexOf('quota') !== -1 || t.indexOf('resource_exhausted') !== -1) return 'quota_exceeded';
  if (t.indexOf('429') !== -1) return 'rate_limited';
  if (t.indexOf('401') !== -1 || t.indexOf('403') !== -1) return 'auth_error';
  return 'provider_error';
}

function isIaUnavailableError_(errMsg) {
  var t = String(errMsg || '').toLowerCase();
  if (!t) return false;

  return (
    t.indexOf('ia no disponible') !== -1 ||
    t.indexOf('gemini') !== -1 ||
    t.indexOf('respuesta ia debil o truncada') !== -1 ||
    t.indexOf('provider_error') !== -1 ||
    t.indexOf('rate_limited') !== -1 ||
    t.indexOf('quota') !== -1 ||
    t.indexOf('resource_exhausted') !== -1
  );
}

function hasValidContact_(ctx, cfg) {
  var phoneOk = ctx.lead.telefono && ctx.lead.telefono.length >= cfg.telefonoMinDigitos;
  var emailOk = isValidEmail_(ctx.lead.email);
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
  var n = Number(value);
  return isNaN(n) ? fallback : n;
}

function toBool_(value, fallback) {
  if (typeof value === 'boolean') return value;
  var t = String(value || '').toLowerCase();
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
  var props = getScriptProps_();
  var cfg = loadRuntimeConfig_(props);

  var out = {
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
  var p = PropertiesService.getScriptProperties();
  var apiKey = p.getProperty('GEMINI_API_KEY') || '';
  if (!apiKey) throw new Error('Falta GEMINI_API_KEY en Script Properties');

  var url = 'https://generativelanguage.googleapis.com/v1/models?key=' + encodeURIComponent(apiKey);
  var res = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
  var code = res.getResponseCode();
  var txt = res.getContentText() || '';

  if (code < 200 || code >= 300) {
    throw new Error('ListModels HTTP ' + code + ': ' + txt.slice(0, 800));
  }

  var data = JSON.parse(txt);
  var models = (data.models || [])
    .filter(function(m) {
      var methods = m.supportedGenerationMethods || [];
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

/**
 * Smoke test de Gemini sin pasar por todo el pipeline de chat.
 * Sirve para verificar conectividad, modelo y formato de salida.
 */
function testGeminiSmoke() {
  var p = PropertiesService.getScriptProperties();
  var apiKey = p.getProperty('GEMINI_API_KEY') || '';
  var model = p.getProperty('GEMINI_MODEL') || 'gemini-2.5-flash';
  if (!apiKey) throw new Error('Falta GEMINI_API_KEY en Script Properties');

  var prompt = 'Responde en una sola frase: confirmo que Gemini esta operativo.';
  var raw = callGemini_(prompt, apiKey, model);

  var out = {
    ok: true,
    model: model,
    rawLength: String(raw || '').length,
    rawPreview: String(raw || '').slice(0, 200),
    timestamp: new Date().toISOString()
  };

  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

/**
 * Test diagnostico del post-proceso y detector de truncado.
 */
function testBuildBotReplyDebug() {
  var props = getScriptProps_();
  var cfg = loadRuntimeConfig_(props);

  var payload = {
    sessionId: 'test_debug_' + Utilities.getUuid().slice(0, 8),
    message: 'hola',
    sourcePage: 'apps-script-test',
    userAgent: 'apps-script-test',
    chatHistory: []
  };

  var ctx = buildContext_(payload, cfg);
  var signal = detectCommercialSignal_(ctx.userMessage);
  var docs = readKnowledgeDocs_(props);
  var historyText = formatHistoryForPrompt_(ctx.chatHistory);
  var prompt = [
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
    '\n\nINTENCION DETECTADA: ', signal.intent
  ].join('');

  try {
    var raw = callGemini_(prompt, props.GEMINI_API_KEY, props.GEMINI_MODEL);
    var processed = postProcessReply_(raw, ctx);
    var weak = looksWeakOrTruncatedReply_(processed);

    var out = {
      ok: !weak,
      model: props.GEMINI_MODEL,
      rawLength: String(raw || '').length,
      processedLength: String(processed || '').length,
      weakOrTruncated: weak,
      rawPreview: String(raw || '').slice(0, 260),
      processedPreview: String(processed || '').slice(0, 260),
      timestamp: new Date().toISOString()
    };

    Logger.log(JSON.stringify(out, null, 2));
    return out;
  } catch (err) {
    var outErr = {
      ok: false,
      model: props.GEMINI_MODEL,
      error: String(err && err.message ? err.message : err),
      timestamp: new Date().toISOString()
    };

    Logger.log(JSON.stringify(outErr, null, 2));
    return outErr;
  }
}


