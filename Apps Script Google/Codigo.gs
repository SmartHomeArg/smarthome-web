const SHEET_NAME = 'Leads';
const CONTACT_SHEET_NAME = 'Contact';
const DEFAULT_NOTIFICATION_EMAILS = 'institucional.smarthome@gmail.com';
const COMPANY_NAME = 'SmartHome';

const CONTACT_MAX_FILES = 3;
const CONTACT_MAX_FILE_SIZE = 4 * 1024 * 1024;
const CONTACT_MAX_TOTAL_SIZE = 8 * 1024 * 1024;

function doPost(e) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    // Evita esperas largas (hasta 10s) cuando el lock está ocupado.
    lockAcquired = lock.tryLock(500);

    const data = getRequestData_(e);
    const formType = detectFormType_(data);

    if (formType === 'contact') {
      return handleContactForm_(data);
    }

    return handleLeadForm_(data);

  } catch (error) {
    const errorMessage = (error && error.message) ? String(error.message) : String(error);
    const errorStack = (error && error.stack) ? String(error.stack) : '';

    return jsonResponse({
      ok: false,
      message: errorMessage || 'Error interno',
      detail: errorStack || errorMessage
    });
  } finally {
    if (lockAcquired) {
      try {
        lock.releaseLock();
      } catch (_err) {
      }
    }
  }
}

function detectFormType_(data) {
  const explicitType = cleanText_(data.formType || '').toLowerCase();
  if (explicitType === 'contact') return 'contact';
  if (explicitType === 'lead') return 'lead';

  // Compatibilidad: si llega payload con campos de contacto, lo tratamos como contacto
  if (cleanText_(data.motivoConsulta) || cleanText_(data.direccion) || cleanText_(data.ciudad)) {
    return 'contact';
  }

  return 'lead';
}

function handleLeadForm_(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    return jsonResponse({
      ok: false,
      message: 'No se encontró la hoja Leads'
    });
  }

  const nombreApellido = cleanText_(data.nombreApellido);
  const telefono = onlyDigits_(data.telefono);
  const provincia = cleanText_(data.provincia);
  const mail = cleanText_(data.mail).toLowerCase();
  const pagina = cleanText_(data.pagina);
  const url = cleanText_(data.url);
  const userAgent = cleanText_(data.userAgent);
  const honeypot = cleanText_(data.website);
  const tiempoSegundos = Number(data.tiempoSegundos || 0);

  const errores = [];

  if (!nombreApellido || nombreApellido.length < 3) {
    errores.push('Nombre y apellido incompleto');
  }

  if (!telefono || telefono.length < 6 || telefono.length > 10) {
    errores.push('Teléfono inválido');
  }

  if (!provincia) {
    errores.push('Provincia obligatoria');
  }

  if (!isValidEmail_(mail)) {
    errores.push('Mail inválido');
  }

  if (errores.length > 0) {
    sheet.appendRow([
      new Date(),
      nombreApellido,
      telefono,
      provincia,
      mail,
      pagina,
      url,
      userAgent,
      honeypot,
      tiempoSegundos,
      'ERROR_VALIDACION',
      errores.join(' | ')
    ]);

    return jsonResponse({
      ok: false,
      message: 'Hay campos inválidos',
      errors: errores
    });
  }

  if (honeypot) {
    sheet.appendRow([
      new Date(),
      nombreApellido,
      telefono,
      provincia,
      mail,
      pagina,
      url,
      userAgent,
      honeypot,
      tiempoSegundos,
      'BOT',
      'Honeypot completo'
    ]);

    return jsonResponse({
      ok: false,
      message: 'Envío rechazado'
    });
  }

  if (tiempoSegundos > 0 && tiempoSegundos < 3) {
    sheet.appendRow([
      new Date(),
      nombreApellido,
      telefono,
      provincia,
      mail,
      pagina,
      url,
      userAgent,
      honeypot,
      tiempoSegundos,
      'BOT',
      'Envío demasiado rápido'
    ]);

    return jsonResponse({
      ok: false,
      message: 'Envío rechazado'
    });
  }

  sheet.appendRow([
    new Date(),
    nombreApellido,
    telefono,
    provincia,
    mail,
    pagina,
    url,
    userAgent,
    honeypot,
    tiempoSegundos,
    'OK',
    ''
  ]);

  const lead = {
    nombreApellido,
    telefono,
    provincia,
    mail,
    pagina,
    url,
    userAgent,
    honeypot,
    tiempoSegundos
  };

  const emailNotes = [];

  try {
    sendOwnerNotificationEmail_(lead);
    emailNotes.push('Notificación interna enviada');
  } catch (err) {
    emailNotes.push('Error aviso interno: ' + String(err));
  }

  try {
    if (isValidEmail_(mail)) {
      sendClientEmail_(lead);
      emailNotes.push('Mail al cliente enviado');
    }
  } catch (err) {
    emailNotes.push('Error mail cliente: ' + String(err));
  }

  if (emailNotes.length > 0) {
    sheet.getRange(sheet.getLastRow(), 12).setValue(emailNotes.join(' | '));
  }

  return jsonResponse({
    ok: true,
    message: 'Formulario enviado correctamente'
  });
}

