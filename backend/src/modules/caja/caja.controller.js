const db = require('../../config/db');

async function getTurnoActivo(req, res) {
  try {
    const tenantId = req.tenant.id;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT t.*, u.nombre as cajero_nombre, c.nombre as caja_nombre
       FROM turnos_caja t
       JOIN usuarios u ON t.usuario_id = u.id
       JOIN cajas c ON t.caja_id = c.id
       WHERE t.tenant_id = $1 AND t.estado = 'abierto'
       ORDER BY t.fecha_apertura DESC LIMIT 1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return res.json({ turnoActivo: null, abierto: false });
    }

    res.json({ turnoActivo: result.rows[0], abierto: true });
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

async function abrirTurno(req, res) {
  try {
    const tenantId = req.tenant.id;
    const userId = req.user.id;
    const { monto_inicial = 0, observaciones, caja_id } = req.body;

    // Verificar si ya existe un turno abierto en esa caja
    const existing = await db.query(
      `SELECT id FROM turnos_caja WHERE tenant_id = $1 AND estado = 'abierto' LIMIT 1`,
      [tenantId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: 'ALREADY_OPEN',
        message: 'Ya existe un turno de caja abierto en este comercio.',
      });
    }

    // Obtener caja predeterminada si no vino
    let targetCajaId = caja_id;
    if (!targetCajaId) {
      const cajaRes = await db.query(`SELECT id FROM cajas WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
      if (cajaRes.rows.length === 0) {
        const newCaja = await db.query(
          `INSERT INTO cajas (tenant_id, nombre) VALUES ($1, 'Caja Principal') RETURNING id`,
          [tenantId]
        );
        targetCajaId = newCaja.rows[0].id;
      } else {
        targetCajaId = cajaRes.rows[0].id;
      }
    }

    const result = await db.query(
      `INSERT INTO turnos_caja (tenant_id, caja_id, usuario_id, monto_inicial, observaciones, estado)
       VALUES ($1, $2, $3, $4, $5, 'abierto')
       RETURNING *`,
      [tenantId, targetCajaId, userId, parseFloat(monto_inicial), observaciones || 'Apertura de turno']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

async function cerrarTurno(req, res) {
  try {
    const tenantId = req.tenant.id;
    const { turno_id, monto_cierre_efectivo, observaciones } = req.body;

    const turnoRes = await db.query(
      `SELECT * FROM turnos_caja WHERE id = $1 AND tenant_id = $2 AND estado = 'abierto'`,
      [turno_id, tenantId]
    );

    if (turnoRes.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Turno de caja abierto no encontrado.' });
    }

    const turno = turnoRes.rows[0];
    const inicial = parseFloat(turno.monto_inicial || 0);
    const ventasEf = parseFloat(turno.total_ventas_efectivo || 0);
    const ingresos = parseFloat(turno.total_ingresos || 0);
    const retiros = parseFloat(turno.total_retiros || 0);

    const esperado = inicial + ventasEf + ingresos - retiros;
    const real = parseFloat(monto_cierre_efectivo || 0);
    const diferencia = real - esperado; // > 0 sobrante, < 0 faltante

    const updateRes = await db.query(
      `UPDATE turnos_caja SET
        monto_cierre_efectivo = $1,
        monto_esperado_efectivo = $2,
        diferencia = $3,
        observaciones = COALESCE($4, observaciones),
        fecha_cierre = CURRENT_TIMESTAMP,
        estado = 'cerrado'
       WHERE id = $5 AND tenant_id = $6
       RETURNING *`,
      [real, esperado, diferencia, observaciones, turno_id, tenantId]
    );

    res.json({
      turno: updateRes.rows[0],
      arqueo: {
        monto_inicial: inicial,
        ventas_efectivo: ventasEf,
        ingresos,
        retiros,
        monto_esperado: esperado,
        monto_real: real,
        diferencia,
        diagnostico: diferencia === 0 ? 'Caja Cuadrada Exacta' : diferencia > 0 ? `Sobrante: $${diferencia.toFixed(2)}` : `Faltante: $${Math.abs(diferencia).toFixed(2)}`,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

async function registrarMovimiento(req, res) {
  try {
    const tenantId = req.tenant.id;
    const { tipo, monto, motivo } = req.body; // tipo: 'INGRESO' o 'RETIRO'

    if (!tipo || !monto || parseFloat(monto) <= 0) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Tipo y monto válido requeridos.' });
    }

    const turnoRes = await db.query(
      `SELECT id FROM turnos_caja WHERE tenant_id = $1 AND estado = 'abierto' LIMIT 1`,
      [tenantId]
    );

    if (turnoRes.rows.length === 0) {
      return res.status(400).json({ error: 'NO_OPEN_SHIFT', message: 'No hay turno abierto para registrar movimiento.' });
    }

    const turnoId = turnoRes.rows[0].id;
    const field = tipo === 'INGRESO' ? 'total_ingresos' : 'total_retiros';

    await db.query(
      `UPDATE turnos_caja SET ${field} = ${field} + $1 WHERE id = $2 AND tenant_id = $3`,
      [parseFloat(monto), turnoId, tenantId]
    );

    res.json({ message: `Movimiento de ${tipo} registrado con éxito.` });
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

module.exports = {
  getTurnoActivo,
  abrirTurno,
  cerrarTurno,
  registrarMovimiento,
};
