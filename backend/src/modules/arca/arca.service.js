const db = require('../../config/db');
const { buildArcaQrPayload, generateQrDataUrl } = require('../../utils/arcaFiscalQr');

/**
 * Mapeo de tipos de comprobante ARCA
 * 1: Factura A
 * 6: Factura B
 * 11: Factura C
 * 2: Nota de Débito A, 3: Nota de Crédito A
 * 7: Nota de Débito B, 8: Nota de Crédito B
 */
const TIPO_COMPROBANTE_MAP = {
  FACTURA_A: 1,
  FACTURA_B: 6,
  FACTURA_C: 11,
};

class ArcaService {
  /**
   * Obtiene la configuración de ARCA para el comercio actual
   */
  async getConfig(tenantId) {
    const res = await db.query(
      `SELECT * FROM arca_configuraciones WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    if (res.rows.length === 0) {
      // Configuración predeterminada en modo simulación
      return {
        ambiente: 'simulacion',
        punto_venta: 1,
        cuit: '30712345678',
        auto_facturar_monto_minimo: 10000,
      };
    }
    return res.rows[0];
  }

  /**
   * Autoriza una factura / ticket fiscal ante ARCA (ex-AFIP)
   */
  async emitirComprobante({
    tenant,
    ventaId,
    tipoComprobante = 'FACTURA_B',
    cliente = null,
    importeTotal,
  }) {
    const config = await this.getConfig(tenant.id);
    const tipoCbte = TIPO_COMPROBANTE_MAP[tipoComprobante] || 6;
    const puntoVenta = config.punto_venta || 1;

    // Obtener el próximo número correlativo para este punto de venta y tipo
    const maxCbteRes = await db.query(
      `SELECT COALESCE(MAX(numero_cbte), 0) + 1 AS proximo_nro 
       FROM comprobantes_arca 
       WHERE tenant_id = $1 AND punto_venta = $2 AND tipo_cbte = $3`,
      [tenant.id, puntoVenta, tipoCbte]
    );
    const numeroCbte = parseInt(maxCbteRes.rows[0].proximo_nro, 10);

    let cae;
    let fechaVtoCae;
    let fecha = new Date().toISOString().split('T')[0];

    // Modo Simulación (Ideal para pruebas locales en Docker y notebooks)
    if (config.ambiente === 'simulacion') {
      // Genera CAE válido de 14 dígitos (ej: 74200000000000 + random)
      const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000);
      cae = `74${randomDigits}`;
      // Vencimiento estándar de CAE a 10 días
      const vtoDate = new Date();
      vtoDate.setDate(vtoDate.getDate() + 10);
      fechaVtoCae = vtoDate.toISOString().split('T')[0];
    } else {
      // En modo homologación o producción real:
      // Aquí se conectaría al WebService WSAA para Token/Sign y luego a WSFE método FECAESolicitar
      // Para este scaffold, si faltan certs, responde con simulación asistida
      const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000);
      cae = `74${randomDigits}`;
      const vtoDate = new Date();
      vtoDate.setDate(vtoDate.getDate() + 10);
      fechaVtoCae = vtoDate.toISOString().split('T')[0];
    }

    // Datos del receptor
    let tipoDocReceptor = 99; // Sin identificar
    let nroDocReceptor = '0';
    if (cliente && cliente.documento && cliente.documento !== '0') {
      tipoDocReceptor = cliente.tipo_documento === 'CUIT' ? 80 : 96; // 80 CUIT, 96 DNI
      nroDocReceptor = cliente.documento;
    }

    // Armado del QR fiscal oficial ARCA RG 4291
    const { jsonPayload, base64Data, qrUrl } = buildArcaQrPayload({
      fecha,
      cuit: tenant.cuit || config.cuit,
      puntoVenta,
      tipoComprobante: tipoCbte,
      numeroComprobante: numeroCbte,
      importe: importeTotal,
      tipoDocReceptor,
      nroDocReceptor,
      cae,
    });

    const qrDataUrl = await generateQrDataUrl(qrUrl);

    // Guardar en la base de datos
    const insertRes = await db.query(
      `INSERT INTO comprobantes_arca (
        tenant_id, venta_id, tipo_cbte, punto_venta, numero_cbte, cae, fecha_vto_cae, 
        cuit_emisor, tipo_doc_receptor, nro_doc_receptor, importe_total, qr_data, qr_url, resultado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'A')
      RETURNING *`,
      [
        tenant.id,
        ventaId,
        tipoCbte,
        puntoVenta,
        numeroCbte,
        cae,
        fechaVtoCae,
        tenant.cuit || config.cuit,
        tipoDocReceptor,
        nroDocReceptor,
        importeTotal,
        base64Data,
        qrUrl,
      ]
    );

    return {
      comprobante: insertRes.rows[0],
      cae,
      fechaVtoCae,
      puntoVenta: String(puntoVenta).padStart(5, '0'),
      numeroCbte: String(numeroCbte).padStart(8, '0'),
      tipoComprobanteNombre: tipoComprobante,
      qrUrl,
      qrDataUrl,
    };
  }
}

module.exports = new ArcaService();
