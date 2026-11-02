import { Router } from 'express'
import { db } from '../db.js'
import { getTipo, listTipos } from '../data.js'
import { requireSupervisor } from '../auth.js'
import { fail, parseOpciones, text } from '../helpers.js'

const router = Router()
const TIPOS_DATO = ['texto', 'numero', 'seleccion', 'rango']

// Lectura para todos; cualquier cambio solo para supervisores.
router.use((req, res, next) => {
  if (req.method === 'GET' || req.user.rol === 'supervisor') return next()
  return fail(res, 403, 'Solo el supervisor puede configurar los tipos de muestra.')
})

function parseCampo(body) {
  const nombre = text(body?.nombre_campo, 80)
  const tipoDato = body?.tipo_dato
  if (!nombre) return { error: 'El nombre del campo es obligatorio.' }
  if (!TIPOS_DATO.includes(tipoDato)) return { error: 'Tipo de dato inválido.' }

  let opciones = null
  if (tipoDato === 'seleccion' || tipoDato === 'rango') {
    const opts = [...new Set(parseOpciones(body?.opciones))]
    if (!opts.length) {
      return { error: 'Agrega al menos una opción para selección o rango.' }
    }
    opciones = JSON.stringify(opts)
  }

  return {
    value: {
      nombre_campo: nombre,
      tipo_dato: tipoDato,
      opciones,
      requerido: body?.requerido ? 1 : 0,
    },
  }
}

// ---------- Tipos de muestra ----------

router.get('/', (req, res) => {
  const includeInactive = req.user.rol === 'supervisor' && req.query.incluir_inactivos === '1'
  res.json({ tipos: listTipos({ includeInactive }) })
})

router.post('/reordenar', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : []
  if (!ids.length) return fail(res, 400, 'Lista de tipos inválida.')
  const update = db.prepare('UPDATE tipos_muestra SET orden = ? WHERE id = ?')
  db.exec('BEGIN')
  try {
    ids.forEach((id, index) => update.run(index + 1, id))
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  res.json({ tipos: listTipos({ includeInactive: true }) })
})

router.post('/', (req, res) => {
  const nombre = text(req.body?.nombre, 80)
  if (!nombre) return fail(res, 400, 'El nombre del tipo es obligatorio.')
  const exists = db
    .prepare('SELECT id FROM tipos_muestra WHERE nombre = ? COLLATE NOCASE')
    .get(nombre)
  if (exists) return fail(res, 409, 'Ya existe un tipo con ese nombre.')

  const max = db.prepare('SELECT COALESCE(MAX(orden), 0) AS orden FROM tipos_muestra').get()
  const result = db
    .prepare('INSERT INTO tipos_muestra (nombre, activo, orden) VALUES (?, 1, ?)')
    .run(nombre, Number(max.orden) + 1)
  res.status(201).json({ tipo: getTipo(Number(result.lastInsertRowid)) })
})

router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  const tipo = db.prepare('SELECT * FROM tipos_muestra WHERE id = ?').get(id)
  if (!tipo) return fail(res, 404, 'Tipo de muestra no encontrado.')

  const nombre = req.body?.nombre !== undefined ? text(req.body.nombre, 80) : tipo.nombre
  const activo = req.body?.activo !== undefined ? Boolean(req.body.activo) : Boolean(tipo.activo)
  const orden = req.body?.orden !== undefined ? Number(req.body.orden) : Number(tipo.orden)
  if (!nombre) return fail(res, 400, 'El nombre del tipo es obligatorio.')

  const exists = db
    .prepare('SELECT id FROM tipos_muestra WHERE nombre = ? COLLATE NOCASE AND id != ?')
    .get(nombre, id)
  if (exists) return fail(res, 409, 'Ya existe un tipo con ese nombre.')

  db.prepare('UPDATE tipos_muestra SET nombre = ?, activo = ?, orden = ? WHERE id = ?').run(
    nombre,
    activo ? 1 : 0,
    orden,
    id
  )
  res.json({ tipo: getTipo(id) })
})

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  const tipo = db.prepare('SELECT * FROM tipos_muestra WHERE id = ?').get(id)
  if (!tipo) return fail(res, 404, 'Tipo de muestra no encontrado.')

  const used = db.prepare('SELECT COUNT(*) AS n FROM muestras WHERE tipo_muestra_id = ?').get(id)
  if (Number(used.n) > 0) {
    return fail(
      res,
      409,
      'No se puede eliminar: existen muestras de este tipo. Desactívalo para ocultarlo.'
    )
  }
  db.prepare('DELETE FROM tipos_muestra WHERE id = ?').run(id)
  res.json({ ok: true })
})

