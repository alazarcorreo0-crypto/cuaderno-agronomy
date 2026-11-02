import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from './config.js'
import { db } from './db.js'

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 días (trabajo offline)
const SECRET_FILE = path.join(DATA_DIR, 'auth-secret.key')

function getSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  if (!fs.existsSync(SECRET_FILE)) {
    fs.writeFileSync(SECRET_FILE, crypto.randomBytes(48).toString('hex'), { mode: 0o600 })
  }
  return fs.readFileSync(SECRET_FILE, 'utf8').trim()
}

const secret = getSecret()

export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPin(pin, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  try {
    const candidate = crypto.scryptSync(String(pin), salt, 32)
    const expected = Buffer.from(hash, 'hex')
    if (candidate.length !== expected.length) return false
    return crypto.timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

function sign(data) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url')
}

export function createToken(user) {
  const payload = {
    uid: user.id,
    rol: user.rol,
    nombre: user.nombre,
    exp: Date.now() + TOKEN_TTL_MS,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

export function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [body, signature] = token.split('.')
  const expected = sign(body)
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload.exp || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function publicUser(user) {
  return {
    id: user.id,
    nombre: user.nombre,
    rol: user.rol,
    activo: Boolean(user.activo),
  }
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const payload = token ? verifyToken(token) : null
  if (!payload) {
    return res.status(401).json({ error: 'Sesión inválida o vencida. Inicia sesión de nuevo.' })
  }
  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(payload.uid)
  if (!user || !user.activo) {
    return res.status(401).json({ error: 'Usuario inactivo o inexistente.' })
  }
  req.user = publicUser(user)
  next()
}

export function requireSupervisor(req, res, next) {
  if (req.user?.rol !== 'supervisor') {
    return res.status(403).json({ error: 'Solo el supervisor puede realizar esta acción.' })
  }
  next()
}