function handleContactForm_(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONTACT_SHEET_NAME);

  if (!sheet) {
    return jsonResponse({
      ok: false,
      message: 'No se encontró la hoja Contact'
    });
  }

  const motivoConsulta = cleanText_(data.motivoConsulta);
  const nombreApellido = cleanText_(data.nombreApellido);
  const telefono = onlyDigits_(data.telefono);
  const mail = cleanText_(data.mail).toLowerCase();
  const direccion = cleanText_(data.direccion);
  const provincia = cleanText_(data.provincia);
  const ciudad = cleanText_(data.ciudad);
  const comentarios = cleanText_(data.comentarios);
  const pagina = cleanText_(data.pagina);
  const url = cleanText_(data.url);
  const userAgent = cleanText_(data.userAgent);
  const honeypot = cleanText_(data.website);
  const tiempoSegundos = Number(data.tiempoSegundos || 0);
  const archivos = Array.isArray(data.archivos) ? data.archivos : [];

  const errores = [];

  if (!motivoConsulta) errores.push('Motivo de consulta obligatorio');
  if (!nombreApellido || nombreApellido.length < 3 || hasSuspiciousPatterns_(nombreApellido)) errores.push('Nombre y apellido inválido');
  if (!telefono || telefono.length !== 10) errores.push('Teléfono inválido');
  if (!isValidEmail_(mail) || hasSuspiciousPatterns_(mail)) errores.push('Mail inválido');
  if (!direccion || direccion.length < 6 || hasSuspiciousPatterns_(direccion)) errores.push('Dirección inválida');
  if (!provincia) errores.push('Provincia obligatoria');
  if (!ciudad) errores.push('Ciudad obligatoria');
  if (!comentarios || comentarios.length < 10 || comentarios.length > 1200 || hasSuspiciousPatterns_(comentarios)) {
    errores.push('Comentarios inválidos o sospechosos');
  }

  const fileValidationErrors = validateContactFiles_(archivos);
  if (fileValidationErrors.length) {
    errores.push.apply(errores, fileValidationErrors);
  }

  const metadataRow = [
    new Date(),
    motivoConsulta,
    nombreApellido,
    telefono,
    mail,
    direccion,
    provincia,
    ciudad,
    comentarios,
    pagina,
    url,
    userAgent,
    honeypot,
    tiempoSegundos
  ];

  if (honeypot) {
    sheet.appendRow(metadataRow.concat(['BOT', 'Honeypot completo', '', '', '']));
    return jsonResponse({ ok: false, message: 'Envío rechazado' });
  }

  if (tiempoSegundos > 0 && tiempoSegundos < 4) {
    sheet.appendRow(metadataRow.concat(['BOT', 'Envío demasiado rápido', '', '', '']));
    return jsonResponse({ ok: false, message: 'Envío rechazado' });
  }

  if (errores.length) {
    sheet.appendRow(metadataRow.concat(['ERROR_VALIDACION', errores.join(' | '), '', '', '']));
    return jsonResponse({ ok: false, message: 'Hay campos inválidos', errors: errores });
  }

  const uploaded = uploadContactFiles_(archivos, nombreApellido, motivoConsulta);

  sheet.appendRow(metadataRow.concat([
    'OK',
    '',
    uploaded.links,
    uploaded.names,
    uploaded.sizes
  ]));

  const emailNotes = [];

  try {
    sendContactOwnerNotificationEmail_({
      motivoConsulta,
      nombreApellido,
      telefono,
      mail,
      direccion,
      provincia,
      ciudad,
      comentarios,
      pagina,
      url,
      tiempoSegundos,
      archivosLinks: uploaded.links
    });
    emailNotes.push('Notificación interna enviada');
  } catch (err) {
    emailNotes.push('Error notificación interna: ' + String(err));
  }

  try {
    if (isValidEmail_(mail)) {
      sendContactClientEmail_({
        motivoConsulta,
        nombreApellido,
        telefono,
        mail,
        direccion,
        provincia,
        ciudad,
        comentarios,
        archivosLinks: uploaded.links
      });
      emailNotes.push('Mail al cliente enviado');
    }
  } catch (err) {
    emailNotes.push('Error mail cliente: ' + String(err));
  }

  if (emailNotes.length > 0) {
    sheet.getRange(sheet.getLastRow(), 16).setValue(emailNotes.join(' | '));
  }

  return jsonResponse({
    ok: true,
    message: 'Formulario enviado correctamente'
  });
}

