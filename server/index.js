import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { DIST_DIR, PORT } from './config.js'
import { migrate } from './db.js'
import { seedIfEmpty } from './seed.js'
import { requireAuth, requireSupervisor } from './auth.js'
import authRouter from './routes/auth.js'
import usuariosRouter from './routes/usuarios.js'
import tiposRouter from './routes/tipos.js'
import muestrasRouter from './routes/muestras.js'
import enviosRouter from './routes/envios.js'
import reportesRouter from './routes/reportes.js'

migrate()
const seeded = seedIfEmpty()

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api/usuarios', requireAuth, requireSupervisor, usuariosRouter)
app.use('/api/tipos', requireAuth, tiposRouter)
app.use('/api/muestras', requireAuth, muestrasRouter)
app.use('/api/envios', requireAuth, enviosRouter)
app.use('/api/reportes', requireAuth, requireSupervisor, reportesRouter)

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }))

// Sirve la PWA compilada (npm run build). En desarrollo se usa Vite en el puerto 5173.
if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  app.use(
    express.static(DIST_DIR, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('sw.js') || filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache')
        }
      },
    })
  )
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
} else {
  app.get('/', (_req, res) => {
    res
      .status(200)
      .type('text/plain')
      .send('API del Cuaderno de Campo activa. Ejecuta "npm run dev" para la interfaz o "npm run build" para producción.')
  })
}

// Manejo de errores centralizado.
app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido.' })
  }
  console.error(error)
  return res.status(500).json({ error: 'Error interno del servidor.' })
})

app.listen(PORT, () => {
  console.log(`API Cuaderno de Campo escuchando en http://localhost:${PORT}`)
  if (seeded) {
    console.log('Base de datos inicializada con datos de ejemplo (PIN supervisor: 1234).')
  }
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    console.log('Interfaz no compilada. Usa "npm run dev" o "npm run build".')
  }
})
