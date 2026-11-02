import { Router } from 'express'
import { db } from '../db.js'
import { hashPin, publicUser } from '../auth.js'
import { fail, text } from '../helpers.js'

const router = Router()

function findByName(nombre) {
  return db.prepare('SELECT * FROM usuarios WHERE nombre = ? COLLATE NOCASE').get(nombre)
}

function validatePin(pin) {
  const value = String(pin ?? '')
  if (value.length < 4 || value.length > 32) {
    return 'El PIN o contraseña debe tener entre 4 y 32 caracteres.'
  }
  return null
}

router.get('/', (req, res) => {
  const users = db
    .prepare('SELECT * FROM usuarios ORDER BY rol DESC, nombre COLLATE NOCASE')
    .all()
    .map(publicUser)
  res.json({ usuarios: users })
})

router.post('/', (req, res) => {
  const nombre = text(req.body?.nombre, 80)
  const rol = req.body?.rol
  const pin = String(req.body?.pin ?? '').trim()

  if (nombre.length < 2) return fail(res, 400, 'El nombre debe tener al menos 2 caracteres.')
  if (!['supervisor', 'trabajador'].includes(rol)) return fail(res, 400, 'Rol inválido.')
  const pinError = validatePin(pin)
  if (pinError) return fail(res, 400, pinError)
  if (findByName(nombre)) return fail(res, 409, 'Ya existe un usuario con ese nombre.')

  const result = db
    .prepare('INSERT INTO usuarios (nombre, rol, pin_hash, activo) VALUES (?, ?, ?, 1)')
    .run(nombre, rol, hashPin(pin))

  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(Number(result.lastInsertRowid))
  res.status(201).json({ usuario: publicUser(user) })
})

router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id)
  if (!user) return fail(res, 404, 'Usuario no encontrado.')

  const nombre = req.body?.nombre !== undefined ? text(req.body.nombre, 80) : user.nombre
  const rol = req.body?.rol !== undefined ? req.body.rol : user.rol
  const activo = req.body?.activo !== undefined ? Boolean(req.body.activo) : Boolean(user.activo)
  const pin = req.body?.pin !== undefined ? String(req.body.pin).trim() : null

  if (nombre.length < 2) return fail(res, 400, 'El nombre debe tener al menos 2 caracteres.')
  if (!['supervisor', 'trabajador'].includes(rol)) return fail(res, 400, 'Rol inválido.')
  if (pin !== null) {
    const pinError = validatePin(pin)
    if (pinError) return fail(res, 400, pinError)
  }

  // Evita que el supervisor se bloquee a sí mismo.
  if (id === req.user.id && (!activo || rol !== 'supervisor')) {
    return fail(res, 400, 'No puedes desactivar ni cambiar el rol de tu propia cuenta.')
  }

  const duplicate = findByName(nombre)
  if (duplicate && duplicate.id !== id) {
    return fail(res, 409, 'Ya existe otro usuario con ese nombre.')
  }

  db.prepare(
    'UPDATE usuarios SET nombre = ?, rol = ?, activo = ?, pin_hash = ? WHERE id = ?'
  ).run(nombre, rol, activo ? 1 : 0, pin !== null ? hashPin(pin) : user.pin_hash, id)

  const updated = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id)
  res.json({ usuario: publicUser(updated) })
})

// Borrado suave explícito (equivale a PUT con activo=false).
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (id === req.user.id) {
    return fail(res, 400, 'No puedes desactivar tu propia cuenta.')
  }
  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id)
  if (!user) return fail(res, 404, 'Usuario no encontrado.')
  db.prepare('UPDATE usuarios SET activo = 0 WHERE id = ?').run(id)
  const updated = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id)
  res.json({ usuario: publicUser(updated) })
})

export default router