function getRequestData_(e) {
  if (!e) return {};

  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
    }
  }

  return e.parameter || {};
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function cleanText_(value) {
  return String(value || '').trim();
}

function onlyDigits_(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hasSuspiciousPatterns_(value) {
  const text = String(value || '').toLowerCase();
  if (!text) return false;

  const patterns = [
    /https?:\/\//i,
    /www\./i,
    /bit\.ly|tinyurl|t\.co|goo\.gl/i,
    /wa\.me|whatsapp|telegram|t\.me/i,
    /casino|apuesta|forex|crypto|bitcoin|viagra|porn/i,
    /(.)\1{5,}/
  ];

  for (let i = 0; i < patterns.length; i++) {
    if (patterns[i].test(text)) return true;
  }

  return false;
}

function validateContactFiles_(files) {
  const allowedMimeTypes = {
    'application/pdf': true,
    'image/png': true,
    'image/jpeg': true,
    'image/webp': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true
  };

  const allowedExtensions = {
    pdf: true,
    png: true,
    jpg: true,
    jpeg: true,
    webp: true,
    doc: true,
    docx: true
  };

  const errors = [];

  if (files.length > CONTACT_MAX_FILES) {
    errors.push('Cantidad de archivos superior al máximo permitido');
    return errors;
  }

  let totalSize = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i] || {};
    const fileName = cleanText_(file.name);
    const mimeType = cleanText_(file.mimeType);
    const size = Number(file.size || 0);
    const base64 = cleanText_(file.contentBase64);

    if (!fileName || !base64) {
      errors.push('Archivo adjunto incompleto');
      continue;
    }

    const ext = fileName.indexOf('.') > -1 ? fileName.split('.').pop().toLowerCase() : '';
    const mimeAllowed = allowedMimeTypes[mimeType] === true;
    const extAllowed = allowedExtensions[ext] === true;

    if (!mimeAllowed && !extAllowed) {
      errors.push('Tipo de archivo no permitido: ' + fileName);
      continue;
    }

    if (size <= 0 || size > CONTACT_MAX_FILE_SIZE) {
      errors.push('Tamaño de archivo inválido: ' + fileName);
      continue;
    }

    totalSize += size;
  }

  if (totalSize > CONTACT_MAX_TOTAL_SIZE) {
    errors.push('Tamaño total de archivos excedido');
  }

  return errors;
}

