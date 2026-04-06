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

var CHAT_VERSION = '1.1.0';
var IA_UNAVAILABLE_MESSAGE = 'En este momento no hay operador disponible para atencion. Comunicate por WhatsApp o completa el formulario y te contactamos a la brevedad.';

/**
 * FUNCION DE TEST — Ejecutar manualmente desde Apps Script (boton Run).
 * Diagnostica si la carpeta Chats_History funciona correctamente.
 * Los resultados aparecen en View > Logs (Ctrl+Enter).
 */
function TEST_carpeta_transcripts() {
  var props = getScriptProps_();
  Logger.log('=== TEST CARPETA TRANSCRIPTS ===');
  Logger.log('CHAT_TRANSCRIPTS_FOLDER_ID en props: "' + (props.CHAT_TRANSCRIPTS_FOLDER_ID || 'VACIO') + '"');

  var folderId = resolveTranscriptsFolderId_(props);
  Logger.log('resolveTranscriptsFolderId_ devolvio: "' + (folderId || 'NULL') + '"');

  if (!folderId) {
    Logger.log('ERROR: No se pudo resolver la carpeta. Revisa Script Properties o que exista Chats_History en Drive.');
    return;
  }

  try {
    var folder = DriveApp.getFolderById(folderId);
    Logger.log('Carpeta encontrada: nombre="' + folder.getName() + '", id=' + folder.getId());
  } catch (e) {
    Logger.log('ERROR al abrir carpeta con ID ' + folderId + ': ' + e);
    return;
  }

  // Crear un doc de prueba.
  Logger.log('Creando doc de prueba...');
  var testDocId = createDocInFolder_('TEST_borrar_' + new Date().getTime(), folderId, 'test_session');
  Logger.log('Doc creado con ID: ' + testDocId);

  // Verificar donde quedo.
  try {
    var testFile = DriveApp.getFileById(testDocId);
    var parents = testFile.getParents();
    var parentNames = [];
    while (parents.hasNext()) {
      var p = parents.next();
      parentNames.push(p.getName() + ' (' + p.getId() + ')');
    }
    Logger.log('El doc esta en carpeta(s): ' + (parentNames.length > 0 ? parentNames.join(', ') : 'NINGUNA (huerfano!)'));
    Logger.log('Esperado: Chats_History (' + folderId + ')');

    // Limpiar: borrar el doc de prueba.
    testFile.setTrashed(true);
    Logger.log('Doc de prueba enviado a papelera. Test completo.');
  } catch (e) {
    Logger.log('ERROR verificando doc de prueba: ' + e);
  }
}

var OP_SHEETS = {
  CHAT_LOGS: 'chat_logs',
  EVENTOS: 'eventos_chat',
  ERRORES: 'errores_chat',
  LEADS: 'leads_precalificados'
};

