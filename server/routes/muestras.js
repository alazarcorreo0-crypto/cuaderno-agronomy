import { Router } from 'express'
import { db } from '../db.js'
import { getTipo, hydrateMuestras } from '../data.js'
import { requireSupervisor } from '../auth.js'
import { fail, isValidDate, localDate, text } from '../helpers.js'

const router = Router()

const SELECT_MUESTRA = `
  SELECT m.*, u.nombre AS trabajador_nombre, s.nombre AS asignado_por_nombre
    FROM muestras m
    JOIN usuarios u ON u.id = m.asignado_a
    JOIN usuarios s ON s.id = m.asignado_por
`

function normalizeNumeros(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(/[\s,;]+/)
  return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))].slice(0, 200)
}

// El supervisor asigna una o varias muestras de un mismo tipo y trabajador.
router.post('/', requireSupervisor, (req, res) => {
  const tipoId = Number(req.body?.tipo_muestra_id)
  const asignadoA = Number(req.body?.asignado_a)
  const numeros = normalizeNumeros(req.body?.numeros)
  const fecha = req.body?.fecha && isValidDate(req.body.fecha) ? req.body.fecha : localDate()

  if (!tipoId) return fail(res, 400, 'Selecciona un tipo de muestra.')
  const tipo = getTipo(tipoId)
  if (!tipo) return fail(res, 404, 'El tipo de muestra no existe.')

  const worker = db
    .prepare("SELECT * FROM usuarios WHERE id = ? AND rol = 'trabajador' AND activo = 1")
    .get(asignadoA)
  if (!worker) return fail(res, 400, 'Selecciona un trabajador activo.')

  if (!numeros.length) return fail(res, 400, 'Ingresa al menos un número de muestra.')
  for (const numero of numeros) {
    if (numero.length > 40) return fail(res, 400, 'Los números de muestra son demasiado largos.')
  }

  const placeholders = numeros.map(() => '?').join(',')
  const duplicateRows = db
    .prepare(
      `SELECT numero_muestra FROM muestras
        WHERE tipo_muestra_id = ?
          AND estado IN ('pendiente', 'hecha')
          AND numero_muestra IN (${placeholders})`
    )
    .all(tipoId, ...numeros)
  if (duplicateRows.length) {
    return fail(res, 409, 'Ya existen muestras con esos números para este tipo.', {
      duplicados: duplicateRows.map((row) => row.numero_muestra),
    })
  }

  // Valores iniciales opcionales, aplicados a todas las muestras creadas.
  const camposValidos = new Set(tipo.campos.map((campo) => Number(campo.id)))
  const valores = []
  if (req.body?.valores && typeof req.body.valores === 'object') {
    for (const [campoId, valor] of Object.entries(req.body.valores)) {
      const id = Number(campoId)
      const limpio = text(valor, 500)
      if (camposValidos.has(id) && limpio) valores.push({ campoId: id, valor: limpio })
    }
  }

  const insertMuestra = db.prepare(
    `INSERT INTO muestras
      (numero_muestra, tipo_muestra_id, asignado_a, fecha_asignacion, asignado_por, estado, enviado)
     VALUES (?, ?, ?, ?, ?, 'pendiente', 0)`
  )
  const insertValor = db.prepare(
    'INSERT INTO valores_muestra (muestra_id, campo_tipo_id, valor) VALUES (?, ?, ?)'
  )

  const createdIds = []
  db.exec('BEGIN')
  try {
    for (const numero of numeros) {
      const result = insertMuestra.run(numero, tipoId, asignadoA, fecha, req.user.id)
      const muestraId = Number(result.lastInsertRowid)
      createdIds.push(muestraId)
      for (const item of valores) insertValor.run(muestraId, item.campoId, item.valor)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  const rows = db
    .prepare(`${SELECT_MUESTRA} WHERE m.id IN (${createdIds.map(() => '?').join(',')})`)
    .all(...createdIds)
  res.status(201).json({ muestras: hydrateMuestras(rows) })
})

// Lista del trabajador: lo asignado para el día + todo lo pendiente de enviar de días anteriores.
router.get('/mias', (req, res) => {
  if (req.user.rol !== 'trabajador') {
    return fail(res, 403, 'Este listado es solo para trabajadores.')
  }
  const fecha = req.query.fecha && isValidDate(req.query.fecha) ? req.query.fecha : localDate()
  const rows = db
    .prepare(
      `${SELECT_MUESTRA}
        WHERE m.asignado_a = ?
          AND (m.fecha_asignacion = ? OR m.enviado = 0)
        ORDER BY m.fecha_asignacion, CAST(m.numero_muestra AS INTEGER),
                 m.numero_muestra COLLATE NOCASE, m.id`
    )
    .all(req.user.id, fecha)
  res.json({ fecha, muestras: hydrateMuestras(rows) })
})

// Reporte maestro (supervisor).
router.get('/', requireSupervisor, (req, res) => {
  const conditions = []
  const params = []

  if (req.query.fecha && isValidDate(req.query.fecha)) {
    conditions.push('m.fecha_asignacion = ?')
    params.push(req.query.fecha)
  }
  if (req.query.trabajador) {
    conditions.push('m.asignado_a = ?')
    params.push(Number(req.query.trabajador))
  }
  if (req.query.tipo) {
    conditions.push('m.tipo_muestra_id = ?')
    params.push(Number(req.query.tipo))
  }
  if (['pendiente', 'hecha', 'no_hecha'].includes(req.query.estado)) {
    conditions.push('m.estado = ?')
    params.push(req.query.estado)
  }
  if (req.query.numero) {
    conditions.push('m.numero_muestra LIKE ?')
    params.push(`%${String(req.query.numero).trim()}%`)
  }
  if (req.query.enviado === '1' || req.query.enviado === '0') {
    conditions.push('m.enviado = ?')
    params.push(Number(req.query.enviado))
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db
    .prepare(
      `${SELECT_MUESTRA} ${where}
        ORDER BY m.fecha_asignacion DESC, CAST(m.numero_muestra AS INTEGER),
                 m.numero_muestra COLLATE NOCASE, m.id DESC`
    )
    .all(...params)
  res.json({ muestras: hydrateMuestras(rows) })
})

export default router
