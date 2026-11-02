import { db } from './db.js'

function normalizeCampo(row) {
  let opciones = null
  if (row.opciones) {
    try {
      const parsed = JSON.parse(row.opciones)
      opciones = Array.isArray(parsed) ? parsed : null
    } catch {
      opciones = null
    }
  }
  return {
    id: Number(row.id),
    tipo_muestra_id: Number(row.tipo_muestra_id),
    nombre_campo: row.nombre_campo,
    tipo_dato: row.tipo_dato,
    opciones,
    requerido: Boolean(row.requerido),
    orden: Number(row.orden),
  }
}

function normalizeTipo(row, campos) {
  return {
    id: Number(row.id),
    nombre: row.nombre,
    activo: Boolean(row.activo),
    orden: Number(row.orden),
    campos,
  }
}

export function listTipos({ includeInactive = false, tipoId = null } = {}) {
  const conditions = []
  const params = []
  if (!includeInactive) conditions.push('activo = 1')
  if (tipoId !== null) {
    conditions.push('id = ?')
    params.push(tipoId)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const tipos = db
    .prepare(`SELECT * FROM tipos_muestra ${where} ORDER BY orden, id`)
    .all(...params)
  const campos = db.prepare('SELECT * FROM campos_tipo ORDER BY orden, id').all()
  return tipos.map((tipo) =>
    normalizeTipo(
      tipo,
      campos.filter((campo) => campo.tipo_muestra_id === tipo.id).map(normalizeCampo)
    )
  )
}

export function getTipo(tipoId) {
  const tipo = db.prepare('SELECT * FROM tipos_muestra WHERE id = ?').get(tipoId)
  if (!tipo) return null
  const campos = db
    .prepare('SELECT * FROM campos_tipo WHERE tipo_muestra_id = ? ORDER BY orden, id')
    .all(tipoId)
    .map(normalizeCampo)
  return normalizeTipo(tipo, campos)
}

/**
 * Agrega a cada fila de muestra el tipo, sus campos y los valores dinámicos.
 */
export function hydrateMuestras(rows) {
  if (!rows.length) return []

  const tipos = listTipos({ includeInactive: true })
  const tiposMap = new Map(tipos.map((tipo) => [tipo.id, tipo]))

  const ids = rows.map((row) => Number(row.id))
  const placeholders = ids.map(() => '?').join(',')
  const valores = db
    .prepare(`SELECT * FROM valores_muestra WHERE muestra_id IN (${placeholders})`)
    .all(...ids)

  const valoresPorMuestra = new Map()
  for (const valor of valores) {
    const muestraId = Number(valor.muestra_id)
    if (!valoresPorMuestra.has(muestraId)) valoresPorMuestra.set(muestraId, {})
    valoresPorMuestra.get(muestraId)[valor.campo_tipo_id] = valor.valor
  }

  return rows.map((row) => {
    const tipo = tiposMap.get(Number(row.tipo_muestra_id)) || null
    return {
      id: Number(row.id),
      numero_muestra: row.numero_muestra,
      tipo_muestra_id: Number(row.tipo_muestra_id),
      asignado_a: Number(row.asignado_a),
      fecha_asignacion: row.fecha_asignacion,
      asignado_por: Number(row.asignado_por),
      estado: row.estado,
      fecha_marcado: row.fecha_marcado,
      hora_marcado: row.hora_marcado,
      enviado: Boolean(row.enviado),
      fecha_envio: row.fecha_envio,
      creado_en: row.creado_en,
      tipo_nombre: tipo?.nombre ?? null,
      trabajador_nombre: row.trabajador_nombre ?? null,
      asignado_por_nombre: row.asignado_por_nombre ?? null,
      campos: tipo?.campos ?? [],
      valores: valoresPorMuestra.get(Number(row.id)) ?? {},
    }
  })
}

export function getMuestra(muestraId) {
  const row = db
    .prepare(
      `SELECT m.*, u.nombre AS trabajador_nombre, s.nombre AS asignado_por_nombre
         FROM muestras m
         JOIN usuarios u ON u.id = m.asignado_a
         JOIN usuarios s ON s.id = m.asignado_por
        WHERE m.id = ?`
    )
    .get(muestraId)
  if (!row) return null
  return hydrateMuestras([row])[0]
}