function uploadContactFiles_(files, nombreApellido, motivoConsulta) {
  if (!files || !files.length) {
    return {
      links: '',
      names: '',
      sizes: '',
      urls: []
    };
  }

  const folder = getContactUploadFolder_();
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const safeName = sanitizeFileName_(nombreApellido || 'contacto');
  const safeMotivo = sanitizeFileName_(motivoConsulta || 'consulta');

  const urls = [];
  const names = [];
  const sizes = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i] || {};
    const originalName = sanitizeFileName_(f.name || 'archivo-' + (i + 1));
    const mimeType = cleanText_(f.mimeType) || 'application/octet-stream';
    const bytes = Utilities.base64Decode(String(f.contentBase64 || ''));

    const finalName = now + '-' + safeName + '-' + safeMotivo + '-' + (i + 1) + '-' + originalName;
    const blob = Utilities.newBlob(bytes, mimeType, finalName);
    const created = folder.createFile(blob);

    urls.push(created.getUrl());
    names.push(created.getName());
    sizes.push(Number(f.size || 0));
  }

  return {
    links: urls.join(' | '),
    names: names.join(' | '),
    sizes: sizes.join(' | '),
    urls: urls
  };
}

function getContactUploadFolder_() {
  const props = PropertiesService.getScriptProperties();
  const folderId = cleanText_(props.getProperty('CONTACT_UPLOAD_FOLDER_ID'));

  if (!folderId) {
    throw new Error('Falta configurar CONTACT_UPLOAD_FOLDER_ID en Script Properties');
  }

  return DriveApp.getFolderById(folderId);
}

function sanitizeFileName_(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 120);
}

function getNotificationEmails_() {
  const props = PropertiesService.getScriptProperties();
  const configured = (props.getProperty('NOTIFICATION_EMAILS') || '').trim();
  return configured || DEFAULT_NOTIFICATION_EMAILS;
}