var PROMPT_OPT = {
  HISTORY_ITEMS: 6,
  MAX_INSTRUCTIONS_CHARS: 2400,
  MAX_KNOWLEDGE_CHARS: 3500,
  MAX_EVENTS_CHARS: 800,
  DOCS_CACHE_SECONDS: 300,
  MODELS_CACHE_SECONDS: 900,
  DISCOVERY_MAX_MODELS: 10,
  ENABLE_MODEL_DISCOVERY: false,
  MAX_OUTPUT_TOKENS: 1024,
  MIN_REPLY_CHARS: 45,
  GEMINI_RETRY_ATTEMPTS: 2,
  GEMINI_RETRY_BASE_MS: 450,
  GEMINI_TOTAL_TIMEOUT_MS: 22000,
  GEMINI_MAX_MODELS_PER_REQUEST: 2,
  GEMINI_RESCUE_TIMEOUT_MS: 12000,
  GEMINI_RESCUE_MODELS: 2,
  ENABLE_RESCUE_PASS: true,
  PROVIDER_CIRCUIT_SECONDS: 60,
  PROVIDER_CIRCUIT_FAIL_THRESHOLD: 2,
  PROVIDER_FAIL_COUNT_SECONDS: 180
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
    lockAcquired = lock.tryLock(2500);

    var props = getScriptProps_();
    var cfg = loadRuntimeConfig_(props);
    registerTurnAudit_(cfg);

    var ctx = buildContext_(payload, cfg);
    var prevState = loadSessionState_(ctx.sessionId);
    hydrateContextFromState_(ctx, prevState);
    validateInput_(ctx, cfg);
    enrichLeadFromMessage_(ctx, cfg);

    var signal = detectCommercialSignal_(ctx.userMessage);
    var leadScore = scoreLead_(signal, ctx, cfg);
    var leadStatus = classifyLeadStatus_(leadScore, cfg);

    var botReplyResult = buildBotReply_(ctx, signal, props, cfg);

    // Si IA no estuvo disponible, responder rapido y evitar operaciones pesadas
    // para no caer en timeout del frontend.
    if (botReplyResult.mode !== 'ia') {
      // Persistir estado minimo tambien en fallback para mantener continuidad
      // sin ejecutar operaciones pesadas (Docs/Sheets/Drive).
      try {
        var fallbackState = buildNextSessionState_(ctx, signal, botReplyResult, prevState, { docId: '', docUrl: '' });
        saveSessionState_(ctx.sessionId, fallbackState);
      } catch (_fallbackStateErr) {}

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
          fallbackReason: botReplyResult.fallbackReason || '',
          providerCode: botReplyResult.providerCode || '',
          diagnosticCode: buildDiagnosticCode_(botReplyResult.fallbackReason, botReplyResult.providerCode),
          providerMessage: botReplyResult.providerMessage || '',
          syncedToOfficialLeads: false,
          syncDetail: 'omitido_en_fallback',
          transcriptDocId: '',
          transcriptDocUrl: ''
        }
      };
    }

    var transcript = { docId: '', docUrl: '' };
    var nextState = prevState || {};
    var syncResult = { synced: false, detail: 'sync_no_ejecutado' };

    try {
      transcript = persistConversationTranscript_(ctx, botReplyResult.replyText, props);

      nextState = buildNextSessionState_(ctx, signal, botReplyResult, prevState, transcript);
      saveSessionState_(ctx.sessionId, nextState);

      var eventList = buildEvents_(signal, leadScore, leadStatus, botReplyResult, ctx, cfg);
      var resumen = buildConversationSummary_(ctx, signal, leadScore, leadStatus);

      writeChatLog_(ctx, botReplyResult.replyText, signal.intent, leadScore, leadStatus, cfg, transcript, nextState);
      writeEvents_(ctx.sessionId, eventList, transcript, nextState);
      writeLeadPrequal_(ctx, signal, leadScore, leadStatus, resumen, cfg, transcript, nextState);

      handleAlerts_(eventList, ctx, leadScore, props, cfg);

      syncResult = maybeSyncLeadToForms_(ctx, signal, leadScore, leadStatus, props, cfg);
    } catch (opsErr) {
      writeErrorSafe_(ctx.sessionId, 'post_reply_ops_error', String(opsErr), 'ops_error', true);
    }

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
        fallbackReason: botReplyResult.fallbackReason || '',
        providerCode: botReplyResult.providerCode || '',
        diagnosticCode: '',
        providerMessage: botReplyResult.providerMessage || '',
        syncedToOfficialLeads: syncResult.synced,
        syncDetail: syncResult.detail,
        transcriptDocId: transcript.docId,
        transcriptDocUrl: transcript.docUrl,
        // TODO: QUITAR debug fields cuando ya no se necesiten.
        _debugApiKey: _lastUsedKeyIndex || 0,
        _debugModel: _lastUsedModel || ''
      }
    };
  } catch (err) {
    var msg = (err && err.message) ? String(err.message) : String(err);
    writeErrorSafe_(null, 'runtime_error', msg, 'n/a', false);

    return {
      ok: false,
      message: IA_UNAVAILABLE_MESSAGE,
      data: {
        fallbackReason: 'runtime_error',
        providerCode: 'runtime',
        diagnosticCode: buildDiagnosticCode_('runtime_error', 'runtime'),
        providerMessage: msg.slice(0, 300)
      }
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
  var rawApiKey = p.getProperty('GEMINI_API_KEY');
  var rawModel = p.getProperty('GEMINI_MODEL');
  var obj = {
    DOC_INSTRUCCIONES_ID: p.getProperty('DOC_INSTRUCCIONES_ID') || '',
    DOC_CONOCIMIENTO_ID: p.getProperty('DOC_CONOCIMIENTO_ID') || '',
    DOC_EVENTOS_ID: p.getProperty('DOC_EVENTOS_ID') || '',
    SHEET_CONFIG_ID: p.getProperty('SHEET_CONFIG_ID') || '',
    SHEET_OPERACION_ID: p.getProperty('SHEET_OPERACION_ID') || '',
    ALERT_EMAIL: p.getProperty('ALERT_EMAIL') || '',
    GEMINI_API_KEY: cleanText_(rawApiKey),
    GEMINI_MODEL: sanitizeGeminiModelName_(rawModel) || 'gemini-2.5-flash',
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
    alertaCuotaCooldownMin: toNumber_(kv.alerta_cuota_cooldown_min, 360),
    strictFallbackAudit: toBool_(kv.strict_fallback_audit, true),
    strictFallbackWarnRatio: toNumber_(kv.strict_fallback_warn_ratio, 0.10),
    strictFallbackMinTurns: toNumber_(kv.strict_fallback_min_turns, 20)
  };
}

function buildContext_(payload, cfg) {
  var lead = payload.leadData || {};
  var sessionIdIncoming = cleanText_(payload.sessionId);
  var sessionIdResolved = resolveSessionAlias_(sessionIdIncoming);
  var userMessage = cleanText_(payload.message);
  var normalizedHistory = normalizeChatHistory_(payload.chatHistory);
  var forceNewConversation = shouldForceFreshConversation_(userMessage, normalizedHistory, lead);
  var finalSessionId = forceNewConversation
    ? ('sess_' + Utilities.getUuid().slice(0, 8))
    : (sessionIdResolved || ('sess_' + Utilities.getUuid().slice(0, 8)));

  if (forceNewConversation && sessionIdIncoming && sessionIdIncoming !== finalSessionId) {
    registerSessionAlias_(sessionIdIncoming, finalSessionId);
  }

  return {
    sessionId: finalSessionId,
    userMessage: userMessage,
    sourcePage: cleanText_(payload.sourcePage),
    userAgent: cleanText_(payload.userAgent),
    chatHistory: forceNewConversation ? [] : normalizedHistory,
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
    forceNewConversation: forceNewConversation,
    originalSessionId: sessionIdIncoming,
    timestamp: new Date().toISOString(),
    cfg: cfg
  };
}

function resolveSessionAlias_(sessionId) {
  var sid = cleanText_(sessionId);
  if (!sid) return '';

  try {
    var cache = CacheService.getScriptCache();
    var mapped = cleanText_(cache.get('chat_sid_alias_' + sid));
    return mapped || sid;
  } catch (_err) {
    return sid;
  }
}

function registerSessionAlias_(oldSessionId, newSessionId) {
  var oldSid = cleanText_(oldSessionId);
  var newSid = cleanText_(newSessionId);
  if (!oldSid || !newSid || oldSid === newSid) return;

  try {
    var cache = CacheService.getScriptCache();
    cache.put('chat_sid_alias_' + oldSid, newSid, 21600);
    cache.remove('chat_state_' + oldSid);
  } catch (_err) {}
}

function shouldForceFreshConversation_(message, history, lead) {
  var msg = String(message || '').toLowerCase().trim();
  if (!msg) return false;

  var isResetIntent = /^(hola+|buenas|buen dia|buenas tardes|buenas noches|hello|hi|holi|inicio|empezar|reiniciar|nueva conversacion|nuevo chat)$/.test(msg);
  if (!isResetIntent) return false;

  // Si ya vienen datos de lead en el payload, no forzar reset automatico.
  var hasLeadData = !!(
    cleanText_(lead && lead.nombre) ||
    onlyDigits_(lead && lead.telefono).length >= 8 ||
    isValidEmail_(lead && lead.email) ||
    cleanText_(lead && lead.localidad) ||
    cleanText_(lead && lead.tipoCliente)
  );
  if (hasLeadData) return false;

  // Si llega saludo/reset y hay historial heredado del frontend, empezar limpio.
  return true;
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
  if (ctx && ctx.forceNewConversation) {
    ctx.sessionState = {};
    return;
  }

  if (shouldResetStateForNewChat_(ctx)) {
    ctx.sessionState = {};
    return;
  }

  if (!state) return;
  if (!ctx.lead.tipoCliente && state.clientType && state.clientTypeLocked && isStateFresh_(state.lastUpdatedAt, 90)) {
    ctx.lead.tipoCliente = state.clientType;
  }
  if (!ctx.lead.localidad && state.localidad) ctx.lead.localidad = state.localidad;
  if (!ctx.lead.telefono && state.contactPhone) ctx.lead.telefono = onlyDigits_(state.contactPhone);
  if (!ctx.lead.email && state.contactEmail) ctx.lead.email = cleanText_(state.contactEmail).toLowerCase();
  ctx.sessionState = state;
}

function shouldResetStateForNewChat_(ctx) {
  var hasHistory = !!(ctx && ctx.chatHistory && ctx.chatHistory.length);
  if (hasHistory) return false;

  var msg = String((ctx && ctx.userMessage) || '').toLowerCase().trim();
  if (!msg) return false;

  // Si no llega historial y el usuario abre una charla desde saludo/inicio,
  // evitar heredar estado cacheado de una conversacion previa.
  if (isGreetingOnly_(msg)) return true;
  if (/^(inicio|empezar|reiniciar|nueva conversacion|nuevo chat)$/.test(msg)) return true;

  return false;
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
    contactPhone: prev.contactPhone || '',
    contactEmail: prev.contactEmail || '',
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

  if (ctx && ctx.lead) {
    if (ctx.lead.telefono && onlyDigits_(ctx.lead.telefono).length >= 8) {
      next.contactPhone = onlyDigits_(ctx.lead.telefono);
    }
    if (isValidEmail_(ctx.lead.email || '')) {
      next.contactEmail = cleanText_(ctx.lead.email).toLowerCase();
    }
  }

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

function enrichLeadFromMessage_(ctx, cfg) {
  if (!ctx || !ctx.lead) return;

  var msg = String(ctx.userMessage || '');
  var minDigits = toNumber_(cfg && cfg.telefonoMinDigitos, 8);

  if (!ctx.lead.telefono) {
    var inferredPhone = extractPhoneFromText_(msg, minDigits);
    if (inferredPhone) ctx.lead.telefono = inferredPhone;
  }

  if (!ctx.lead.email) {
    var inferredEmail = extractEmailFromText_(msg);
    if (inferredEmail) ctx.lead.email = inferredEmail;
  }
}

function extractPhoneFromText_(text, minDigits) {
  var t = String(text || '');
  if (!t) return '';

  var matches = t.match(/[+]?\d[\d\s()\-\.]{6,}\d/g) || [];
  var best = '';
  var min = Math.max(6, toNumber_(minDigits, 8));

  for (var i = 0; i < matches.length; i++) {
    var digits = onlyDigits_(matches[i]);
    if (digits.length < min) continue;
    if (digits.length > 15) continue;
    if (digits.length > best.length) best = digits;
  }

  return best;
}

function extractEmailFromText_(text) {
  var t = String(text || '').toLowerCase();
  var m = t.match(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i);
  return m && m[0] ? cleanText_(m[0]).toLowerCase() : '';
}

function persistConversationTranscript_(ctx, botReplyText, props) {
  var out = { docId: '', docUrl: '' };

  try {
    var state = loadSessionState_(ctx.sessionId);
    var docId = state.transcriptDocId || '';
    var doc;

    if (docId) {
      try {
        doc = DocumentApp.openById(docId);
      } catch (_openErr) {
        // Si el doc anterior fue borrado o es inaccesible, crear uno nuevo.
        docId = '';
      }
    }

    if (!docId) {
      var dateStr = Utilities.formatDate(new Date(), 'UTC', 'yyyyMMdd_HHmmss');
      var title = 'chat_' + ctx.sessionId + '_' + dateStr;

      // Resolver carpeta destino ANTES de crear el archivo.
      var targetFolderId = resolveTranscriptsFolderId_(props);

      // Crear el Google Doc directamente en la carpeta destino usando Drive API.
      // Esto evita el problema de crear en raiz y fallar al mover.
      docId = createDocInFolder_(title, targetFolderId, ctx.sessionId);
      doc = DocumentApp.openById(docId);

      var head = doc.getBody();
      head.appendParagraph('=== Transcripcion de Chat Smarthome ===');
      head.appendParagraph('Session ID: ' + ctx.sessionId);
      head.appendParagraph('Creado UTC: ' + new Date().toISOString());
      head.appendParagraph('Pagina origen: ' + (ctx.sourcePage || 'n/a'));
      head.appendParagraph('User Agent: ' + (ctx.userAgent || 'n/a'));
      if (ctx.lead && ctx.lead.tipoCliente) {
        head.appendParagraph('Tipo cliente: ' + ctx.lead.tipoCliente);
      }
      head.appendParagraph('---');
    }

    var body = doc.getBody();
    var ts = new Date().toISOString();
    body.appendParagraph('[' + ts + '] CLIENTE: ' + (ctx.userMessage || ''));
    body.appendParagraph('[' + ts + '] ASESOR: ' + (botReplyText || ''));

    out.docId = docId;
    out.docUrl = 'https://docs.google.com/document/d/' + docId + '/edit';
  } catch (_err) {
    writeErrorSafe_(ctx.sessionId, 'transcript_persist_error', String(_err), 'transcript', true);
  }

  return out;
}

/**
 * Resuelve el ID de la carpeta donde guardar transcripciones.
 * Prioridad:
 *   1. CHAT_TRANSCRIPTS_FOLDER_ID de Script Properties.
 *   2. Buscar carpeta llamada "Chats_History" en Drive.
 *   3. Crear la carpeta "Chats_History" si no existe.
 */
function resolveTranscriptsFolderId_(props) {
  // 1. Script Property explicita.
  if (props && props.CHAT_TRANSCRIPTS_FOLDER_ID) {
    return props.CHAT_TRANSCRIPTS_FOLDER_ID;
  }

  // 2. Cache para no buscar/crear en cada request.
  var cache = CacheService.getScriptCache();
  var cacheKey = 'resolved_transcripts_folder_id';
  var cached = cache.get(cacheKey);
  if (cached) return cached;

  // 3. Buscar por nombre en Drive.
  try {
    var folders = DriveApp.getFoldersByName('Chats_History');
    if (folders.hasNext()) {
      var folderId = folders.next().getId();
      cache.put(cacheKey, folderId, 3600);
      return folderId;
    }
  } catch (_searchErr) {}

  // 4. No existe: CREAR la carpeta en la raiz de Drive.
  try {
    var newFolder = DriveApp.createFolder('Chats_History');
    var newFolderId = newFolder.getId();
    cache.put(cacheKey, newFolderId, 3600);
    return newFolderId;
  } catch (_createErr) {}

  return null;
}

/**
 * Crea un Google Doc y lo mueve a la carpeta destino.
 * Metodo robusto: DocumentApp.create + addFile/removeFile (clasico, sin moveTo).
 * Loguea cada paso para diagnosticar si algo falla.
 */
function createDocInFolder_(title, folderId, sessionId) {
  // Paso 1: Crear el documento (siempre en raiz inicialmente).
  var doc = DocumentApp.create(title);
  var docId = doc.getId();

  if (!folderId) {
    writeErrorSafe_(sessionId, 'transcript_no_folder',
      'No hay CHAT_TRANSCRIPTS_FOLDER_ID ni carpeta Chats_History en Drive. Archivo queda en raiz.',
      'transcript', true);
    return docId;
  }

  // Paso 2: Obtener file y folder.
  var file;
  var folder;
  try {
    file = DriveApp.getFileById(docId);
  } catch (fileErr) {
    writeErrorSafe_(sessionId, 'transcript_getfile_error',
      'No se pudo obtener el file recien creado: ' + String(fileErr),
      'transcript', true);
    return docId;
  }

  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (folderErr) {
    writeErrorSafe_(sessionId, 'transcript_getfolder_error',
      'Folder ID invalido (' + folderId + '): ' + String(folderErr),
      'transcript', true);
    return docId;
  }

  // Paso 3: Agregar el archivo a la carpeta destino.
  try {
    folder.addFile(file);
  } catch (addErr) {
    writeErrorSafe_(sessionId, 'transcript_addfolder_error',
      'addFile fallo para folder ' + folderId + ': ' + String(addErr),
      'transcript', true);
    return docId;
  }

  // Paso 4: Quitar el archivo de la carpeta raiz.
  try {
    var root = DriveApp.getRootFolder();
    root.removeFile(file);
  } catch (removeErr) {
    // No critico: el archivo ya esta en la carpeta correcta,
    // solo queda tambien en raiz.
    writeErrorSafe_(sessionId, 'transcript_removeroot_warn',
      'removeFile de raiz fallo (archivo queda en ambas): ' + String(removeErr),
      'transcript', true);
  }

  return docId;
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
      return roleLabel + ': ' + trimForPrompt_(item.text, 220);
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
  var hasInstallIntent = /(instalar|instalacion|contratar|quiero contratar|quiero poner|quiero\s+.*(alarma|sistema|camara|monitoreo)|necesito\s+.*(alarma|sistema|camara|monitoreo))/.test(t);
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
  // Circuit breaker: si el provider esta caido (NO por cuota, sino por error real),
  // no quemar mas llamadas. NOTA: NO activar circuit breaker para 429 porque
  // cada modelo tiene cuota independiente y uno puede funcionar cuando otro no.
  if (isProviderCircuitOpen_()) {
    var cachedCode = '';
    var cachedMsg = '';
    try {
      var cbCache = CacheService.getScriptCache();
      cachedCode = cleanText_(cbCache.get('chat_provider_last_error_code')) || 'circuit_open';
      cachedMsg = cleanText_(cbCache.get('chat_provider_last_error_msg')) || 'Circuit breaker activo por error previo';
    } catch (_cbErr) {}

    return {
      mode: 'fallback_unavailable',
      replyText: IA_UNAVAILABLE_MESSAGE,
      fallbackReason: 'circuit_breaker_open',
      providerCode: cachedCode,
      providerMessage: cachedMsg
    };
  }

  var useLightPrompt = shouldUseLightIaPrompt_(ctx, signal);
  var docs = {
    instructions: '',
    knowledge: '',
    events: ''
  };

  if (!useLightPrompt) {
    try {
      docs = readKnowledgeDocs_(props);
    } catch (docsErr) {
      // Si falla la lectura documental, continuar con contexto minimo
      // para no perder disponibilidad de respuesta IA.
      writeErrorSafe_(ctx.sessionId, 'docs_read_error', String(docsErr), 'docs_error', true);
    }
  }

  var historyText = formatHistoryForPrompt_(ctx.chatHistory);
  var instructionsCompact = trimForPrompt_(docs.instructions, PROMPT_OPT.MAX_INSTRUCTIONS_CHARS);
  var knowledgeCompact = buildCompactKnowledgeContext_(docs.knowledge, ctx, signal);
  var eventsCompact = buildCompactEventsContext_(docs.events, ctx, signal);
  var knownFacts = buildKnownFactsForPrompt_(ctx);
  var sessionCompact = buildSessionContextForPrompt_(ctx);

  var prompt = useLightPrompt
    ? buildLightIaPrompt_(ctx, signal, knownFacts, sessionCompact)
    : [
      'ROL: Sos asesor comercial de Smarthome, empresa argentina de seguridad (+8 anos, +1000 clientes). Tu objetivo es cerrar la venta o avanzar al maximo posible para que un asesor humano cierre por WhatsApp.',
      '\n\nINSTRUCCIONES DE COMPORTAMIENTO:\n',
      instructionsCompact,
      '\n\nCONOCIMIENTO COMERCIAL (PRECIOS, KITS, PLANES):\n',
      knowledgeCompact,
      '\n\nEVENTOS COMERCIALES:\n',
      eventsCompact,
      '\n\nHISTORIAL RECIENTE:\n',
      historyText,
      '\n\nMENSAJE CLIENTE:\n',
      ctx.userMessage,
      '\n\nDATOS CONFIRMADOS (NO REPREGUNTAR):\n',
      knownFacts,
      '\n\nCONTEXTO DE SESION (CONTINUIDAD):\n',
      sessionCompact,
      '\n\nDATOS LEAD PARCIALES:\n',
      JSON.stringify(ctx.lead),
      '\n\nINTENCION DETECTADA: ', signal.intent,
      '\n\nREGLAS DE RESPUESTA:',
      '\n- No te vuelvas a presentar si ya hay historial o si turnCount > 0.',
      '\n- No repitas saludo inicial en cada turno.',
      '\n- Responde en espanol, maximo 150 palabras.',
      '\n- Escribe en tono humano y natural, sin formato markdown, sin asteriscos, sin listas con guiones.',
      '\n- Si ya hay historial, no saludes.',
      '\n- No cierres con frases incompletas.',
      '\n- No pidas de nuevo datos ya confirmados en DATOS CONFIRMADOS.',
      '\n- Usa CONOCIMIENTO COMERCIAL como fuente principal. NUNCA inventes precios ni datos.',
      '\n- REGLA DE ORO PRECIOS: Si el cliente pregunta cuanto cuesta, cuanto sale, precios, valores o cualquier variante, SIEMPRE responde con numeros concretos PRIMERO. Da un rango de precios o el precio del kit/plan mas adecuado segun lo que ya sabes. NUNCA respondas solo con preguntas de diagnostico sin dar al menos un rango de precios. Ejemplo correcto: "Para una casa con alarma, los planes arrancan en $32.830/mes (Plan Video) y el kit desde $49.900 de instalacion. Dependiendo del tamaño de tu casa te conviene uno u otro. Cuantos ambientes tiene?"',
      '\n- Si el cliente pregunta que vendemos, explica brevemente: alarmas, camaras, monitoreo 24/7, equipamiento en comodato, instalacion profesional.',
      '\n- Da una respuesta util con informacion concreta y luego 1 pregunta puntual para avanzar.',
      '\n- Estrategia: responder la consulta del cliente PRIMERO con datos reales, luego preguntar para refinar la recomendacion.',
      '\n- Si el cliente tiene dudas, respondelas primero con datos concretos y luego avanza.',
      '\n- Si el cliente muestra intencion de compra, pedi nombre, telefono y localidad para derivar a un asesor.',
      '\n- Antes de derivar a asesor, confirma: "Puedo pasarle tus datos a un asesor para que te contacte?"',
      '\n- No repitas textualmente la misma pregunta de turnos previos.',
      '\n- Si el cliente esta confundido, responde primero su duda y recien despues hace una pregunta de avance.',
      '\n- IMPORTANTE: SIEMPRE termina tu respuesta con una oracion completa. Nunca dejes una frase a mitad. Si te quedas sin espacio, cierra con lo que tengas y una pregunta corta.'
    ].join('');

  if (!props.GEMINI_API_KEY) {
    registerFallbackAudit_(ctx, signal, 'no_api_key', 'GEMINI_API_KEY ausente', 'provider_error', false, cfg, props);
    return {
      mode: 'fallback_unavailable',
      replyText: IA_UNAVAILABLE_MESSAGE,
      fallbackReason: 'no_api_key',
      providerCode: 'provider_error',
      providerMessage: 'GEMINI_API_KEY ausente'
    };
  }

  try {
    var text = callGeminiWithMultiKey_(prompt, props.GEMINI_MODEL);
    noteProviderSuccess_();
    var processed = postProcessReply_(text, ctx);
    // Refinamiento deshabilitado: gasta 1 call API extra y en tier gratuito
    // no vale la pena el riesgo de quemar cuota por pulir redaccion.
    // processed = refineAbruptReplyWithIa_(processed, ctx, signal, props);

    processed = reconcileReplyWithKnownState_(processed, ctx, signal);
    processed = avoidLoopingReply_(processed, ctx, signal, docs.knowledge);
    return { mode: 'ia', replyText: processed };
  } catch (err) {
    var errMsg = String(err);

    // ESTRATEGIA CLAVE: si el prompt completo fallo (puede ser por tamano,
    // tokens, cuota, etc.), reintentar con un prompt MINIMO que tiene mucha
    // mas chance de pasar bajo limites de cuota/tokens.
    var lightRetry = tryLightPromptFallback_(ctx, signal, props);
    if (lightRetry) {
      return { mode: 'ia', replyText: lightRetry };
    }

    var rescued = tryRescueIaReply_(prompt, ctx, signal, props, errMsg);
    if (rescued && rescued.ok) {
      return { mode: 'ia', replyText: rescued.replyText };
    }

    var lastResort = tryLastResortDirectCall_(ctx, props);
    if (lastResort) {
      return { mode: 'ia', replyText: lastResort };
    }

    var providerCode = detectProviderCode_(errMsg);
    noteProviderFailure_(providerCode, errMsg);
    writeErrorSafe_(ctx.sessionId, 'ia_provider_error', errMsg, providerCode, false);
    var fallbackReason = classifyFallbackReason_(errMsg, props);

    registerFallbackAudit_(ctx, signal, fallbackReason, errMsg, providerCode, false, cfg, props);

    return {
      mode: 'fallback_unavailable',
      replyText: IA_UNAVAILABLE_MESSAGE,
      fallbackReason: fallbackReason,
      providerCode: providerCode,
      providerMessage: summarizeProviderError_(errMsg)
    };
  };
}

function shouldUseLightIaPrompt_(ctx, signal) {
  var history = (ctx && ctx.chatHistory) || [];
  var state = (ctx && ctx.sessionState) || {};
  var msg = cleanText_(ctx && ctx.userMessage).toLowerCase();
  var turnCount = toNumber_(state.turnCount, 0);
  var isEarlyConversation = (history.length === 0 && turnCount <= 0);
  var hasCommercialIntent = !!(signal && (signal.intent === 'cotizacion' || signal.intent === 'compra'));
  var hasLeadContext = !!(
    (ctx && ctx.lead && cleanText_(ctx.lead.tipoCliente)) ||
    (ctx && ctx.lead && cleanText_(ctx.lead.localidad)) ||
    (ctx && ctx.lead && cleanText_(ctx.lead.interes))
  );

  // NUNCA usar prompt liviano si hay intencion comercial o pregunta de precios/planes
  if (hasCommercialIntent || hasLeadContext) return false;
  if (/precio|cuanto|valor|cuesta|sale|plan|kit|cotiz|presupuesto|instalar|contratar/.test(msg)) return false;

  // Solo usar prompt liviano para saludos simples sin contexto
  if (isEarlyConversation && isGreetingOnly_(msg)) return true;

  return false;
}

function buildLightIaPrompt_(ctx, signal, knownFacts, sessionCompact) {
  return [
    'Sos asesor comercial de Smarthome, empresa de seguridad en Argentina (+8 anos, +1000 clientes).',
    'Ofrecemos alarmas, camaras y monitoreo 24/7 con equipamiento en comodato e instalacion profesional.',
    'Planes para hogar: Video ($32.830/mes), Basic ($41.230/mes), Plus ($44.030/mes), Pro ($48.993/mes). Comercio: Comercial ($62.930/mes). Precios con 30% dto por 6 meses.',
    'Kits de alarma desde $49.900 instalacion. Kits con camaras desde $94.900. Equipamiento en comodato (no se compra).',
    'REGLA: Si preguntan cuanto cuesta o precios, SIEMPRE responder con numeros concretos PRIMERO, luego preguntar para refinar.',
    'Responde en espanol, tono humano y natural. No uses markdown ni listas con guiones.',
    'Si es primer saludo, presentate breve como asesor de Smarthome y pregunta si busca proteger su hogar o comercio.',
    'Si ya hay continuidad de sesion, no saludes ni reinicies la conversacion.',
    'Maximo 100 palabras. SIEMPRE termina con una oracion completa, nunca dejes una frase cortada.',
    'MENSAJE CLIENTE: ' + String((ctx && ctx.userMessage) || ''),
    'INTENCION: ' + String((signal && signal.intent) || 'info'),
    'DATOS CONFIRMADOS: ' + String(knownFacts || ''),
    'CONTEXTO SESION: ' + String(sessionCompact || '')
  ].join('\n');
}

function tryRescueIaReply_(prompt, ctx, signal, props, originalErrMsg) {
  if (!toBool_(PROMPT_OPT.ENABLE_RESCUE_PASS, false)) return { ok: false };
  if (!props || !props.GEMINI_API_KEY) return { ok: false };

  var errMsg = String(originalErrMsg || '').toLowerCase();
  if (errMsg.indexOf('no_api_key') !== -1) return { ok: false };

  try {
    // Ultimo intento de rescate con prompt compacto via multi-key.
    Utilities.sleep(120);

    var rescuePrompt = buildRescuePrompt_(ctx, signal);
    var rescueText = callGeminiWithMultiKey_(rescuePrompt, props.GEMINI_MODEL);

    if (!cleanText_(rescueText)) return { ok: false };

    var processed = postProcessReply_(rescueText, ctx);
    processed = reconcileReplyWithKnownState_(processed, ctx, signal);
    processed = avoidLoopingReply_(processed, ctx, signal, '');

    if (cleanText_(processed)) {
      return { ok: true, replyText: processed };
    }
  } catch (_rescueErr) {}

  return { ok: false };
}

/**
 * Ultimo recurso absoluto: intenta UN solo call directo a Gemini
 * con cada modelo conocido y un prompt ultra-minimo.
 * Solo se llama si TODO lo demas fallo. Devuelve texto o null.
 */
function tryLastResortDirectCall_(ctx, props) {
  if (!props || !props.GEMINI_API_KEY) return null;

  var msg = cleanText_(ctx && ctx.userMessage) || 'hola';
  var miniPrompt = 'Sos un asesor comercial de Smarthome (alarmas, camaras, monitoreo 24/7 en Argentina). Planes desde $32.830/mes con 30% dto. Equipamiento en comodato. Responde breve en espanol al cliente: ' + msg;

  // Ultimo intento con multi-key y Flash Lite.
  try {
    var text = callGeminiWithMultiKey_(miniPrompt, 'gemini-2.5-flash-lite');
    if (cleanText_(text)) {
      noteProviderSuccess_();
      return postProcessReply_(text, ctx);
    }
  } catch (_lastErr) {}

  return null;
}

/**
 * Cuando el prompt completo falla (por cuota, tokens, timeout, etc.),
 * reintentar con un prompt MINIMO y el modelo mas liviano disponible.
 * El prompt liviano tiene muchos menos tokens y pasa bajo limites
 * mas restrictivos. Devuelve texto o null.
 */
function tryLightPromptFallback_(ctx, signal, props) {
  if (!props || !props.GEMINI_API_KEY) return null;

  var knownFacts = buildKnownFactsForPrompt_(ctx);
  var sessionCompact = buildSessionContextForPrompt_(ctx);
  var lightPrompt = buildLightIaPrompt_(ctx, signal, knownFacts, sessionCompact);

  // Usar multi-key para el prompt liviano tambien.
  try {
    var text = callGeminiWithMultiKey_(lightPrompt, 'gemini-2.5-flash-lite');
    if (cleanText_(text)) {
      noteProviderSuccess_();
      return postProcessReply_(text, ctx);
    }
  } catch (_lightErr) {}

  return null;
}

function avoidLoopingReply_(reply, ctx, signal, knowledgeText) {
  var out = cleanText_(reply);
  if (!out) return out;

  var lastBot = cleanText_(getLastBotMessage_(ctx));
  if (!lastBot) return out;

  if (out.toLowerCase() === lastBot.toLowerCase()) {
    // En modo IA exitoso, no inyectar respuestas hardcodeadas: conservar salida del modelo.
    return out;
  }

  return out;
}

function buildKnownFactsForPrompt_(ctx) {
  var state = (ctx && ctx.sessionState) || {};
  var type = inferClientType_(ctx) || state.clientType || '';
  var locality = (ctx && ctx.lead && ctx.lead.localidad) || state.localidad || '';
  var coverage = inferCoverageNeed_(ctx);
  var contact = hasAnyContactData_(ctx) ? 'si' : 'no';

  return [
    'tipo_cliente=' + (type || 'no_definido'),
    'localidad=' + (locality || 'no_definida'),
    'cobertura_aprox=' + (coverage > 0 ? String(coverage) : 'no_definida'),
    'contacto=' + contact
  ].join('; ');
}

function hasAnyContactData_(ctx) {
  var lead = (ctx && ctx.lead) || {};
  var hasPhone = onlyDigits_(lead.telefono || '').length >= 8;
  var hasEmail = isValidEmail_(lead.email || '');
  return !!(hasPhone || hasEmail);
}

function reconcileReplyWithKnownState_(reply, ctx, signal) {
  var out = cleanText_(reply);
  if (!out) return out;

  var lower = out.toLowerCase();
  var state = (ctx && ctx.sessionState) || {};
  var knownType = !!(inferClientType_(ctx) || state.clientType);
  var knownLocalidad = !!(((ctx && ctx.lead && ctx.lead.localidad) || state.localidad || '').trim());
  var knownCoverage = inferCoverageNeed_(ctx) > 0;

  var asksType = /(es para hogar o comercio|si es para hogar o comercio|hogar o comercio\?)/.test(lower);
  var asksLocalidad = /(pasame tu localidad|decime tu localidad|confirmame tu localidad|cual es tu localidad)/.test(lower);
  var asksCoverage = /(cuantos accesos|cuantos ambientes|cantidad de accesos|cantidad de ambientes)/.test(lower);

  if ((knownType && asksType) || (knownLocalidad && asksLocalidad) || (knownCoverage && asksCoverage)) {
    // Evitar override con texto fijo cuando IA respondio correctamente.
    return out;
  }

  return out;
}

function buildCompactKnowledgeContext_(knowledgeText, ctx, signal) {
  var q = [
    String((ctx && ctx.userMessage) || ''),
    String((signal && signal.intent) || ''),
    String((ctx && ctx.lead && ctx.lead.tipoCliente) || ''),
    String((ctx && ctx.lead && ctx.lead.interes) || '')
  ].join(' ').trim();

  // Para intenciones comerciales (cotizacion, compra) siempre enviar conocimiento completo
  // truncado solo por limite de chars, no por filtering.
  var isCommercial = !!(signal && (signal.intent === 'cotizacion' || signal.intent === 'compra'));
  var msgLower = String((ctx && ctx.userMessage) || '').toLowerCase();
  var asksPricing = /precio|cuanto|valor|cuesta|sale|plan|kit|cotiz|presupuesto/.test(msgLower);

  // Tambien revisar historial reciente: si en los ultimos turnos el usuario pregunto precios,
  // seguimos enviando contexto completo de pricing porque la conversacion sigue en ese tema.
  if (!asksPricing && ctx && ctx.chatHistory) {
    for (var hi = Math.max(0, ctx.chatHistory.length - 6); hi < ctx.chatHistory.length; hi++) {
      var entry = ctx.chatHistory[hi];
      if (entry && entry.role === 'user') {
        var histMsg = String(entry.text || '').toLowerCase();
        if (/precio|cuanto|valor|cuesta|sale|cotiz|presupuesto/.test(histMsg)) {
          asksPricing = true;
          break;
        }
      }
    }
  }

  if (isCommercial || asksPricing) {
    return trimForPrompt_(knowledgeText, PROMPT_OPT.MAX_KNOWLEDGE_CHARS);
  }

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
  var models = buildGeminiModelCandidates_(preferredModel, apiKey);
  var maxModels = Math.max(1, toNumber_(PROMPT_OPT.GEMINI_MAX_MODELS_PER_REQUEST, 5));
  var startMs = Date.now();
  var totalBudgetMs = Math.max(5000, toNumber_(PROMPT_OPT.GEMINI_TOTAL_TIMEOUT_MS, 15000));
  var errors = [];

  // IMPORTANTE: NO abortar ante 429 de un modelo. Cada modelo/familia tiene
  // su propia cuota independiente. Si gemini-2.5-flash da 429, gemini-2.5-flash-lite
  // puede tener cuota disponible. Siempre probar TODOS los candidatos.
  for (var i = 0; i < models.length && i < maxModels; i++) {
    if ((Date.now() - startMs) >= totalBudgetMs) {
      errors.push('timeout_budget_exceeded');
      break;
    }

    var model = models[i];
    try {
      return callGeminiWithRetries_(prompt, apiKey, model, PROMPT_OPT.GEMINI_RETRY_ATTEMPTS, startMs, totalBudgetMs);
    } catch (err) {
      var msg = String(err && err.message ? err.message : err);
      errors.push(model + ' -> ' + msg.slice(0, 220));
      continue;
    }
  }

  throw new Error('Gemini sin cupo disponible en modelos probados: ' + errors.join(' || '));
}

function callGeminiWithRetries_(prompt, apiKey, model, attempts) {
  var maxAttempts = Math.max(1, toNumber_(attempts, 3));
  var baseMs = Math.max(150, toNumber_(PROMPT_OPT.GEMINI_RETRY_BASE_MS, 300));
  var startMs = Date.now();
  var totalBudgetMs = Math.max(5000, toNumber_(PROMPT_OPT.GEMINI_TOTAL_TIMEOUT_MS, 15000));
  var lastErr = null;

  if (arguments.length >= 5) {
    startMs = toNumber_(arguments[4], startMs);
  }
  if (arguments.length >= 6) {
    totalBudgetMs = Math.max(2500, toNumber_(arguments[5], totalBudgetMs));
  }

  for (var i = 0; i < maxAttempts; i++) {
    if ((Date.now() - startMs) >= totalBudgetMs) {
      break;
    }

    try {
      return callGemini_(prompt, apiKey, model);
    } catch (err) {
      lastErr = err;
      var msg = String(err && err.message ? err.message : err);
      // 429 (cuota) NO es retryable a nivel de reintentos inmediatos:
      // la cuota no se resetea en milisegundos. Propagar para probar otro modelo.
      var isRetryable = isTransientProviderError_(msg);
      var isLastAttempt = i >= (maxAttempts - 1);
      if (!isRetryable || isLastAttempt) break;

      var waitMs = computeRetryBackoffMs_(i, baseMs);
      var elapsed = Date.now() - startMs;
      var remaining = totalBudgetMs - elapsed;
      if (remaining <= 120) break;
      if (waitMs > remaining - 60) waitMs = Math.max(60, remaining - 60);
      Utilities.sleep(waitMs);
    }
  }

  throw lastErr || new Error('Gemini retry agotado o timeout de presupuesto total');
}

function computeRetryBackoffMs_(attemptIndex, baseMs) {
  var exp = Math.pow(2, Math.max(0, toNumber_(attemptIndex, 0)));
  var jitter = Math.floor(Math.random() * 120);
  return Math.min(2500, (toNumber_(baseMs, 450) * exp) + jitter);
}

function isRetryableModelSelectionError_(errMsg) {
  var t = String(errMsg || '').toLowerCase();
  return (
    t.indexOf('404') !== -1 ||
    t.indexOf('model not found') !== -1 ||
    t.indexOf('not found') !== -1 ||
    t.indexOf('unsupported model') !== -1 ||
    t.indexOf('invalid model') !== -1 ||
    t.indexOf('permission denied') !== -1
  );
}

function buildGeminiModelCandidates_(preferredModel, apiKey) {
  // Capa gratuita AI Studio: solo gemini-2.5-flash y gemini-2.5-flash-lite.
  // Logica: intentar Flash (mejor calidad) -> Flash Lite (mas cuota).
  // Cuando se pase a capa paga, agregar mas modelos aca.
  return ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
}

// ============================================================
// MULTI API KEY — Round Robin + Failover
// ============================================================

/**
 * Lee todas las API keys disponibles desde Script Properties.
 * Busca: GEMINI_API_KEY (principal), GEMINI_API_KEY_2 ... GEMINI_API_KEY_20.
 * Devuelve array de {index, key} con las que tengan valor.
 * Cachea el resultado 5 minutos para no leer properties en cada request.
 */
function getAvailableApiKeys_() {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'available_api_keys_json';
  var cached = cache.get(cacheKey);
  if (cached) {
    try {
      var parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (_e) {}
  }

  var p = PropertiesService.getScriptProperties();
  var keys = [];

  // Key principal (sin numero).
  var main = cleanText_(p.getProperty('GEMINI_API_KEY'));
  if (main) keys.push({ index: 1, key: main });

  // Keys 2 a 20.
  for (var i = 2; i <= 20; i++) {
    var val = cleanText_(p.getProperty('GEMINI_API_KEY_' + i));
    if (val) keys.push({ index: i, key: val });
  }

  if (keys.length > 0) {
    cache.put(cacheKey, JSON.stringify(keys), 300); // 5 min
  }

  return keys;
}

/**
 * Devuelve la siguiente API key en rotacion round-robin.
 * Usa un contador atomico en CacheService.
 * Si se pasan keysToSkip (indices ya agotados), las saltea.
 */
function getNextApiKeyRoundRobin_(availableKeys, keysToSkip) {
  if (!availableKeys || availableKeys.length === 0) return null;

  var skip = keysToSkip || {};
  var usable = availableKeys.filter(function(k) { return !skip[k.index]; });
  if (usable.length === 0) return null;
  if (usable.length === 1) return usable[0];

  var cache = CacheService.getScriptCache();
  var counterKey = 'rr_api_key_counter';
  var counter = toNumber_(cache.get(counterKey), 0);
  var next = counter % usable.length;
  cache.put(counterKey, String(counter + 1), 86400); // 24h

  return usable[next];
}

/**
 * Variable global temporal para trackear que key y modelo se usaron.
 * Se resetea en cada request. Se usa para debug en la respuesta.
 * TODO: QUITAR cuando ya no se necesite debug.
 */
var _lastUsedKeyIndex = 0;
var _lastUsedModel = '';

/**
 * Llama a Gemini rotando API keys en round-robin.
 * Si una key falla por cuota (429), la marca como agotada 10 min
 * y pasa a la siguiente key disponible.
 * Internamente cada key prueba todos los modelos (flash -> flash-lite).
 */
function callGeminiWithMultiKey_(prompt, preferredModel) {
  var allKeys = getAvailableApiKeys_();
  if (!allKeys || allKeys.length === 0) {
    throw new Error('No hay API keys configuradas en Script Properties');
  }

  var cache = CacheService.getScriptCache();
  var exhaustedKeys = {};

  // Verificar cuales keys estan marcadas como agotadas.
  for (var c = 0; c < allKeys.length; c++) {
    var exhaustedFlag = cache.get('api_key_exhausted_' + allKeys[c].index);
    if (exhaustedFlag) exhaustedKeys[allKeys[c].index] = true;
  }

  var errors = [];
  var triedCount = 0;
  var maxTries = allKeys.length; // intentar cada key como maximo 1 vez

  for (var attempt = 0; attempt < maxTries; attempt++) {
    var keyObj = getNextApiKeyRoundRobin_(allKeys, exhaustedKeys);
    if (!keyObj) break;

    triedCount++;
    try {
      var result = callGeminiWithFallbackModels_(prompt, keyObj.key, preferredModel);
      // Exito! Guardar cual key/model se uso para debug.
      _lastUsedKeyIndex = keyObj.index;
      // _lastUsedModel se setea dentro de callGemini_ (lo agregamos abajo)
      return result;
    } catch (err) {
      var errMsg = String(err && err.message ? err.message : err);
      errors.push('Key' + keyObj.index + ': ' + errMsg.slice(0, 150));

      // Si es error de cuota, marcar esta key como agotada por 10 minutos.
      if (isQuotaOrRateError_(errMsg)) {
        cache.put('api_key_exhausted_' + keyObj.index, 'true', 600); // 10 min
        exhaustedKeys[keyObj.index] = true;
        continue; // intentar con otra key
      }

      // Si no es cuota (ej: error de auth, modelo invalido), no seguir con otras keys
      // porque probablemente el error es del prompt, no de la key.
      break;
    }
  }

  throw new Error('Gemini: todas las API keys agotadas (' + triedCount + ' intentadas). ' + errors.join(' || '));
}

function readAvailableGeminiModels_(apiKey, forceRefresh) {
  var key = cleanText_(apiKey);
  if (!key) return [];
  var force = !!forceRefresh;

  var cache = CacheService.getScriptCache();
  var cacheKey = 'chat_models_' + Utilities.base64EncodeWebSafe(key).replace(/=+$/g, '').slice(0, 40);

  if (!force) {
    try {
      var cached = cache.get(cacheKey);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (_cacheErr) {}
  }

  // Evitar fetch adicional a /models en tiempo de request para reducir latencia.
  if (!force && !toBool_(PROMPT_OPT.ENABLE_MODEL_DISCOVERY, false)) return [];

  try {
    var versions = ['v1', 'v1beta'];
    var data = null;
    for (var vi = 0; vi < versions.length; vi++) {
      var url = 'https://generativelanguage.googleapis.com/' + versions[vi] + '/models?key=' + encodeURIComponent(key);
      var res = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
      var code = res.getResponseCode();
      if (code < 200 || code >= 300) continue;
      var txt = res.getContentText() || '';
      data = JSON.parse(txt);
      break;
    }
    if (!data) return [];

    var maxModels = Math.max(1, toNumber_(PROMPT_OPT.DISCOVERY_MAX_MODELS, 6));

    var models = (data.models || [])
      .filter(function(m) {
        var methods = m && m.supportedGenerationMethods ? m.supportedGenerationMethods : [];
        return methods.indexOf('generateContent') !== -1;
      })
      .map(function(m) {
        return String(m && m.name ? m.name : '').replace(/^models\//, '').trim();
      })
      .filter(function(name) { return !!name; })
      .slice(0, maxModels);

    if (models.length) {
      try {
        cache.put(cacheKey, JSON.stringify(models), Math.max(60, toNumber_(PROMPT_OPT.MODELS_CACHE_SECONDS, 900)));
      } catch (_cachePutErr) {}
    }

    return models;
  } catch (_err) {
    return [];
  }
}

function isQuotaOrRateError_(errMsg) {
  var t = String(errMsg || '').toLowerCase();
  return (
    t.indexOf('429') !== -1 ||
    t.indexOf('quota') !== -1 ||
    t.indexOf('resource_exhausted') !== -1 ||
    t.indexOf('rate limit') !== -1 ||
    t.indexOf('rate_limited') !== -1 ||
    t.indexOf('too many requests') !== -1 ||
    t.indexOf('service invoked too many times') !== -1
  );
}

function isTransientProviderError_(errMsg) {
  var t = String(errMsg || '').toLowerCase();
  return (
    t.indexOf('408') !== -1 ||
    t.indexOf('409') !== -1 ||
    t.indexOf('425') !== -1 ||
    t.indexOf('500') !== -1 ||
    t.indexOf('502') !== -1 ||
    t.indexOf('503') !== -1 ||
    t.indexOf('504') !== -1 ||
    t.indexOf('deadline exceeded') !== -1 ||
    t.indexOf('timed out') !== -1 ||
    t.indexOf('timeout') !== -1 ||
    t.indexOf('temporarily unavailable') !== -1 ||
    t.indexOf('internal error') !== -1 ||
    t.indexOf('backend error') !== -1 ||
    t.indexOf('connection reset') !== -1 ||
    t.indexOf('socket') !== -1 ||
    t.indexOf('network') !== -1
  );
}

function isRetryableNoOutputError_(errMsg) {
  var t = String(errMsg || '').toLowerCase();
  return (
    t.indexOf('respuesta vacia de gemini') !== -1 ||
    t.indexOf('gemini salida sin texto') !== -1 ||
    t.indexOf('finish_reason_unspecified') !== -1 ||
    t.indexOf('safety') !== -1
  );
}

function buildRescuePrompt_(ctx, signal) {
  return [
    'Sos asesor comercial de Smarthome (alarmas, camaras, monitoreo 24/7 en Argentina).',
    'Planes hogar: Video $32.830/mes, Basic $41.230/mes, Plus $44.030/mes, Pro $48.993/mes. Comercio: Comercial $62.930/mes. Equipamiento en comodato. 30% dto 6 meses.',
    'Kits alarma desde $49.900 instalacion. Kits con camaras desde $94.900.',
    'Responde breve en espanol, tono humano. No uses markdown.',
    'REGLA: Si preguntan cuanto cuesta o precios, SIEMPRE dar numeros concretos PRIMERO. Nunca esquivar con solo preguntas.',
    'Si preguntan precios, da los valores reales. Primero responde la duda con datos y luego una sola pregunta de avance.',
    'Maximo 100 palabras. SIEMPRE termina con oracion completa.',
    'MENSAJE CLIENTE: ' + String((ctx && ctx.userMessage) || ''),
    'INTENCION: ' + String((signal && signal.intent) || 'info'),
    'DATOS CONFIRMADOS: ' + buildKnownFactsForPrompt_(ctx),
    'CONTEXTO SESION: ' + buildSessionContextForPrompt_(ctx)
  ].join('\n');
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
  var model = sanitizeGeminiModelName_(modelName) || 'gemini-2.5-flash';
  var body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: PROMPT_OPT.MAX_OUTPUT_TOKENS
    }
  };

  var versions = ['v1', 'v1beta'];
  var data = null;
  var lastErr = '';

  for (var vi = 0; vi < versions.length; vi++) {
    var url = 'https://generativelanguage.googleapis.com/' + versions[vi] + '/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    });

    var code = res.getResponseCode();
    var txt = res.getContentText() || '';

    if (code < 200 || code >= 300) {
      lastErr = 'Gemini ' + versions[vi] + ' HTTP ' + code + ': ' + txt.slice(0, 600);
      // Si es 429 (cuota) o 401/403 (auth), NO probar otra version de API:
      // la otra version dara el mismo error y quemamos cuota/tiempo.
      if (code === 429 || code === 401 || code === 403) break;
      continue;
    }

    data = JSON.parse(txt);
    break;
  }

  if (!data) {
    throw new Error(lastErr || 'Gemini sin respuesta valida en v1/v1beta');
  }

  var firstCandidate = data && data.candidates && data.candidates[0];
  var finishReason = String((firstCandidate && firstCandidate.finishReason) || '').toUpperCase();
  var parts = firstCandidate && firstCandidate.content && firstCandidate.content.parts;
  var output = Array.isArray(parts)
    ? parts.map(function(p) { return p && p.text ? String(p.text) : ''; }).join('')
    : '';

  // Si Gemini devuelve texto util aunque el finishReason no sea STOP (ej: MAX_TOKENS),
  // priorizamos continuidad conversacional y evitamos fallback innecesario.
  if (!output) {
    if (finishReason && finishReason !== 'STOP' && finishReason !== 'FINISH_REASON_UNSPECIFIED') {
      throw new Error('Gemini salida sin texto (' + finishReason + ')');
    }
    throw new Error('Respuesta vacia de Gemini');
  }

  // TODO: QUITAR debug tracking cuando ya no se necesite.
  _lastUsedModel = model;

  return String(output).trim();
}

function sanitizeGeminiModelName_(value) {
  var t = cleanText_(value);
  if (!t) return '';
  return t.replace(/^models\//i, '').trim();
}

function summarizeProviderError_(errMsg) {
  var t = cleanText_(errMsg);
  if (!t) return '';
  return t.slice(0, 220);
}

function providerCircuitCacheKey_() {
  return 'chat_provider_circuit_until';
}

function providerFailureCountCacheKey_() {
  return 'chat_provider_fail_count';
}

function isProviderCircuitOpen_() {
  try {
    var cache = CacheService.getScriptCache();
    var raw = cleanText_(cache.get(providerCircuitCacheKey_()));
    if (!raw) return false;
    var untilTs = Number(raw);
    if (!untilTs) return false;
    return Date.now() < untilTs;
  } catch (_err) {
    return false;
  }
}

function noteProviderFailure_(providerCode, errMsg) {
  try {
    var cache = CacheService.getScriptCache();
    // Solo activar circuit breaker para errores NO de cuota.
    // Los 429 de cuota son por modelo, no globales, asi que no debemos
    // bloquear intentos con otros modelos.
    if (isQuotaOrRateError_(errMsg)) return;
    var failTtl = Math.max(60, toNumber_(PROMPT_OPT.PROVIDER_FAIL_COUNT_SECONDS, 180));
    var failCount = toNumber_(cache.get(providerFailureCountCacheKey_()), 0) + 1;
    cache.put(providerFailureCountCacheKey_(), String(failCount), failTtl);

    var failThreshold = Math.max(2, toNumber_(PROMPT_OPT.PROVIDER_CIRCUIT_FAIL_THRESHOLD, 2));
    if (failCount < failThreshold) {
      return;
    }

    var seconds = Math.max(20, toNumber_(PROMPT_OPT.PROVIDER_CIRCUIT_SECONDS, 60));
    var untilTs = Date.now() + (seconds * 1000);
    cache.put(providerCircuitCacheKey_(), String(untilTs), seconds);
    cache.put('chat_provider_last_error_code', cleanText_(providerCode || 'provider_error'), seconds);
    cache.put('chat_provider_last_error_msg', summarizeProviderError_(errMsg), seconds);
  } catch (_err) {}
}

function noteProviderSuccess_() {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove(providerCircuitCacheKey_());
    cache.remove(providerFailureCountCacheKey_());
    cache.remove('chat_provider_last_error_code');
    cache.remove('chat_provider_last_error_msg');
  } catch (_err) {}
}

function postProcessReply_(text, ctx) {
  var out = cleanText_(text);
  if (!out) return out;

  // Limpiar restos de markdown para que suene a chat humano.
  out = out
    .replace(/\*\*/g, '')
    .replace(/__+/g, '')
    .replace(/`+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  var hadPriorTurns = !!(
    ctx && (
      (ctx.chatHistory && ctx.chatHistory.length > 0) ||
      (ctx.sessionState && toNumber_(ctx.sessionState.turnCount, 0) > 0)
    )
  );

  if (hadPriorTurns) {
    out = out.replace(/^\s*[!]*\s*(hola|hola de nuevo|buenas|buen dia|buenas tardes|buenas noches)[\s!,.:;-]*/i, '');
    out = cleanText_(out);
  }

  // --- ANTI-TRUNCADO: si Gemini corto a mitad de frase, recortar al ultimo ---
  // --- punto/signo completo en vez de dejar texto colgando. ---
  out = salvageTruncatedReply_(out);

  // Normalizar espacios y duplicados de puntuacion residuales.
  out = out
    .replace(/,\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/([!?.,])\1+/g, '$1')
    .trim();

  return out;
}

/**
 * Si el texto termina con una frase incompleta (truncado por MAX_TOKENS),
 * recorta hasta la ultima oracion completa que termine en . ! o ?
 * Si no hay ninguna oracion completa, agrega un cierre generico.
 */
function salvageTruncatedReply_(text) {
  var t = cleanText_(text);
  if (!t) return t;

  // Si ya termina en signo de cierre valido, verificar que no sea truncado.
  if (/[.!?]$/.test(t) && !hasAbruptEnding_(t)) {
    return t;
  }

  // Buscar la ultima oracion completa (terminada en . ! o ?).
  var lastDot = t.lastIndexOf('.');
  var lastBang = t.lastIndexOf('!');
  var lastQuestion = t.lastIndexOf('?');
  var bestCut = Math.max(lastDot, lastBang, lastQuestion);

  // Si encontramos un corte razonable (al menos 40 chars de contenido util).
  if (bestCut >= 40) {
    var salvaged = t.slice(0, bestCut + 1).trim();
    // Verificar que lo salvado no tenga final abrupto.
    if (!hasAbruptEnding_(salvaged) && salvaged.length >= 40) {
      return salvaged;
    }
  }

  // Si la oracion entera se corto, intentar cortar en la ultima coma.
  var lastComma = t.lastIndexOf(',');
  if (lastComma >= 40) {
    return t.slice(0, lastComma).trim() + '. Escribime si queres mas detalle.';
  }

  // Ultimo recurso: agregar cierre generico.
  if (!/[.!?]$/.test(t)) {
    t += '. Si queres, puedo darte mas detalles.';
  }

  return t;
}

function buildSessionContextForPrompt_(ctx) {
  var state = (ctx && ctx.sessionState) || {};
  var history = (ctx && ctx.chatHistory) || [];
  var lastBot = cleanText_(getLastBotMessage_(ctx));

  return [
    'turnCount=' + String(toNumber_(state.turnCount, history.length > 0 ? 1 : 0)),
    'lastIntent=' + cleanText_(state.lastIntent || 'no_definido'),
    'lastBot=' + trimForPrompt_(lastBot || 'sin_dato', 140),
    'hasHistory=' + (history.length > 0 ? 'si' : 'no')
  ].join('; ');
}

function refineAbruptReplyWithIa_(reply, ctx, signal, props) {
  var draft = cleanText_(reply);
  if (!draft) return draft;
  if (!needsReplyRepair_(draft, ctx)) return draft;
  if (!props || !props.GEMINI_API_KEY) return draft;

  var repairPrompt = [
    'Reescribe la respuesta para que quede completa, clara y comercialmente util, sin inventar datos.',
    'Primero responde la duda puntual del cliente y luego deja 1 pregunta final para avanzar.',
    'Si el cliente pregunta por costo/precio, da orientacion concreta (que depende de cobertura, tipo de cliente y localidad) antes de preguntar el dato faltante.',
    'Maximo 110 palabras. Sin markdown.',
    '\nMENSAJE CLIENTE:\n' + String((ctx && ctx.userMessage) || ''),
    '\nINTENCION:\n' + String((signal && signal.intent) || 'info'),
    '\nDATOS CONFIRMADOS:\n' + buildKnownFactsForPrompt_(ctx),
    '\nRESPUESTA INCOMPLETA:\n' + draft
  ].join('\n');

  try {
    var fixed = callGeminiWithMultiKey_(repairPrompt, props.GEMINI_MODEL);
    var cleaned = postProcessReply_(fixed, ctx);
    if (cleaned && !needsReplyRepair_(cleaned, ctx)) return cleaned;
  } catch (_repairErr) {}

  return draft;
}

function needsReplyRepair_(text, ctx) {
  var t = cleanText_(text);
  if (!t) return true;

  if (hasAbruptEnding_(t)) return true;

  var lower = t.toLowerCase();
  var minChars = toNumber_(PROMPT_OPT.MIN_REPLY_CHARS, 45);
  var asksPrice = /(precio|cuanto cuesta|cuanto sale|valor|costo)/.test(String((ctx && ctx.userMessage) || '').toLowerCase());

  if (t.length < minChars && !/[?]$/.test(t)) return true;

  // Verbos de apertura comercial que no deberian cerrar una respuesta por si solos.
  if (/(ofrecemos|incluye|incluyen|especializamos|protegemos|ayudamos|contamos)\.$/.test(lower)) return true;

  // Si preguntan precio y la respuesta es muy breve, rehacer para que no quede evasiva.
  if (asksPrice && t.length < 70) return true;

  return false;
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
  if (/\s+(o|y|de|con|para|por|el|la|los|las|un|una|tu|al|del|que|como|su|te|se|me|es|en)\.$/.test(t)) return true;

  // Cierres tipicos de respuesta inconclusa detectados en produccion.
  if (/(ofrecemos|incluye|incluyen|especializamos|protegemos|recomendarte|contarte|darte|ayudarte|pasarte|brindarte)\.$/.test(t)) return true;
  if (/\.\.\.$/.test(t)) return true;

  // Frases que terminan con verbo infinitivo truncado.
  if (/\b(poder|tener|saber|hacer|ver|dar|poner|decir)\.$/.test(t)) return true;

  // Articulo o preposicion como ultima palabra antes del punto.
  if (/\s+(del|al|el|la|lo|los|las|un|una|unos|unas)\.$/.test(t)) return true;

  return false;
}

function buildFaqFallbackReply_(ctx, signal, knowledgeText, cfg) {
  return IA_UNAVAILABLE_MESSAGE;
}

function buildDeterministicFlowReply_(ctx, signal) {
  return {
    force: false,
    reply: ''
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
  return IA_UNAVAILABLE_MESSAGE;
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
  var shouldForceQuoteStep = !!(state.awaitingLocalidad && localidadNow);
  var hasContact = hasAnyContactData_(ctx);

  var contradiction = isSizeCoverageContradiction_(size, coverage);

  return {
    hasHistory: history.length > 0,
    clientType: type,
    coverage: coverage,
    localidad: localidadNow,
    hasContact: hasContact,
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
  return IA_UNAVAILABLE_MESSAGE;
}

function buildDeterministicQuoteReply_(state) {
  return IA_UNAVAILABLE_MESSAGE;
}

function coverageSegment_(coverage) {
  if (coverage <= 2) return 'small';
  if (coverage <= 5) return 'medium';
  return 'large';
}

function looksWeakOrTruncatedReply_(text) {
  var t = cleanText_(text).toLowerCase();
  if (!t) return true;
  if (t.length < 10) return true;
  if (hasAbruptEnding_(t)) return true;
  // Marcar como debil si queda cerrada en conector/comienzo de frase util pero incompleta.
  if (t.length < 90 && /(para poder|para ayudarte|necesito|y\.|de\.|con\.)$/.test(t)) return true;
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

  // Para preguntas de precios, planes o kits, incluir TODAS las lineas relevantes.
  var isPricingQuery = /precio|cotiz|valor|cuanto|cuesta|sale|plan|kit|promo|descuento|abono|instal/.test(q);
  var maxLines = isPricingQuery ? 20 : 10;

  var scored = lines.map(function(line) {
    var l = line.toLowerCase();
    var score = 0;

    // Relevancia directa a la query
    var qWords = q.split(/\s+/).filter(function(w) { return w.length > 2; });
    for (var wi = 0; wi < qWords.length; wi++) {
      if (l.indexOf(qWords[wi]) !== -1) score += 2;
    }

    // Bonus por contenido comercial clave
    if (/kit|plan|monitoreo|camara|alarma|comercio|hogar/.test(l)) score += 1;
    if (/precio|valor|\$|cuota|abono|instalacion|descuento|promo/.test(l)) score += 2;
    if (/incluye|sensor|sirena|central|app|wifi|4g/.test(l)) score += 1;

    return { line: line, score: score };
  });

  scored.sort(function(a, b) { return b.score - a.score; });

  var top = scored
    .filter(function(item) { return item.score > 0; })
    .slice(0, maxLines)
    .map(function(item) { return normalizeKnowledgeLine_(item.line); });

  if (!top.length) return '';
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
  return '';
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
  return '';
}

function avoidRepeatedBotReply_(reply, ctx) {
  var candidate = cleanText_(reply);
  var history = (ctx && ctx.chatHistory) || [];

  for (var i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== 'bot') continue;
    var lastBot = cleanText_(history[i].text);
    if (lastBot && lastBot.toLowerCase() === candidate.toLowerCase()) return candidate;
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

  if (botReplyResult.mode !== 'ia') {
    events.push({ type: 'fallback_activado', payload: { reason: botReplyResult.fallbackReason || 'ia_no_disponible_o_desactivada' } });
  }

  return events;
}

function classifyFallbackReason_(errMsg, props) {
  var text = String(errMsg || '').toLowerCase();
  if (!props || !props.GEMINI_API_KEY) return 'no_api_key';
  if (text.indexOf('respuesta ia debil o truncada') !== -1) return 'ia_weak_or_truncated';
  if (text.indexOf('429') !== -1 || text.indexOf('rate') !== -1) return 'provider_rate_limit';
  if (text.indexOf('quota') !== -1 || text.indexOf('resource_exhausted') !== -1) return 'provider_quota';
  if (text.indexOf('401') !== -1 || text.indexOf('403') !== -1) return 'provider_auth';
  if (text.indexOf('http') !== -1 || text.indexOf('gemini') !== -1) return 'provider_error';
  return 'unknown_error';
}

function registerTurnAudit_(cfg) {
  try {
    var cache = CacheService.getScriptCache();
    var key = buildAuditWindowKey_('turns');
    var current = toNumber_(cache.get(key), 0);
    cache.put(key, String(current + 1), 7200);
  } catch (_err) {}
}

function registerFallbackAudit_(ctx, signal, reason, errMsg, providerCode, usedDeterministicReply, cfg, props) {
  try {
    appendRow_(OP_SHEETS.ERRORES, [
      new Date(),
      (ctx && ctx.sessionId) || 'runtime',
      'fallback_audit',
      JSON.stringify({
        reason: reason || 'unknown',
        providerCode: providerCode || '',
        deterministicReply: !!usedDeterministicReply,
        intent: (signal && signal.intent) || 'info',
        sourcePage: (ctx && ctx.sourcePage) || 'n/a',
        error: String(errMsg || '').slice(0, 350)
      }),
      providerCode || '',
      true,
      new Date().toISOString()
    ]);
  } catch (_appendErr) {
    writeErrorSafe_((ctx && ctx.sessionId) || null, 'fallback_audit_write_error', String(_appendErr), 'audit_error', true);
  }

  if (!(cfg && cfg.strictFallbackAudit)) return;

  try {
    var cache = CacheService.getScriptCache();
    var fallbackKey = buildAuditWindowKey_('fallback');
    var turnsKey = buildAuditWindowKey_('turns');
    var fallbackCount = toNumber_(cache.get(fallbackKey), 0) + 1;
    var turnCount = Math.max(1, toNumber_(cache.get(turnsKey), 0));
    cache.put(fallbackKey, String(fallbackCount), 7200);

    var ratio = fallbackCount / turnCount;
    var minTurns = Math.max(1, toNumber_(cfg.strictFallbackMinTurns, 20));
    var ratioLimit = Math.max(0, toNumber_(cfg.strictFallbackWarnRatio, 0.10));

    if (turnCount >= minTurns && ratio >= ratioLimit) {
      var lastAlertKey = 'chat_fb_alert_' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHH');
      if (!cache.get(lastAlertKey)) {
        cache.put(lastAlertKey, '1', 3600);
        var destination = (cfg && cfg.emailDestinoAlertas) || (props && props.ALERT_EMAIL) || '';
        if (destination) {
          MailApp.sendEmail({
            to: destination,
            subject: '[Smarthome Chat IA] Alerta modo estricto: fallback alto',
            body: [
              'Modo estricto detecto tasa alta de fallback en la ventana actual.',
              'Fallbacks: ' + fallbackCount,
              'Turnos: ' + turnCount,
              'Ratio: ' + ratio.toFixed(3),
              'Umbral: ' + ratioLimit.toFixed(3),
              'Timestamp UTC: ' + new Date().toISOString()
            ].join('\n')
          });
        }
      }
    }
  } catch (_strictErr) {
    writeErrorSafe_((ctx && ctx.sessionId) || null, 'fallback_strict_monitor_error', String(_strictErr), 'audit_error', true);
  }
}

function buildAuditWindowKey_(kind) {
  var hourBucket = Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHH');
  return 'chat_audit_' + String(kind || 'generic') + '_' + hourBucket;
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
  if (t.indexOf('400') !== -1 || t.indexOf('invalid argument') !== -1 || t.indexOf('invalid model') !== -1) return 'invalid_request';
  return 'provider_error';
}

function buildDiagnosticCode_(fallbackReason, providerCode) {
  var reason = String(fallbackReason || '').toLowerCase();
  var provider = String(providerCode || '').toLowerCase();

  var reasonMap = {
    circuit_breaker_open: 'CBO',
    no_api_key: 'NAK',
    provider_rate_limit: 'RAT',
    provider_quota: 'QTA',
    provider_auth: 'AUT',
    provider_error: 'PER',
    runtime_error: 'RUN',
    unknown_error: 'UNK'
  };

  var providerMap = {
    rate_limited: '429',
    quota_exceeded: 'QTA',
    auth_error: 'AUT',
    invalid_request: 'INV',
    provider_error: 'PRV',
    runtime: 'RUN',
    docs_error: 'DOC',
    circuit_open: 'CBO'
  };

  var reasonCode = reasonMap[reason] || 'GEN';
  var providerCodeShort = providerMap[provider] || 'GEN';
  return 'SHC-' + reasonCode + '-' + providerCodeShort;
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

/**
 * DIAGNOSTICO COMPLETO - Ejecutar desde el editor de Apps Script.
 * Verifica API key, modelos disponibles, y prueba cada modelo individualmente.
 * Muestra en Logger todo lo que funciona y lo que no.
 */
function diagnosticoCompleto() {
  var resultados = [];
  var log = function(msg) { resultados.push(msg); Logger.log(msg); };

  log('=== DIAGNOSTICO COMPLETO SMARTHOME CHAT IA ===');
  log('Fecha: ' + new Date().toISOString());
  log('');

  // 1. Verificar Script Properties
  log('--- 1. SCRIPT PROPERTIES ---');
  var p = PropertiesService.getScriptProperties();
  var apiKey = cleanText_(p.getProperty('GEMINI_API_KEY'));
  var configModel = cleanText_(p.getProperty('GEMINI_MODEL')) || 'gemini-2.5-flash';
  log('GEMINI_API_KEY: ' + (apiKey ? 'PRESENTE (' + apiKey.length + ' chars, empieza con ' + apiKey.slice(0, 6) + '...)' : '*** FALTA ***'));
  log('GEMINI_MODEL: ' + configModel);
  log('DOC_INSTRUCCIONES_ID: ' + (p.getProperty('DOC_INSTRUCCIONES_ID') ? 'OK' : 'FALTA'));
  log('DOC_CONOCIMIENTO_ID: ' + (p.getProperty('DOC_CONOCIMIENTO_ID') ? 'OK' : 'FALTA'));
  log('DOC_EVENTOS_ID: ' + (p.getProperty('DOC_EVENTOS_ID') ? 'OK' : 'FALTA'));
  log('SHEET_CONFIG_ID: ' + (p.getProperty('SHEET_CONFIG_ID') ? 'OK' : 'FALTA'));
  log('SHEET_OPERACION_ID: ' + (p.getProperty('SHEET_OPERACION_ID') ? 'OK' : 'FALTA'));
  log('');

  if (!apiKey) {
    log('*** ERROR CRITICO: No hay GEMINI_API_KEY. El chat NUNCA va a funcionar sin API key.');
    log('Solucion: Ir a Configuracion del proyecto > Propiedades del script > Agregar GEMINI_API_KEY');
    return resultados.join('\n');
  }

  // 2. Descubrir modelos disponibles
  log('--- 2. DISCOVERY DE MODELOS ---');
  var modelosDisponibles = [];
  try {
    var versions = ['v1', 'v1beta'];
    for (var vi = 0; vi < versions.length; vi++) {
      var url = 'https://generativelanguage.googleapis.com/' + versions[vi] + '/models?key=' + encodeURIComponent(apiKey);
      var res = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
      var code = res.getResponseCode();

      if (code === 200) {
        var data = JSON.parse(res.getContentText());
        var models = (data.models || [])
          .filter(function(m) {
            return (m.supportedGenerationMethods || []).indexOf('generateContent') !== -1;
          })
          .map(function(m) {
            return String(m.name || '').replace(/^models\//, '');
          });
        log(versions[vi] + ' - ' + models.length + ' modelos con generateContent:');
        for (var mi = 0; mi < models.length; mi++) {
          log('  ' + models[mi]);
          modelosDisponibles.push(models[mi]);
        }
        break;
      } else {
        log(versions[vi] + ' - HTTP ' + code + ': ' + res.getContentText().slice(0, 200));
        if (code === 400 || code === 401 || code === 403) {
          log('*** La API key puede ser invalida o la API no esta habilitada en el proyecto GCP.');
        }
      }
    }
  } catch (discoveryErr) {
    log('Error en discovery: ' + String(discoveryErr));
  }
  log('');

  // 3. Probar cada modelo individualmente
  log('--- 3. PRUEBA INDIVIDUAL POR MODELO ---');
  var modelosAProbar = [configModel, 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
  var seen = {};
  var alguno_funciono = false;

  for (var ti = 0; ti < modelosAProbar.length; ti++) {
    var testModel = sanitizeGeminiModelName_(modelosAProbar[ti]);
    if (!testModel || seen[testModel]) continue;
    seen[testModel] = true;

    try {
      var startMs = Date.now();
      var testResult = callGemini_('Responde solo: OK', apiKey, testModel);
      var elapsed = Date.now() - startMs;
      log('  ' + testModel + ': OK (' + elapsed + 'ms) -> "' + String(testResult).slice(0, 80) + '"');
      alguno_funciono = true;
    } catch (testErr) {
      var errStr = String(testErr && testErr.message ? testErr.message : testErr);
      log('  ' + testModel + ': FALLO -> ' + errStr.slice(0, 200));
    }
  }
  log('');

  if (!alguno_funciono) {
    log('*** ERROR CRITICO: NINGUN modelo respondio. Posibles causas:');
    log('  1. API key invalida o expirada');
    log('  2. "Generative Language API" no habilitada en console.cloud.google.com');
    log('  3. Restricciones de facturacion/cuota en el proyecto GCP');
    log('  4. La API key tiene restricciones de IP/referrer que bloquean Apps Script');
    log('');
    log('Solucion: Ir a https://console.cloud.google.com > APIs & Services > verificar que');
    log('"Generative Language API" este habilitada y que la API key no tenga restricciones.');
  } else {
    log('Al menos un modelo funciono. El chat deberia responder con IA.');
  }
  log('');
  log('=== FIN DIAGNOSTICO ===');

  return resultados.join('\n');
}

/**
 * TEST DE FLUJO COMPLETO: simula exactamente lo que hace el chat real.
 * Primero "hola", despues "quiero una alarma para mi casa".
 * Loguea CADA paso para identificar donde falla.
 * Ejecutar desde el editor de Apps Script.
 */
function testChatFlow() {
  var resultados = [];
  var log = function(msg) { resultados.push(msg); Logger.log(msg); };

  log('=== TEST CHAT FLOW (2 mensajes) ===');
  log('Fecha: ' + new Date().toISOString());
  log('');

  var props, cfg;
  try {
    props = getScriptProps_();
    cfg = loadRuntimeConfig_(props);
    log('Props y Config: OK');
    log('API Key: ' + (props.GEMINI_API_KEY ? 'presente' : '*** FALTA ***'));
    log('Modelo configurado: ' + props.GEMINI_MODEL);
  } catch (initErr) {
    log('*** ERROR en init: ' + String(initErr));
    return resultados.join('\n');
  }

  // --- MENSAJE 1: "hola" ---
  log('');
  log('--- MENSAJE 1: "hola" ---');
  var result1;
  try {
    var start1 = Date.now();
    result1 = processChatRequest_({
      sessionId: 'test_flow_' + Utilities.getUuid().slice(0, 8),
      message: 'hola',
      sourcePage: 'test-flow',
      userAgent: 'test',
      chatHistory: []
    });
    var elapsed1 = Date.now() - start1;
    log('Resultado: mode=' + (result1.mode || 'N/A') + ', ok=' + result1.ok + ', tiempo=' + elapsed1 + 'ms');
    if (result1.reply) log('Reply: ' + String(result1.reply).slice(0, 200));
    if (result1.data) {
      log('fallbackReason: ' + (result1.data.fallbackReason || 'ninguno'));
      log('providerCode: ' + (result1.data.providerCode || 'ninguno'));
      log('providerMessage: ' + (result1.data.providerMessage || 'ninguno'));
    }
    if (result1.message && !result1.ok) {
      log('Error message: ' + String(result1.message).slice(0, 200));
      if (result1.data) log('Error detail: ' + (result1.data.providerMessage || ''));
    }
  } catch (err1) {
    log('*** EXCEPCION msg 1: ' + String(err1));
  }

  var sessionId = (result1 && result1.data && result1.data.sessionId) || 'test_flow_fallback';

  // --- MENSAJE 2: "quiero una alarma para mi casa" ---
  log('');
  log('--- MENSAJE 2: "quiero una alarma para mi casa" ---');
  log('SessionId: ' + sessionId);

  // Verificar circuit breaker antes del 2do mensaje
  log('Circuit breaker abierto: ' + isProviderCircuitOpen_());

  try {
    var historial2 = [];
    if (result1 && result1.ok && result1.reply) {
      historial2 = [
        { role: 'user', text: 'hola' },
        { role: 'bot', text: result1.reply }
      ];
    }

    var start2 = Date.now();
    var result2 = processChatRequest_({
      sessionId: sessionId,
      message: 'quiero una alarma para mi casa',
      sourcePage: 'test-flow',
      userAgent: 'test',
      chatHistory: historial2
    });
    var elapsed2 = Date.now() - start2;
    log('Resultado: mode=' + (result2.mode || 'N/A') + ', ok=' + result2.ok + ', tiempo=' + elapsed2 + 'ms');
    if (result2.reply) log('Reply: ' + String(result2.reply).slice(0, 200));
    if (result2.data) {
      log('fallbackReason: ' + (result2.data.fallbackReason || 'ninguno'));
      log('providerCode: ' + (result2.data.providerCode || 'ninguno'));
      log('providerMessage: ' + (result2.data.providerMessage || 'ninguno'));
    }
    if (result2.message && !result2.ok) {
      log('Error message: ' + String(result2.message).slice(0, 200));
      if (result2.data) log('Error detail: ' + (result2.data.providerMessage || ''));
    }
  } catch (err2) {
    log('*** EXCEPCION msg 2: ' + String(err2));
  }

  log('');
  log('=== FIN TEST CHAT FLOW ===');
  return resultados.join('\n');
}


// ============================================================
// REFERENCIA DE API KEYS — AYUDA MEMORIA
// ============================================================
//
// Cada API key corresponde a un proyecto de Google Cloud / AI Studio.
// Se leen automaticamente desde Script Properties.
// Para agregar una nueva, ir a: Configuracion del proyecto > Script Properties.
//
// Property Name              | Cuenta Google                     | Notas
// ---------------------------|-----------------------------------|------------------
// GEMINI_API_KEY             | contacto.smarthome.ar@gmail.com   | Key principal
// GEMINI_API_KEY_2           | (pendiente)                       | 
// GEMINI_API_KEY_3           | (pendiente)                       | 
// GEMINI_API_KEY_4           | (pendiente)                       | 
// GEMINI_API_KEY_5           | (pendiente)                       | 
// GEMINI_API_KEY_6           | (pendiente)                       | 
// GEMINI_API_KEY_7           | (pendiente)                       | 
// GEMINI_API_KEY_8           | (pendiente)                       | 
// GEMINI_API_KEY_9           | (pendiente)                       | 
// GEMINI_API_KEY_10          | (pendiente)                       | 
// GEMINI_API_KEY_11          | (pendiente)                       | 
// GEMINI_API_KEY_12          | (pendiente)                       | 
// GEMINI_API_KEY_13          | (pendiente)                       | 
// GEMINI_API_KEY_14          | (pendiente)                       | 
// GEMINI_API_KEY_15          | (pendiente)                       | 
// GEMINI_API_KEY_16          | (pendiente)                       | 
// GEMINI_API_KEY_17          | (pendiente)                       | 
// GEMINI_API_KEY_18          | (pendiente)                       | 
// GEMINI_API_KEY_19          | (pendiente)                       | 
// GEMINI_API_KEY_20          | (pendiente)                       | 
//
// COMO AGREGAR UNA NUEVA KEY:
// 1. Crear cuenta de Google (o usar una existente)
// 2. Ir a https://aistudio.google.com/apikey
// 3. Crear API key para un proyecto nuevo
// 4. En Apps Script > Config > Script Properties, agregar GEMINI_API_KEY_N con el valor
// 5. El sistema la detecta automaticamente en el proximo request (max 5 min cache)
// 6. Actualizar esta tabla con la cuenta correspondiente
//
// ESTRATEGIA: Round-robin (distribucion pareja) + failover ante 429.
// ============================================================
