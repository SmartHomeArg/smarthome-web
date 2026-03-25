const CONTACT_SHEET_NAME = 'Contact';
const CONTACT_DEFAULT_NOTIFICATION_EMAILS = 'institucional.smarthome@gmail.com';
const CONTACT_COMPANY_NAME = 'SmartHome';

/**
 * Web App endpoint para formulario de contacto.
 * Este archivo está pensado para un proyecto de Apps Script separado
 * del formulario de leads del hero.
 */
function doPostContactoBackup(e) {
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    const ss = getContactSpreadsheet_();
    const sheet = ss.getSheetByName(CONTACT_SHEET_NAME);

    if (!sheet) {
      return contactJsonResponse_({
        ok: false,
        message: 'No se encontró la hoja Contact'
      });
    }

    const data = getContactRequestData_(e);

    const motivoConsulta = contactCleanText_(data.motivoConsulta);
    const nombreApellido = contactCleanText_(data.nombreApellido);
    const telefono = contactOnlyDigits_(data.telefono);
    const mail = contactCleanText_(data.mail).toLowerCase();
    const direccion = contactCleanText_(data.direccion);
    const provincia = contactCleanText_(data.provincia);
    const ciudad = contactCleanText_(data.ciudad);
    const comentarios = contactCleanText_(data.comentarios);
    const pagina = contactCleanText_(data.pagina);
    const url = contactCleanText_(data.url);
    const userAgent = contactCleanText_(data.userAgent);
    const honeypot = contactCleanText_(data.website);
    const tiempoSegundos = Number(data.tiempoSegundos || 0);
    const archivos = Array.isArray(data.archivos) ? data.archivos : [];

    const errores = [];

    if (!motivoConsulta) {
      errores.push('Motivo de consulta obligatorio');
    }

    if (!nombreApellido || nombreApellido.length < 3 || contactHasSuspiciousPatterns_(nombreApellido)) {
      errores.push('Nombre y apellido inválido');
    }

    if (!telefono || telefono.length !== 10) {
      errores.push('Teléfono inválido');
    }

    if (!contactIsValidEmail_(mail) || contactHasSuspiciousPatterns_(mail)) {
      errores.push('Mail inválido');
    }

    if (!direccion || direccion.length < 6 || contactHasSuspiciousPatterns_(direccion)) {
      errores.push('Dirección inválida');
    }

    if (!provincia) {
      errores.push('Provincia obligatoria');
    }

    if (!ciudad) {
      errores.push('Ciudad obligatoria');
    }

    if (!comentarios || comentarios.length < 10 || comentarios.length > 1200 || contactHasSuspiciousPatterns_(comentarios)) {
      errores.push('Comentarios inválidos o sospechosos');
    }

    const fileValidation = validateContactFiles_(archivos);
    if (fileValidation.length) {
      errores.push.apply(errores, fileValidation);
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
      return contactJsonResponse_({ ok: false, message: 'Envío rechazado' });
    }

    if (tiempoSegundos > 0 && tiempoSegundos < 4) {
      sheet.appendRow(metadataRow.concat(['BOT', 'Envío demasiado rápido', '', '', '']));
      return contactJsonResponse_({ ok: false, message: 'Envío rechazado' });
    }

    if (errores.length > 0) {
      sheet.appendRow(metadataRow.concat(['ERROR_VALIDACION', errores.join(' | '), '', '', '']));
      return contactJsonResponse_({
        ok: false,
        message: 'Hay campos inválidos',
        errors: errores
      });
    }

    const uploaded = uploadContactFiles_(archivos, nombreApellido, motivoConsulta);

    sheet.appendRow(metadataRow.concat([
      'OK',
      '',
      uploaded.links,
      uploaded.names,
      uploaded.sizes
    ]));

    try {
      sendContactOwnerNotificationEmail_({
        motivoConsulta: motivoConsulta,
        nombreApellido: nombreApellido,
        telefono: telefono,
        mail: mail,
        direccion: direccion,
        provincia: provincia,
        ciudad: ciudad,
        comentarios: comentarios,
        pagina: pagina,
        url: url,
        tiempoSegundos: tiempoSegundos,
        archivosLinks: uploaded.links
      });
    } catch (err) {
      const note = 'Error notificación interna: ' + String(err);
      sheet.getRange(sheet.getLastRow(), 16).setValue(note);
    }

    return contactJsonResponse_({
      ok: true,
      message: 'Consulta enviada correctamente',
      archivos: uploaded.urls
    });

  } catch (error) {
    return contactJsonResponse_({
      ok: false,
      message: 'Error interno',
      detail: String(error)
    });
  }
}

function getContactSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = contactCleanText_(props.getProperty('CONTACT_SPREADSHEET_ID'));

  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  return SpreadsheetApp.getActiveSpreadsheet();
}

function getContactRequestData_(e) {
  if (!e) return {};

  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      return {};
    }
  }

  return e.parameter || {};
}

function contactJsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function contactCleanText_(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function contactOnlyDigits_(value) {
  return String(value || '').replace(/\D/g, '');
}

function contactIsValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function contactHasSuspiciousPatterns_(value) {
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
  const MAX_FILES = 3;
  const MAX_FILE_SIZE = 4 * 1024 * 1024;
  const MAX_TOTAL_SIZE = 8 * 1024 * 1024;

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

  if (files.length > MAX_FILES) {
    errors.push('Cantidad de archivos superior al máximo permitido');
    return errors;
  }

  let totalSize = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i] || {};
    const fileName = contactCleanText_(file.name);
    const mimeType = contactCleanText_(file.mimeType);
    const size = Number(file.size || 0);
    const base64 = contactCleanText_(file.contentBase64);

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

    if (size <= 0 || size > MAX_FILE_SIZE) {
      errors.push('Tamaño de archivo inválido: ' + fileName);
      continue;
    }

    totalSize += size;
  }

  if (totalSize > MAX_TOTAL_SIZE) {
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
    const mimeType = contactCleanText_(f.mimeType) || 'application/octet-stream';
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
  const folderId = contactCleanText_(props.getProperty('CONTACT_UPLOAD_FOLDER_ID'));

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

function getContactNotificationEmails_() {
  const props = PropertiesService.getScriptProperties();
  const configured = contactCleanText_(props.getProperty('CONTACT_NOTIFICATION_EMAILS'));
  return configured || CONTACT_DEFAULT_NOTIFICATION_EMAILS;
}

function sendContactOwnerNotificationEmail_(lead) {
  const to = getContactNotificationEmails_();

  const subject = 'Nueva consulta de contacto | SmartHome';

  const htmlBody =
    '<div style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.6;">' +
    '<h2 style="margin: 0 0 16px; color: #0d6efd;">Nueva consulta recibida</h2>' +
    '<p><strong>Motivo:</strong> ' + contactEscapeHtml_(lead.motivoConsulta || '-') + '</p>' +
    '<p><strong>Nombre:</strong> ' + contactEscapeHtml_(lead.nombreApellido || '-') + '</p>' +
    '<p><strong>Teléfono:</strong> ' + contactEscapeHtml_(lead.telefono || '-') + '</p>' +
    '<p><strong>Mail:</strong> ' + contactEscapeHtml_(lead.mail || '-') + '</p>' +
    '<p><strong>Dirección:</strong> ' + contactEscapeHtml_(lead.direccion || '-') + '</p>' +
    '<p><strong>Provincia:</strong> ' + contactEscapeHtml_(lead.provincia || '-') + '</p>' +
    '<p><strong>Ciudad:</strong> ' + contactEscapeHtml_(lead.ciudad || '-') + '</p>' +
    '<p><strong>Comentarios:</strong> ' + contactEscapeHtml_(lead.comentarios || '-') + '</p>' +
    '<p><strong>Página:</strong> ' + contactEscapeHtml_(lead.pagina || '-') + '</p>' +
    '<p><strong>URL:</strong> ' + contactEscapeHtml_(lead.url || '-') + '</p>' +
    '<p><strong>Tiempo de envío:</strong> ' + contactEscapeHtml_(String(lead.tiempoSegundos || 0)) + ' segundos</p>' +
    '<p><strong>Adjuntos:</strong> ' + contactEscapeHtml_(lead.archivosLinks || 'Sin adjuntos') + '</p>' +
    '</div>';

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
    name: CONTACT_COMPANY_NAME
  });
}

function contactEscapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function testContactoMailPermissions() {
  MailApp.sendEmail({
    to: CONTACT_DEFAULT_NOTIFICATION_EMAILS,
    subject: 'Prueba de permisos MailApp - Contacto',
    body: 'MailApp para formulario de contacto quedó autorizado correctamente.'
  });
}
