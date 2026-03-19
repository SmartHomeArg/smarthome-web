const SHEET_NAME = 'Leads';
const DEFAULT_NOTIFICATION_EMAILS = 'institucional.smarthome@gmail.com';
const COMPANY_NAME = 'SmartHome';

function doPost(e) {
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({
        ok: false,
        message: 'No se encontró la hoja Leads'
      });
    }

    const data = getRequestData_(e);

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

  } catch (error) {
    return jsonResponse({
      ok: false,
      message: 'Error interno',
      detail: String(error)
    });
  }
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