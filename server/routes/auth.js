import { Router } from 'express'
import { db } from '../db.js'
import { createToken, publicUser, requireAuth, verifyPin } from '../auth.js'
import { fail, text } from '../helpers.js'

const router = Router()

router.post('/login', (req, res) => {
  const nombre = text(req.body?.nombre, 80)
  const pin = String(req.body?.pin ?? '').trim()

  if (!nombre || !pin) {
    return fail(res, 400, 'Ingresa tu nombre y tu PIN.')
  }

  const user = db
    .prepare('SELECT * FROM usuarios WHERE nombre = ? COLLATE NOCASE')
    .get(nombre)

  if (!user || !user.activo || !verifyPin(pin, user.pin_hash)) {
    return fail(res, 401, 'Usuario o PIN incorrecto.')
  }

  return res.json({ token: createToken(user), usuario: publicUser(user) })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ usuario: req.user })
})

export default router
