const QRCode = require('qrcode');

/**
 * Genera el QR fiscal oficial de ARCA (ex-AFIP) según Resolución General 4291/2018
 * URL Oficial: https://www.afip.gob.ar/fe/qr/?p=BASE64_JSON
 */
function buildArcaQrPayload({
  fecha,           // YYYY-MM-DD
  cuit,            // Número de CUIT emisor (sin guiones)
  puntoVenta,      // Entero ej: 1
  tipoComprobante, // Entero ej: 1 (A), 6 (B), 11 (C)
  numeroComprobante,// Entero ej: 1045
  importe,         // Decimal ej: 1250.50
  tipoDocReceptor = 99, // 80=CUIT, 96=DNI, 99=Sin identificar
  nroDocReceptor = 0,
  cae,             // 14 dígitos
}) {
  const jsonPayload = {
    ver: 1,
    fecha: fecha || new Date().toISOString().split('T')[0],
    cuit: parseInt(cuit.toString().replace(/\D/g, ''), 10),
    ptoVta: parseInt(puntoVenta, 10),
    tipoCmp: parseInt(tipoComprobante, 10),
    nroCmp: parseInt(numeroComprobante, 10),
    importe: parseFloat(importe),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: parseInt(tipoDocReceptor, 10) || 99,
    nroDocRec: parseInt(nroDocReceptor.toString().replace(/\D/g, ''), 10) || 0,
    tipoCodAut: 'E', // E = CAE (Comprobante de Autorización Electrónico)
    codAut: parseInt(cae.toString(), 10),
  };

  const base64Data = Buffer.from(JSON.stringify(jsonPayload)).toString('base64');
  const qrUrl = `https://www.afip.gob.ar/fe/qr/?p=${base64Data}`;

  return {
    jsonPayload,
    base64Data,
    qrUrl,
  };
}

/**
 * Genera imagen DataURL PNG lista para incrustar en tickets térmicos o páginas de impresión
 */
async function generateQrDataUrl(qrUrl) {
  try {
    return await QRCode.toDataURL(qrUrl, {
      margin: 1,
      width: 160,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  } catch (err) {
    console.error('[QRCode Error]', err);
    return null;
  }
}

module.exports = {
  buildArcaQrPayload,
  generateQrDataUrl,
};