function sendClientEmail_(lead) {
  if (!isValidEmail_(lead.mail)) return;

  const subject = 'Recibimos tu consulta | SmartHome';

  const htmlBody = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.6;">
      <h2 style="margin: 0 0 16px; color: #0d6efd;">Gracias por contactarte con ${COMPANY_NAME}</h2>
      <p>Hola <strong>${escapeHtml_(lead.nombreApellido || 'cliente')}</strong>,</p>
      <p>Recibimos correctamente tu solicitud y ya quedó registrada en nuestro sistema.</p>
      <p>En breve nos pondremos en contacto para asesorarte.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="margin: 0;"><strong>Datos enviados:</strong></p>
      <p style="margin: 8px 0 0;">Provincia: ${escapeHtml_(lead.provincia || '-')}</p>
      <p style="margin: 4px 0 0;">Teléfono: ${escapeHtml_(lead.telefono || '-')}</p>
      <p style="margin: 4px 0 0;">Mail: ${escapeHtml_(lead.mail || '-')}</p>
      <p style="margin-top: 20px;">Saludos,<br><strong>${COMPANY_NAME}</strong></p>
    </div>
  `;

  const body =
    'Recibimos correctamente tu solicitud y ya quedó registrada en nuestro sistema.\n\n' +
    'En breve nos pondremos en contacto para asesorarte.\n\n' +
    'SmartHome';

  MailApp.sendEmail({
    to: lead.mail,
    subject: subject,
    body: body,
    htmlBody: htmlBody,
    name: COMPANY_NAME
  });
}

function sendOwnerNotificationEmail_(lead) {
  const to = getNotificationEmails_();

  const subject = 'Nuevo lead recibido | SmartHome';

  const htmlBody = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.6;">
      <h2 style="margin: 0 0 16px; color: #0d6efd;">Nuevo registro recibido</h2>
      <p><strong>Nombre:</strong> ${escapeHtml_(lead.nombreApellido || '-')}</p>
      <p><strong>Teléfono:</strong> ${escapeHtml_(lead.telefono || '-')}</p>
      <p><strong>Provincia:</strong> ${escapeHtml_(lead.provincia || '-')}</p>
      <p><strong>Mail:</strong> ${escapeHtml_(lead.mail || '-')}</p>
      <p><strong>Página:</strong> ${escapeHtml_(lead.pagina || '-')}</p>
      <p><strong>URL:</strong> ${escapeHtml_(lead.url || '-')}</p>
      <p><strong>Tiempo de envío:</strong> ${escapeHtml_(String(lead.tiempoSegundos || 0))} segundos</p>
    </div>
  `;

  const body =
    'Nuevo lead recibido\n\n' +
    'Nombre: ' + (lead.nombreApellido || '-') + '\n' +
    'Teléfono: ' + (lead.telefono || '-') + '\n' +
    'Provincia: ' + (lead.provincia || '-') + '\n' +
    'Mail: ' + (lead.mail || '-') + '\n' +
    'Página: ' + (lead.pagina || '-') + '\n' +
    'URL: ' + (lead.url || '-') + '\n' +
    'Tiempo de envío: ' + String(lead.tiempoSegundos || 0) + ' segundos';

  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: body,
    htmlBody: htmlBody,
    name: COMPANY_NAME
  });
}

