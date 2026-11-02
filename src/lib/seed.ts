import { collection, doc, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import type { Campo, TipoMuestra, UsuarioRegistro } from '../types'
import { hashPin } from './pin'

const SEED_TIME = '2026-01-01T00:00:00.000Z'

const USUARIOS_SEED = [
  { id: 'usr-supervisor', nombre: 'Supervisor', rol: 'supervisor', pin: '1234' },
  { id: 'usr-juan', nombre: 'Juan Pérez', rol: 'trabajador', pin: '1111' },
  { id: 'usr-maria', nombre: 'María López', rol: 'trabajador', pin: '2222' },
  { id: 'usr-carlos', nombre: 'Carlos Ruiz', rol: 'trabajador', pin: '3333' },
] as const

type TipoSeed = {
  id: string
  nombre: string
  activo: boolean
  orden: number
  campos: Array<Omit<Campo, 'tipo_muestra_id'>>
}

const CAMPOS_CAFOS = ['Norte', 'Sur', 'Este', 'Oeste']

const TIPOS_SEED: TipoSeed[] = [
  {
    id: 'tipo-nematodos',
    nombre: 'Nematodos',
    activo: true,
    orden: 1,
    campos: [
      {
        id: 'campo-nematodos-medida',
        nombre_campo: 'Medida',
        tipo_dato: 'seleccion',
        opciones: ['8 pies', '12 pies'],
        requerido: true,
        orden: 1,
        actualizado_en: SEED_TIME,
      },
      {
        id: 'campo-nematodos-observaciones',
        nombre_campo: 'Observaciones',
        tipo_dato: 'texto',
        opciones: null,
        requerido: false,
        orden: 2,
        actualizado_en: SEED_TIME,
      },
    ],
  },
  {
    id: 'tipo-grid',
    nombre: 'Grid sample',
    activo: true,
    orden: 2,
    campos: [
      {
        id: 'campo-grid-profundidad',
        nombre_campo: 'Profundidad',
        tipo_dato: 'rango',
        opciones: ['0-6 pulgadas', '6-12 pulgadas', '0-12 pulgadas'],
        requerido: true,
        orden: 1,
        actualizado_en: SEED_TIME,
      },
      {
        id: 'campo-grid-cuadrante',
        nombre_campo: 'Cuadrante',
        tipo_dato: 'texto',
        opciones: null,
        requerido: false,
        orden: 2,
        actualizado_en: SEED_TIME,
      },
    ],
  },
  {
    id: 'tipo-cafos',
    nombre: 'Cafos',
    activo: true,
    orden: 3,
    campos: CAMPOS_CAFOS.map((punto, index) => ({
      id: `campo-cafos-${punto.toLowerCase()}`,
      nombre_campo: `Profundidad ${punto}`,
      tipo_dato: 'rango' as const,
      opciones: ['1-3 pies', '1-5 pies', '3-5 pies'],
      requerido: true,
      orden: index + 1,
      actualizado_en: SEED_TIME,
    })),
  },
]

let seedPromise: Promise<void> | null = null

/**
 * Si la colección `usuarios` está vacía, crea el supervisor y los tres
 * trabajadores de prueba junto con los tipos de muestra iniciales.
 * Es idempotente: se puede llamar en cada inicio de sesión.
 */
export function sembrarSiEsNecesario(): Promise<void> {
  if (!seedPromise) {
    seedPromise = ejecutarSeed().catch((error) => {
      seedPromise = null
      throw error
    })
  }
  return seedPromise
}

async function ejecutarSeed(): Promise<void> {
  const usuariosSnap = await getDocs(collection(db, 'usuarios'))
  if (!usuariosSnap.empty) return

  const batch = writeBatch(db)
  const hashes = await Promise.all(USUARIOS_SEED.map((usuario) => hashPin(usuario.pin)))

  USUARIOS_SEED.forEach((usuario, index) => {
    const row: UsuarioRegistro = {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      activo: true,
      pin_hash: hashes[index],
      actualizado_en: SEED_TIME,
    }
    batch.set(doc(db, 'usuarios', row.id), row)
  })

  for (const tipo of TIPOS_SEED) {
    const row: TipoMuestra = {
      ...tipo,
      actualizado_en: SEED_TIME,
      campos: tipo.campos.map((campo) => ({
        ...campo,
        tipo_muestra_id: tipo.id,
      })),
    }
    batch.set(doc(db, 'tipos', row.id), row)
  }

  await batch.commit()
}

export const CREDENCIALES_SEED = USUARIOS_SEED.map(({ nombre, rol, pin }) => ({
  nombre,
  rol,
  pin,
}))
