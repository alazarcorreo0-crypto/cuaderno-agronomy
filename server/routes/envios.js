import { Router } from 'express'
import { db } from '../db.js'
import { getMuestra } from '../data.js'
import { requireSupervisor } from '../auth.js'
import {
  fail,
  isValidDate,
  localDate,
  localTime,
  normalizeTime,
  text,
} from '../helpers.js'

const router = Router()

function parseDetalle(json) {
  try {
    return JSON.parse(json)
  } catch {
    return { items: [] }
  }
}

// El trabajador envía su lista marcada. Actualiza muestras + valores y registra el envío.
router.post('/', (req, res) => {
  if (req.user.rol !== 'trabajador') {
    return fail(res, 403, 'Solo los trabajadores envían listas.')
  }

  const fecha = req.body?.fecha && isValidDate(req.body.fecha) ? req.body.fecha : localDate()
  const hora = normalizeTime(req.body?.hora) || localTime()
  const items = Array.isArray(req.body?.items) ? req.body.items : []

  if (!items.length) return fail(res, 400, 'No hay muestras marcadas para enviar.')
  if (items.length > 500) return fail(res, 400, 'Demasiadas muestras en un solo envío.')

  const ids = items.map((item) => Number(item?.muestra_id))
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
    return fail(res, 400, 'La lista de muestras contiene IDs inválidos o repetidos.')
  }

  const detalles = []
  const operaciones = []

  for (const item of items) {
    const muestra = getMuestra(Number(item.muestra_id))
    if (!muestra || muestra.asignado_a !== req.user.id) {
      return fail(res, 403, `La muestra ${item.muestra_id} no pertenece a tu lista.`)
    }
    if (!['hecha', 'no_hecha'].includes(item.estado)) {
      return fail(res, 400, 'Cada muestra enviada debe estar marcada como hecha o no hecha.')
    }

    const fechaMarcado =
      item.fecha_marcado && isValidDate(item.fecha_marcado) ? item.fecha_marcado : localDate()
    const horaMarcado = normalizeTime(item.hora_marcado) || localTime()

    const valoresValidos = new Map(muestra.campos.map((campo) => [Number(campo.id), campo]))
    const valores = []
    if (item.valores && typeof item.valores === 'object') {
      for (const [campoId, valor] of Object.entries(item.valores)) {
        const id = Number(campoId)
        const limpio = text(valor, 500)
        if (valoresValidos.has(id) && limpio) {
          valores.push({
            campo_tipo_id: id,
            nombre_campo: valoresValidos.get(id).nombre_campo,
            tipo_dato: valoresValidos.get(id).tipo_dato,
            valor: limpio,
          })
        }
      }
    }

    if (item.estado === 'hecha') {
      const faltantes = muestra.campos
        .filter((campo) => campo.requerido)
        .filter((campo) => !valores.some((valor) => valor.campo_tipo_id === Number(campo.id)))
        .map((campo) => campo.nombre_campo)
      if (faltantes.length) {
        return fail(
          res,
          400,
          `Completa los campos obligatorios de la muestra #${muestra.numero_muestra}: ${faltantes.join(', ')}.`
        )
      }
    }

    operaciones.push({
      muestraId: muestra.id,
      estado: item.estado,
      fechaMarcado,
      horaMarcado,
      valores,
    })
    detalles.push({
      muestra_id: muestra.id,
      numero_muestra: muestra.numero_muestra,
      tipo_muestra_id: muestra.tipo_muestra_id,
      tipo_nombre: muestra.tipo_nombre,
      estado: item.estado,
      fecha_marcado: fechaMarcado,
      hora_marcado: horaMarcado,
      valores,
    })
  }

  const updateMuestra = db.prepare(
    `UPDATE muestras
        SET estado = ?, fecha_marcado = ?, hora_marcado = ?,
            enviado = 1, fecha_envio = ?
      WHERE id = ? AND asignado_a = ?`
  )
  const deleteValores = db.prepare('DELETE FROM valores_muestra WHERE muestra_id = ?')
  const insertValor = db.prepare(
    'INSERT INTO valores_muestra (muestra_id, campo_tipo_id, valor) VALUES (?, ?, ?)'
  )
  const insertEnvio = db.prepare(
    `INSERT INTO envios (trabajador_id, fecha, hora, cantidad_muestras, detalle_json)
     VALUES (?, ?, ?, ?, ?)`
  )

  const fechaEnvio = new Date().toISOString()
  const detalle = { fecha, hora, items: detalles }

  let envioId
  db.exec('BEGIN')
  try {
    for (const op of operaciones) {
      updateMuestra.run(op.estado, op.fechaMarcado, op.horaMarcado, fechaEnvio, op.muestraId, req.user.id)
      deleteValores.run(op.muestraId)
      for (const valor of op.valores) {
        insertValor.run(op.muestraId, valor.campo_tipo_id, valor.valor)
      }
    }
    const result = insertEnvio.run(
      req.user.id,
      fecha,
      hora,
      operaciones.length,
      JSON.stringify(detalle)
    )
    envioId = Number(result.lastInsertRowid)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  res.status(201).json({ envio_id: envioId, cantidad: operaciones.length, detalle })
})

// Bandeja de envíos (supervisor).
router.get('/', requireSupervisor, (req, res) => {
  const conditions = []
  const params = []
  if (req.query.fecha && isValidDate(req.query.fecha)) {
    conditions.push('e.fecha = ?')
    params.push(req.query.fecha)
  }
  if (req.query.trabajador) {
    conditions.push('e.trabajador_id = ?')
    params.push(Number(req.query.trabajador))
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db
    .prepare(
      `SELECT e.*, u.nombre AS trabajador_nombre
         FROM envios e
         JOIN usuarios u ON u.id = e.trabajador_id
         ${where}
        ORDER BY e.fecha DESC, e.hora DESC, e.id DESC`
    )
    .all(...params)

  res.json({
    envios: rows.map((row) => ({
      id: Number(row.id),
      trabajador_id: Number(row.trabajador_id),
      trabajador_nombre: row.trabajador_nombre,
      fecha: row.fecha,
      hora: row.hora,
      cantidad_muestras: Number(row.cantidad_muestras),
      creado_en: row.creado_en,
      detalle: parseDetalle(row.detalle_json),
    })),
  })
})

export default router