// ---------- Campos de un tipo ----------

router.post('/:id/campos', (req, res) => {
  const tipoId = Number(req.params.id)
  const tipo = db.prepare('SELECT id FROM tipos_muestra WHERE id = ?').get(tipoId)
  if (!tipo) return fail(res, 404, 'Tipo de muestra no encontrado.')

  const parsed = parseCampo(req.body)
  if (parsed.error) return fail(res, 400, parsed.error)

  const max = db
    .prepare('SELECT COALESCE(MAX(orden), 0) AS orden FROM campos_tipo WHERE tipo_muestra_id = ?')
    .get(tipoId)
  const result = db
    .prepare(
      `INSERT INTO campos_tipo
        (tipo_muestra_id, nombre_campo, tipo_dato, opciones, requerido, orden)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      tipoId,
      parsed.value.nombre_campo,
      parsed.value.tipo_dato,
      parsed.value.opciones,
      parsed.value.requerido,
      Number(max.orden) + 1
    )

  const campo = db.prepare('SELECT * FROM campos_tipo WHERE id = ?').get(Number(result.lastInsertRowid))
  res.status(201).json({ campo })
})

router.put('/campos/:campoId', (req, res) => {
  const campoId = Number(req.params.campoId)
  const campo = db.prepare('SELECT * FROM campos_tipo WHERE id = ?').get(campoId)
  if (!campo) return fail(res, 404, 'Campo no encontrado.')

  const parsed = parseCampo(req.body)
  if (parsed.error) return fail(res, 400, parsed.error)

  db.prepare(
    `UPDATE campos_tipo
        SET nombre_campo = ?, tipo_dato = ?, opciones = ?, requerido = ?
      WHERE id = ?`
  ).run(
    parsed.value.nombre_campo,
    parsed.value.tipo_dato,
    parsed.value.opciones,
    parsed.value.requerido,
    campoId
  )
  res.json({ campo: db.prepare('SELECT * FROM campos_tipo WHERE id = ?').get(campoId) })
})

router.delete('/campos/:campoId', (req, res) => {
  const campoId = Number(req.params.campoId)
  const campo = db.prepare('SELECT id FROM campos_tipo WHERE id = ?').get(campoId)
  if (!campo) return fail(res, 404, 'Campo no encontrado.')
  db.prepare('DELETE FROM campos_tipo WHERE id = ?').run(campoId)
  res.json({ ok: true })
})

router.post('/:id/campos/reordenar', (req, res) => {
  const tipoId = Number(req.params.id)
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : []
  if (!ids.length) return fail(res, 400, 'Lista de campos inválida.')

  const valid = db
    .prepare('SELECT id FROM campos_tipo WHERE tipo_muestra_id = ?')
    .all(tipoId)
    .map((row) => Number(row.id))
  if (!ids.every((id) => valid.includes(id))) {
    return fail(res, 400, 'Los campos no pertenecen a este tipo.')
  }

  const update = db.prepare('UPDATE campos_tipo SET orden = ? WHERE id = ?')
  db.exec('BEGIN')
  try {
    ids.forEach((id, index) => update.run(index + 1, id))
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  res.json({ tipo: getTipo(tipoId) })
})

export default router