function sendContactOwnerNotificationEmail_(lead) {
  const to = getNotificationEmails_();

  const subject = 'Nueva consulta de contacto | SmartHome';

  const htmlBody = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.6;">
      <h2 style="margin: 0 0 16px; color: #0d6efd;">Nueva consulta recibida</h2>
      <p><strong>Motivo:</strong> ${escapeHtml_(lead.motivoConsulta || '-')}</p>
      <p><strong>Nombre:</strong> ${escapeHtml_(lead.nombreApellido || '-')}</p>
      <p><strong>Teléfono:</strong> ${escapeHtml_(lead.telefono || '-')}</p>
      <p><strong>Mail:</strong> ${escapeHtml_(lead.mail || '-')}</p>
      <p><strong>Dirección:</strong> ${escapeHtml_(lead.direccion || '-')}</p>
      <p><strong>Provincia:</strong> ${escapeHtml_(lead.provincia || '-')}</p>
      <p><strong>Ciudad:</strong> ${escapeHtml_(lead.ciudad || '-')}</p>
      <p><strong>Comentarios:</strong> ${escapeHtml_(lead.comentarios || '-')}</p>
      <p><strong>Página:</strong> ${escapeHtml_(lead.pagina || '-')}</p>
      <p><strong>URL:</strong> ${escapeHtml_(lead.url || '-')}</p>
      <p><strong>Tiempo de envío:</strong> ${escapeHtml_(String(lead.tiempoSegundos || 0))} segundos</p>
      <p><strong>Adjuntos:</strong> ${escapeHtml_(lead.archivosLinks || 'Sin adjuntos')}</p>
    </div>
  `;

  const body =
    'Nueva consulta recibida\n\n' +
    'Motivo: ' + (lead.motivoConsulta || '-') + '\n' +
    'Nombre: ' + (lead.nombreApellido || '-') + '\n' +
    'Teléfono: ' + (lead.telefono || '-') + '\n' +
    'Mail: ' + (lead.mail || '-') + '\n' +
    'Dirección: ' + (lead.direccion || '-') + '\n' +
    'Provincia: ' + (lead.provincia || '-') + '\n' +
    'Ciudad: ' + (lead.ciudad || '-') + '\n' +
    'Comentarios: ' + (lead.comentarios || '-') + '\n' +
    'Página: ' + (lead.pagina || '-') + '\n' +
    'URL: ' + (lead.url || '-') + '\n' +
    'Adjuntos: ' + (lead.archivosLinks || 'Sin adjuntos');

  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: body,
    htmlBody: htmlBody,
    name: COMPANY_NAME
  });
}

function sendContactClientEmail_(lead) {
  if (!isValidEmail_(lead.mail)) return;

  const subject = 'Recibimos tu consulta de contacto | SmartHome';

  const htmlBody = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.6;">
      <h2 style="margin: 0 0 16px; color: #0d6efd;">Gracias por contactarte con ${COMPANY_NAME}</h2>
      <p>Hola <strong>${escapeHtml_(lead.nombreApellido || 'cliente')}</strong>,</p>
      <p>Recibimos correctamente tu solicitud de contacto.</p>
      <p>En breve te vamos a responder por este medio o por teléfono.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="margin: 0;"><strong>Resumen de tu consulta:</strong></p>
      <p style="margin: 8px 0 0;">Motivo: ${escapeHtml_(lead.motivoConsulta || '-')}</p>
      <p style="margin: 4px 0 0;">Dirección: ${escapeHtml_(lead.direccion || '-')}</p>
      <p style="margin: 4px 0 0;">Provincia/Ciudad: ${escapeHtml_(lead.provincia || '-')} / ${escapeHtml_(lead.ciudad || '-')}</p>
      <p style="margin: 4px 0 0;">Teléfono: ${escapeHtml_(lead.telefono || '-')}</p>
      <p style="margin: 4px 0 0;">Mail: ${escapeHtml_(lead.mail || '-')}</p>
      <p style="margin: 4px 0 0;">Adjuntos: ${escapeHtml_(lead.archivosLinks ? 'Sí' : 'No')}</p>
      <p style="margin-top: 20px;">Saludos,<br><strong>${COMPANY_NAME}</strong></p>
    </div>
  `;

  const body =
    'Recibimos correctamente tu solicitud de contacto.\n\n' +
    'En breve te vamos a responder por este medio o por teléfono.\n\n' +
    'Resumen:\n' +
    'Motivo: ' + (lead.motivoConsulta || '-') + '\n' +
    'Dirección: ' + (lead.direccion || '-') + '\n' +
    'Provincia/Ciudad: ' + (lead.provincia || '-') + ' / ' + (lead.ciudad || '-') + '\n' +
    'Teléfono: ' + (lead.telefono || '-') + '\n\n' +
    'SmartHome';

  MailApp.sendEmail({
    to: lead.mail,
    subject: subject,
    body: body,
    htmlBody: htmlBody,
    name: COMPANY_NAME
  });
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function testMailPermissions() {
  MailApp.sendEmail({
    to: 'institucional.smarthome@gmail.com',
    subject: 'Prueba de permisos MailApp',
    body: 'MailApp ya quedó autorizado correctamente.'
  });
}

function testContactSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONTACT_SHEET_NAME);
  const folderId = cleanText_(PropertiesService.getScriptProperties().getProperty('CONTACT_UPLOAD_FOLDER_ID'));

  if (!sheet) {
    throw new Error('No existe la hoja Contact en el spreadsheet vinculado.');
  }

  if (!folderId) {
    throw new Error('Falta CONTACT_UPLOAD_FOLDER_ID en Script Properties.');
  }

  const folder = DriveApp.getFolderById(folderId);

  Logger.log('Hoja Contact OK: ' + sheet.getName());
  Logger.log('Carpeta Drive OK: ' + folder.getName() + ' (' + folder.getId() + ')');

  return {
    ok: true,
    contactSheet: sheet.getName(),
    folderName: folder.getName(),
    folderId: folder.getId()
  };
}