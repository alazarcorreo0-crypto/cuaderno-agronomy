import fs from 'node:fs'
import { DB_PATH } from './config.js'

const reset = process.argv.includes('--reset')

if (reset) {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${DB_PATH}${suffix}`
    if (fs.existsSync(file)) fs.rmSync(file)
    console.log(`Eliminado: ${file}`)
  }
}

const { migrate, db, isEmpty } = await import('./db.js')
const { seedDatabase } = await import('./seed.js')

migrate()

if (isEmpty()) {
  seedDatabase()
  console.log('Base de datos creada y datos de ejemplo insertados.')
} else {
  console.log('La base de datos ya tenía datos. No se volvió a sembrar.')
}

const counts = {
  usuarios: db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n,
  tipos: db.prepare('SELECT COUNT(*) AS n FROM tipos_muestra').get().n,
  campos: db.prepare('SELECT COUNT(*) AS n FROM campos_tipo').get().n,
  muestras: db.prepare('SELECT COUNT(*) AS n FROM muestras').get().n,
}

console.log(`Base de datos: ${DB_PATH}`)
console.table(counts)
db.close()
