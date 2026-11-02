import { db, isEmpty } from './db.js'
import { hashPin } from './auth.js'

const USUARIOS = [
  { nombre: 'Supervisor', rol: 'supervisor', pin: '1234' },
  { nombre: 'Juan Pérez', rol: 'trabajador', pin: '1111' },
  { nombre: 'María López', rol: 'trabajador', pin: '2222' },
  { nombre: 'Carlos Ruiz', rol: 'trabajador', pin: '3333' },
]

const TIPOS = [
  {
    nombre: 'Nematodos',
    campos: [
      {
        nombre_campo: 'Medida',
        tipo_dato: 'seleccion',
        opciones: ['8 pies', '12 pies'],
        requerido: 1,
      },
      { nombre_campo: 'Observaciones', tipo_dato: 'texto', opciones: null, requerido: 0 },
    ],
  },
  {
    nombre: 'Grid sample',
    campos: [
      {
        nombre_campo: 'Profundidad',
        tipo_dato: 'rango',
        opciones: ['0-6 pulgadas', '6-12 pulgadas', '0-12 pulgadas'],
        requerido: 1,
      },
      { nombre_campo: 'Cuadrante', tipo_dato: 'texto', opciones: null, requerido: 0 },
    ],
  },
  {
    nombre: 'Cafos',
    campos: [
      {
        nombre_campo: 'Profundidad Norte',
        tipo_dato: 'rango',
        opciones: ['1-3 pies', '1-5 pies', '3-5 pies'],
        requerido: 1,
      },
      {
        nombre_campo: 'Profundidad Sur',
        tipo_dato: 'rango',
        opciones: ['1-3 pies', '1-5 pies', '3-5 pies'],
        requerido: 1,
      },
      {
        nombre_campo: 'Profundidad Este',
        tipo_dato: 'rango',
        opciones: ['1-3 pies', '1-5 pies', '3-5 pies'],
        requerido: 1,
      },
      {
        nombre_campo: 'Profundidad Oeste',
        tipo_dato: 'rango',
        opciones: ['1-3 pies', '1-5 pies', '3-5 pies'],
        requerido: 1,
      },
    ],
  },
]

export function seedDatabase() {
  const insertUsuario = db.prepare(
    'INSERT INTO usuarios (nombre, rol, pin_hash, activo) VALUES (?, ?, ?, 1)'
  )
  const insertTipo = db.prepare('INSERT INTO tipos_muestra (nombre, activo, orden) VALUES (?, 1, ?)')
  const insertCampo = db.prepare(
    'INSERT INTO campos_tipo (tipo_muestra_id, nombre_campo, tipo_dato, opciones, requerido, orden) VALUES (?, ?, ?, ?, ?, ?)'
  )

  db.exec('BEGIN')
  try {
    for (const user of USUARIOS) {
      insertUsuario.run(user.nombre, user.rol, hashPin(user.pin))
    }
    TIPOS.forEach((tipo, tipoIndex) => {
      const result = insertTipo.run(tipo.nombre, tipoIndex + 1)
      const tipoId = Number(result.lastInsertRowid)
      tipo.campos.forEach((campo, campoIndex) => {
        insertCampo.run(
          tipoId,
          campo.nombre_campo,
          campo.tipo_dato,
          campo.opciones ? JSON.stringify(campo.opciones) : null,
          campo.requerido ? 1 : 0,
          campoIndex + 1
        )
      })
    })
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function seedIfEmpty() {
  if (!isEmpty()) return false
  seedDatabase()
  return true
}
