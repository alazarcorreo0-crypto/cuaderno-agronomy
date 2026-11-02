import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { sembrarSiEsNecesario } from './seed'
import { hashPin, verifyPin } from './pin'
import { todayLocal, timeNow } from './dates'
import { randomId } from './utils'
import type {
  Campo,
  Envio,
  EnvioEntrante,
  EnvioItem,
  EstadoMuestra,
  ID,
  Muestra,
  MuestraBase,
  Pendiente,
  Resumen,
  Rol,
  TipoDato,
  TipoMuestra,
  Usuario,
  UsuarioRegistro,
} from '../types'

const TOKEN_KEY = 'cuaderno.sesion.v2'
const USER_KEY = 'cuaderno.usuario.v2'
const TIPOS_DATO: TipoDato[] = ['texto', 'numero', 'seleccion', 'rango']
const COL = {
  usuarios: 'usuarios',
  tipos: 'tipos',
  muestras: 'muestras',
  envios: 'envios',
  pendientes: 'pendientes',
} as const

let authToken: string | null = localStorage.getItem(TOKEN_KEY)

export class ApiError extends Error {
  status: number
  duplicados?: string[]

  constructor(message: string, status: number, extra?: { duplicados?: string[] }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.duplicados = extra?.duplicados
  }
}

export function setAuthToken(token: string | null) {
  authToken = token
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getAuthToken() {
  return authToken
}

export function saveCachedUser(user: Usuario | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(USER_KEY)
}

export function getCachedUser(): Usuario | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as Usuario) : null
  } catch {
    return null
  }
}

function nowIso() {
  return new Date().toISOString()
}

function text(value: unknown, max = 200): string {
  if (value === null || value === undefined) return ''
  return String(value).trim().slice(0, max)
}

function nameKey(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
}

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function normalizeTime(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return null
  return value.length === 5 ? `${value}:00` : value
}

function publicUser(row: UsuarioRegistro): Usuario {
  return {
    id: row.id,
    nombre: row.nombre,
    rol: row.rol,
    activo: row.activo,
  }
}

function docsConId<T extends { id: string }>(snapshot: {
  docs: Array<{ id: string; data: () => unknown }>
}): T[] {
  return snapshot.docs.map((item) => ({ ...(item.data() as object), id: item.id }) as T)
}

async function leerColeccion<T extends { id: string }>(nombre: string): Promise<T[]> {
  const snapshot = await getDocs(collection(db, nombre))
  return docsConId<T>(snapshot)
}

async function commitEnLotes(operaciones: Array<(batch: WriteBatch) => void>) {
  for (let index = 0; index < operaciones.length; index += 400) {
    const batch = writeBatch(db)
    operaciones.slice(index, index + 400).forEach((operacion) => operacion(batch))
    await batch.commit()
  }
}

function pendingId(usuarioId: ID, muestraId: ID) {
  return `${usuarioId}__${muestraId}`
}

async function requireUser(): Promise<UsuarioRegistro> {
  if (!authToken) throw new ApiError('Inicia sesión para continuar.', 401)
  const snapshot = await getDoc(doc(db, COL.usuarios, authToken))
  if (!snapshot.exists()) {
    throw new ApiError('La sesión ya no es válida. Inicia sesión de nuevo.', 401)
  }
  const user = { ...(snapshot.data() as object), id: snapshot.id } as UsuarioRegistro
  if (!user.activo) throw new ApiError('Tu cuenta está desactivada.', 403)
  return user
}

async function requireSupervisor(): Promise<UsuarioRegistro> {
  const user = await requireUser()
  if (user.rol !== 'supervisor') {
    throw new ApiError('Solo el supervisor puede realizar esta acción.', 403)
  }
  return user
}

function validatePin(pin: string): string | null {
  if (pin.length < 4 || pin.length > 32) {
    return 'El PIN o contraseña debe tener entre 4 y 32 caracteres.'
  }
  return null
}

function uniqueOptions(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return [
    ...new Set(
      values
        .map((item) => text(item, 80))
        .filter(Boolean)
    ),
  ].slice(0, 50)
}

function parseCampo(payload: {
  nombre_campo: string
  tipo_dato: string
  opciones: string[]
  requerido: boolean
}): Pick<Campo, 'nombre_campo' | 'tipo_dato' | 'opciones' | 'requerido'> {
  const nombre_campo = text(payload?.nombre_campo, 80)
  if (!nombre_campo) throw new ApiError('El nombre del campo es obligatorio.', 400)

  const tipo_dato = payload?.tipo_dato
  if (!TIPOS_DATO.includes(tipo_dato as TipoDato)) {
    throw new ApiError('Tipo de dato inválido.', 400)
  }

  let opciones: string[] | null = null
  if (tipo_dato === 'seleccion' || tipo_dato === 'rango') {
    opciones = uniqueOptions(payload?.opciones)
    if (!opciones.length) {
      throw new ApiError('Agrega al menos una opción para selección o rango.', 400)
    }
  }

  return {
    nombre_campo,
    tipo_dato: tipo_dato as TipoDato,
    opciones,
    requerido: Boolean(payload?.requerido),
  }
}

function sortCampos(campos: Campo[]): Campo[] {
  return [...campos].sort(
    (a, b) => a.orden - b.orden || a.nombre_campo.localeCompare(b.nombre_campo, 'es')
  )
}

async function hydrateMuestras(rows: MuestraBase[]): Promise<Muestra[]> {
  const [tipos, usuarios] = await Promise.all([
    leerColeccion<TipoMuestra>(COL.tipos),
    leerColeccion<UsuarioRegistro>(COL.usuarios),
  ])
  const tiposPorId = new Map(tipos.map((tipo) => [tipo.id, tipo]))
  const usuariosPorId = new Map(usuarios.map((usuario) => [usuario.id, usuario]))

  return rows.map((row) => {
    const tipo = tiposPorId.get(row.tipo_muestra_id)
    const campos = tipo ? sortCampos(tipo.campos ?? []) : []
    const idsValidos = new Set(campos.map((campo) => campo.id))
    const valores = Object.fromEntries(
      Object.entries(row.valores ?? {}).filter(([campoId]) => idsValidos.has(campoId))
    )

    return {
      ...row,
      valores,
      tipo_nombre: tipo?.nombre ?? null,
      trabajador_nombre: usuariosPorId.get(row.asignado_a)?.nombre ?? null,
      asignado_por_nombre: usuariosPorId.get(row.asignado_por)?.nombre ?? null,
      campos,
    }
  })
}

function compareNumero(a: string, b: string): number {
  const numA = Number(a)
  const numB = Number(b)
  if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) return numA - numB
  return a.localeCompare(b, 'es', { numeric: true })
}

function normalizarError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : ''
  if (code === 'unavailable') {
    return new ApiError(
      'Sin conexión. Los cambios se guardarán en el dispositivo y se sincronizarán al volver la red.',
      0
    )
  }
  if (code === 'permission-denied') {
    return new ApiError(
      'Firestore rechazó la operación. Revisa las reglas de seguridad del proyecto.',
      403
    )
  }
  if (code === 'failed-precondition') {
    return new ApiError(
      'Firestore necesita un índice o una configuración adicional para esta consulta.',
      400
    )
  }
  if (code === 'resource-exhausted') {
    return new ApiError('Se alcanzó el límite de Firestore. Intenta más tarde.', 429)
  }
  return new ApiError(
    error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
    500
  )
}

const apiLocal = {
  auth: {
    login: async (nombre: string, pin: string) => {
      await sembrarSiEsNecesario()
      const key = nameKey(nombre)
      if (!key) throw new ApiError('Escribe tu nombre.', 400)

      const usuarios = await leerColeccion<UsuarioRegistro>(COL.usuarios)
      const found = usuarios.find((usuario) => nameKey(usuario.nombre) === key)
      if (!found || !(await verifyPin(String(pin ?? '').trim(), found.pin_hash))) {
        throw new ApiError('Nombre o PIN incorrecto.', 401)
      }
      if (!found.activo) throw new ApiError('Tu cuenta está desactivada.', 403)

      setAuthToken(found.id)
      const usuario = publicUser(found)
      saveCachedUser(usuario)
      return { token: found.id, usuario }
    },

    me: async () => {
      const usuario = publicUser(await requireUser())
      saveCachedUser(usuario)
      return { usuario }
    },
  },

  usuarios: {
    list: async () => {
      await requireSupervisor()
      const usuarios = await leerColeccion<UsuarioRegistro>(COL.usuarios)
      usuarios.sort(
        (a, b) =>
          b.rol.localeCompare(a.rol) ||
          a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
      )
      return { usuarios: usuarios.map(publicUser) }
    },

    create: async (payload: { nombre: string; rol: Rol; pin: string }) => {
      await requireSupervisor()
      const nombre = text(payload?.nombre, 80)
      const pin = String(payload?.pin ?? '').trim()
      const rol = payload?.rol
      if (nombre.length < 2) {
        throw new ApiError('El nombre debe tener al menos 2 caracteres.', 400)
      }
      if (rol !== 'supervisor' && rol !== 'trabajador') {
        throw new ApiError('Rol inválido.', 400)
      }
      const pinError = validatePin(pin)
      if (pinError) throw new ApiError(pinError, 400)

      const usuarios = await leerColeccion<UsuarioRegistro>(COL.usuarios)
      if (usuarios.some((usuario) => nameKey(usuario.nombre) === nameKey(nombre))) {
        throw new ApiError('Ya existe un usuario con ese nombre.', 409)
      }

      const row: UsuarioRegistro = {
        id: randomId('usr'),
        nombre,
        rol,
        activo: true,
        pin_hash: await hashPin(pin),
        actualizado_en: nowIso(),
      }
      await setDoc(doc(db, COL.usuarios, row.id), row)
      return { usuario: publicUser(row) }
    },

    update: async (
      id: ID,
      payload: { nombre?: string; rol?: Rol; pin?: string; activo?: boolean }
    ) => {
      const session = await requireSupervisor()
      const snapshot = await getDoc(doc(db, COL.usuarios, id))
      if (!snapshot.exists()) throw new ApiError('Usuario no encontrado.', 404)
      const row = { ...(snapshot.data() as object), id: snapshot.id } as UsuarioRegistro

      const nombre = payload.nombre !== undefined ? text(payload.nombre, 80) : row.nombre
      const rol = payload.rol !== undefined ? payload.rol : row.rol
      const activo = payload.activo !== undefined ? Boolean(payload.activo) : row.activo
      const pin = payload.pin !== undefined ? String(payload.pin).trim() : null

      if (nombre.length < 2) {
        throw new ApiError('El nombre debe tener al menos 2 caracteres.', 400)
      }
      if (rol !== 'supervisor' && rol !== 'trabajador') {
        throw new ApiError('Rol inválido.', 400)
      }
      if (pin !== null) {
        const pinError = validatePin(pin)
        if (pinError) throw new ApiError(pinError, 400)
      }
      if (id === session.id && (!activo || rol !== 'supervisor')) {
        throw new ApiError(
          'No puedes desactivar ni cambiar el rol de tu propia cuenta.',
          400
        )
      }

      const usuarios = await leerColeccion<UsuarioRegistro>(COL.usuarios)
      if (
        usuarios.some(
          (usuario) => usuario.id !== id && nameKey(usuario.nombre) === nameKey(nombre)
        )
      ) {
        throw new ApiError('Ya existe otro usuario con ese nombre.', 409)
      }

      const updated: UsuarioRegistro = {
        ...row,
        nombre,
        rol,
        activo,
        pin_hash: pin !== null ? await hashPin(pin) : row.pin_hash,
        actualizado_en: nowIso(),
      }
      await updateDoc(doc(db, COL.usuarios, id), {
        nombre: updated.nombre,
        rol: updated.rol,
        activo: updated.activo,
        pin_hash: updated.pin_hash,
        actualizado_en: updated.actualizado_en,
      })
      if (id === session.id) saveCachedUser(publicUser(updated))
      return { usuario: publicUser(updated) }
    },

    deactivate: async (id: ID) => {
      const session = await requireSupervisor()
      if (id === session.id) {
        throw new ApiError('No puedes desactivar tu propia cuenta.', 400)
      }
      const snapshot = await getDoc(doc(db, COL.usuarios, id))
      if (!snapshot.exists()) throw new ApiError('Usuario no encontrado.', 404)
      const row = { ...(snapshot.data() as object), id: snapshot.id } as UsuarioRegistro
      const actualizado_en = nowIso()
      await updateDoc(doc(db, COL.usuarios, id), { activo: false, actualizado_en })
      return { usuario: publicUser({ ...row, activo: false, actualizado_en }) }
    },
  },

  tipos: {
    list: async (incluirInactivos = false) => {
      await requireUser()
      const tipos = await leerColeccion<TipoMuestra>(COL.tipos)
      const result = tipos
        .filter((tipo) => incluirInactivos || tipo.activo)
        .sort(
          (a, b) =>
            a.orden - b.orden ||
            a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
        )
        .map((tipo) => ({ ...tipo, campos: sortCampos(tipo.campos ?? []) }))
      return { tipos: result }
    },

    create: async (nombre: string) => {
      await requireSupervisor()
      const limpio = text(nombre, 80)
      if (!limpio) throw new ApiError('El nombre del tipo es obligatorio.', 400)

      const tipos = await leerColeccion<TipoMuestra>(COL.tipos)
      if (tipos.some((tipo) => nameKey(tipo.nombre) === nameKey(limpio))) {
        throw new ApiError('Ya existe un tipo con ese nombre.', 409)
      }
      const orden = tipos.reduce((max, tipo) => Math.max(max, tipo.orden), 0) + 1
      const tipo: TipoMuestra = {
        id: randomId('tipo'),
        nombre: limpio,
        activo: true,
        orden,
        campos: [],
        actualizado_en: nowIso(),
      }
      await setDoc(doc(db, COL.tipos, tipo.id), tipo)
      return { tipo }
    },

    update: async (id: ID, payload: { nombre?: string; activo?: boolean }) => {
      await requireSupervisor()
      const snapshot = await getDoc(doc(db, COL.tipos, id))
      if (!snapshot.exists()) throw new ApiError('Tipo de muestra no encontrado.', 404)
      const tipo = { ...(snapshot.data() as object), id: snapshot.id } as TipoMuestra

      const nombre = payload.nombre !== undefined ? text(payload.nombre, 80) : tipo.nombre
      const activo = payload.activo !== undefined ? Boolean(payload.activo) : tipo.activo
      if (!nombre) throw new ApiError('El nombre del tipo es obligatorio.', 400)

      const tipos = await leerColeccion<TipoMuestra>(COL.tipos)
      if (
        tipos.some((item) => item.id !== id && nameKey(item.nombre) === nameKey(nombre))
      ) {
        throw new ApiError('Ya existe un tipo con ese nombre.', 409)
      }

      const updated: TipoMuestra = {
        ...tipo,
        nombre,
        activo,
        actualizado_en: nowIso(),
      }
      await updateDoc(doc(db, COL.tipos, id), {
        nombre: updated.nombre,
        activo: updated.activo,
        actualizado_en: updated.actualizado_en,
      })
      return { tipo: updated }
    },

    remove: async (id: ID) => {
      await requireSupervisor()
      const snapshot = await getDoc(doc(db, COL.tipos, id))
      if (!snapshot.exists()) throw new ApiError('Tipo de muestra no encontrado.', 404)
      const usados = await getDocs(
        query(collection(db, COL.muestras), where('tipo_muestra_id', '==', id))
      )
      if (!usados.empty) {
        throw new ApiError(
          'No se puede eliminar: existen muestras de este tipo. Desactívalo para ocultarlo.',
          409
        )
      }
      await deleteDoc(doc(db, COL.tipos, id))
      return { ok: true as const }
    },

    reorder: async (ids: ID[]) => {
      await requireSupervisor()
      if (!ids.length) throw new ApiError('Lista de tipos inválida.', 400)
      const timestamp = nowIso()
      await commitEnLotes(
        ids.map((id, index) => (batch) =>
          batch.update(doc(db, COL.tipos, id), {
            orden: index + 1,
            actualizado_en: timestamp,
          })
        )
      )
      const tipos = await leerColeccion<TipoMuestra>(COL.tipos)
      tipos.sort((a, b) => a.orden - b.orden)
      return { tipos: tipos.map((tipo) => ({ ...tipo, campos: sortCampos(tipo.campos ?? []) })) }
    },

    addCampo: async (
      tipoId: ID,
      payload: {
        nombre_campo: string
        tipo_dato: string
        opciones: string[]
        requerido: boolean
      }
    ) => {
      await requireSupervisor()
      const snapshot = await getDoc(doc(db, COL.tipos, tipoId))
      if (!snapshot.exists()) throw new ApiError('Tipo de muestra no encontrado.', 404)
      const tipo = { ...(snapshot.data() as object), id: snapshot.id } as TipoMuestra

      const parsed = parseCampo(payload)
      const orden =
        (tipo.campos ?? []).reduce((max, campo) => Math.max(max, campo.orden), 0) + 1
      const timestamp = nowIso()
      const campo: Campo = {
        id: randomId('campo'),
        tipo_muestra_id: tipoId,
        ...parsed,
        orden,
        actualizado_en: timestamp,
      }
      const campos = [...(tipo.campos ?? []), campo]
      await updateDoc(doc(db, COL.tipos, tipoId), {
        campos,
        actualizado_en: timestamp,
      })
      return { campo }
    },

    updateCampo: async (
      campoId: ID,
      payload: {
        nombre_campo: string
        tipo_dato: string
        opciones: string[]
        requerido: boolean
      }
    ) => {
      await requireSupervisor()
      const tipos = await leerColeccion<TipoMuestra>(COL.tipos)
      const tipo = tipos.find((item) =>
        (item.campos ?? []).some((campo) => campo.id === campoId)
      )
      if (!tipo) throw new ApiError('Campo no encontrado.', 404)

      const parsed = parseCampo(payload)
      const timestamp = nowIso()
      let actualizado: Campo | null = null
      const campos = (tipo.campos ?? []).map((campo) => {
        if (campo.id !== campoId) return campo
        actualizado = { ...campo, ...parsed, actualizado_en: timestamp }
        return actualizado
      })
      await updateDoc(doc(db, COL.tipos, tipo.id), {
        campos,
        actualizado_en: timestamp,
      })
      if (!actualizado) throw new ApiError('Campo no encontrado.', 404)
      return { campo: actualizado }
    },

    removeCampo: async (campoId: ID) => {
      await requireSupervisor()
      const tipos = await leerColeccion<TipoMuestra>(COL.tipos)
      const tipo = tipos.find((item) =>
        (item.campos ?? []).some((campo) => campo.id === campoId)
      )
      if (!tipo) throw new ApiError('Campo no encontrado.', 404)
      const timestamp = nowIso()

      const operaciones: Array<(batch: WriteBatch) => void> = [
        (batch) =>
          batch.update(doc(db, COL.tipos, tipo.id), {
            campos: (tipo.campos ?? []).filter((campo) => campo.id !== campoId),
            actualizado_en: timestamp,
          }),
      ]

      const [muestras, pendientes] = await Promise.all([
        leerColeccion<MuestraBase>(COL.muestras),
        leerColeccion<Pendiente>(COL.pendientes),
      ])
      for (const muestra of muestras) {
        if (campoId in (muestra.valores ?? {})) {
          const valores = { ...muestra.valores }
          delete valores[campoId]
          operaciones.push((batch) =>
            batch.update(doc(db, COL.muestras, muestra.id), {
              valores,
              actualizado_en: timestamp,
            })
          )
        }
      }
      for (const pendiente of pendientes) {
        if (campoId in (pendiente.valores ?? {})) {
          const valores = { ...pendiente.valores }
          delete valores[campoId]
          operaciones.push((batch) =>
            batch.update(doc(db, COL.pendientes, pendiente.id), {
              valores,
              actualizado_en: timestamp,
            })
          )
        }
      }
      await commitEnLotes(operaciones)
      return { ok: true as const }
    },

    reorderCampos: async (tipoId: ID, ids: ID[]) => {
      await requireSupervisor()
      if (!ids.length) throw new ApiError('Lista de campos inválida.', 400)
      const snapshot = await getDoc(doc(db, COL.tipos, tipoId))
      if (!snapshot.exists()) throw new ApiError('Tipo de muestra no encontrado.', 404)
      const tipo = { ...(snapshot.data() as object), id: snapshot.id } as TipoMuestra
      const campos = tipo.campos ?? []
      const validos = new Set(campos.map((campo) => campo.id))
      if (!ids.every((id) => validos.has(id))) {
        throw new ApiError('Los campos no pertenecen a este tipo.', 400)
      }

      const timestamp = nowIso()
      const orden = new Map(ids.map((id, index) => [id, index + 1]))
      const actualizados = campos.map((campo) => ({
        ...campo,
        orden: orden.get(campo.id) ?? campo.orden,
        actualizado_en: timestamp,
      }))
      await updateDoc(doc(db, COL.tipos, tipoId), {
        campos: actualizados,
        actualizado_en: timestamp,
      })
      return { tipo: { ...tipo, campos: sortCampos(actualizados), actualizado_en: timestamp } }
    },
  },

  muestras: {
    list: async (params: {
      fecha?: string
      trabajador?: ID | ''
      tipo?: ID | ''
      estado?: EstadoMuestra | ''
      numero?: string
      enviado?: '0' | '1' | ''
    }) => {
      await requireSupervisor()
      const numero = text(params.numero, 80).toLocaleLowerCase('es')
      const rows = (await leerColeccion<MuestraBase>(COL.muestras)).filter((muestra) => {
        if (params.fecha && muestra.fecha_asignacion !== params.fecha) return false
        if (params.trabajador && muestra.asignado_a !== params.trabajador) return false
        if (params.tipo && muestra.tipo_muestra_id !== params.tipo) return false
        if (params.estado && muestra.estado !== params.estado) return false
        if (numero && !muestra.numero_muestra.toLocaleLowerCase('es').includes(numero)) {
          return false
        }
        if (params.enviado === '1' && !muestra.enviado) return false
        if (params.enviado === '0' && muestra.enviado) return false
        return true
      })

      rows.sort(
        (a, b) =>
          b.fecha_asignacion.localeCompare(a.fecha_asignacion) ||
          compareNumero(a.numero_muestra, b.numero_muestra)
      )
      return { muestras: await hydrateMuestras(rows) }
    },

    mias: async (fecha: string) => {
      const user = await requireUser()
      if (user.rol !== 'trabajador') {
        throw new ApiError('Este listado es solo para trabajadores.', 403)
      }
      const dia = isValidDate(fecha) ? fecha : todayLocal()
      const snapshot = await getDocs(
        query(collection(db, COL.muestras), where('asignado_a', '==', user.id))
      )
      const rows = docsConId<MuestraBase>(snapshot)
        .filter((muestra) => !muestra.enviado)
        .sort(
          (a, b) =>
            a.fecha_asignacion.localeCompare(b.fecha_asignacion) ||
            compareNumero(a.numero_muestra, b.numero_muestra)
        )
      return { fecha: dia, muestras: await hydrateMuestras(rows) }
    },

    observarMias: (
      fecha: string,
      onData: (resultado: { fecha: string; muestras: Muestra[] }) => void,
      onError?: (error: unknown) => void
    ) => {
      let cancelado = false
      let unsubscribe: (() => void) | null = null

      void (async () => {
        try {
          const user = await requireUser()
          if (user.rol !== 'trabajador') {
            throw new ApiError('Este listado es solo para trabajadores.', 403)
          }
          if (cancelado) return
          const dia = isValidDate(fecha) ? fecha : todayLocal()
          const q = query(
            collection(db, COL.muestras),
            where('asignado_a', '==', user.id)
          )
          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              const rows = docsConId<MuestraBase>(snapshot)
                .filter((muestra) => !muestra.enviado)
                .sort(
                  (a, b) =>
                    a.fecha_asignacion.localeCompare(b.fecha_asignacion) ||
                    compareNumero(a.numero_muestra, b.numero_muestra)
                )
              void hydrateMuestras(rows)
                .then((muestras) => {
                  if (!cancelado) onData({ fecha: dia, muestras })
                })
                .catch((error: unknown) => {
                  if (!cancelado) onError?.(normalizarError(error))
                })
            },
            (error) => {
              if (!cancelado) onError?.(normalizarError(error))
            }
          )
        } catch (error) {
          if (!cancelado) onError?.(normalizarError(error))
        }
      })()

      return () => {
        cancelado = true
        unsubscribe?.()
      }
    },

    asignar: async (payload: {
      tipo_muestra_id: ID
      asignado_a: ID
      numeros: string[]
      valores?: Record<string, string>
      comentario?: string
      fecha?: string
    }) => {
      const supervisor = await requireSupervisor()
      const tipoId = payload.tipo_muestra_id
      if (!tipoId) throw new ApiError('Selecciona un tipo de muestra.', 400)
      const tipoSnapshot = await getDoc(doc(db, COL.tipos, tipoId))
      if (!tipoSnapshot.exists()) throw new ApiError('El tipo de muestra no existe.', 404)
      const tipo = {
        ...(tipoSnapshot.data() as object),
        id: tipoSnapshot.id,
      } as TipoMuestra

      const workerSnapshot = await getDoc(doc(db, COL.usuarios, payload.asignado_a))
      if (!workerSnapshot.exists()) throw new ApiError('Selecciona un trabajador activo.', 400)
      const worker = {
        ...(workerSnapshot.data() as object),
        id: workerSnapshot.id,
      } as UsuarioRegistro
      if (worker.rol !== 'trabajador' || !worker.activo) {
        throw new ApiError('Selecciona un trabajador activo.', 400)
      }

      const numeros = [
        ...new Set(
          (Array.isArray(payload.numeros) ? payload.numeros : [])
            .map((numero) => text(numero, 40))
            .filter(Boolean)
        ),
      ].slice(0, 200)
      if (!numeros.length) {
        throw new ApiError('Ingresa al menos un número de muestra.', 400)
      }

      const existentesSnap = await getDocs(
        query(collection(db, COL.muestras), where('tipo_muestra_id', '==', tipoId))
      )
      const duplicados = docsConId<MuestraBase>(existentesSnap)
        .filter(
          (muestra) =>
            ['pendiente', 'hecha'].includes(muestra.estado) &&
            numeros.includes(muestra.numero_muestra)
        )
        .map((muestra) => muestra.numero_muestra)
      if (duplicados.length) {
        throw new ApiError('Ya existen muestras con esos números para este tipo.', 409, {
          duplicados: [...new Set(duplicados)],
        })
      }

      const camposValidos = new Set((tipo.campos ?? []).map((campo) => campo.id))
      const valores: Record<string, string> = {}
      if (payload.valores && typeof payload.valores === 'object') {
        for (const [campoId, valor] of Object.entries(payload.valores)) {
          const limpio = text(valor, 500)
          if (camposValidos.has(campoId) && limpio) valores[campoId] = limpio
        }
      }

      const fecha = isValidDate(payload.fecha) ? payload.fecha : todayLocal()
      const timestamp = nowIso()
      const muestras: MuestraBase[] = numeros.map((numero) => ({
        id: randomId('muestra'),
        numero_muestra: numero,
        tipo_muestra_id: tipoId,
        asignado_a: worker.id,
        fecha_asignacion: fecha,
        asignado_por: supervisor.id,
        estado: 'pendiente',
        fecha_marcado: null,
        hora_marcado: null,
        enviado: false,
        fecha_envio: null,
        creado_en: timestamp,
        actualizado_en: timestamp,
        valores: { ...valores },
        comentario: text(payload.comentario, 1000),
      }))
      await commitEnLotes(
        muestras.map((muestra) => (batch) =>
          batch.set(doc(db, COL.muestras, muestra.id), muestra)
        )
      )
      return { muestras: await hydrateMuestras(muestras) }
    },
    historialMio: async () => {
      const user = await requireUser()
      const snap = await getDocs(query(collection(db, COL.muestras), where('asignado_a', '==', user.id)))
      const rows = docsConId<MuestraBase>(snap).filter((m) => m.enviado).sort((a,b) => (b.fecha_envio ?? '').localeCompare(a.fecha_envio ?? ''))
      return { muestras: await hydrateMuestras(rows) }
    },
    regresarPendiente: async (id: ID) => {
      const user = await requireUser(); const ref = doc(db, COL.muestras, id); const snap = await getDoc(ref)
      if (!snap.exists()) throw new ApiError('Muestra no encontrada.',404)
      const m = { ...(snap.data() as object), id:snap.id } as MuestraBase
      if (m.asignado_a !== user.id || !m.enviado) throw new ApiError('No puedes editar esta muestra.',403)
      await updateDoc(ref,{ estado:'pendiente', enviado:false, fecha_envio:null, fecha_marcado:null, hora_marcado:null, actualizado_en:nowIso() })
      return { ok:true as const }
    },
    editar: async (id: ID, payload: Partial<Pick<MuestraBase,'numero_muestra'|'tipo_muestra_id'|'asignado_a'|'valores'|'comentario'>>) => {
      await requireSupervisor(); const ref=doc(db,COL.muestras,id); const snap=await getDoc(ref)
      if (!snap.exists()) throw new ApiError('Muestra no encontrada.',404)
      if (payload.asignado_a) {
        const worker = await getDoc(doc(db,COL.usuarios,payload.asignado_a))
        if (!worker.exists() || (worker.data() as UsuarioRegistro).rol !== 'trabajador' || !(worker.data() as UsuarioRegistro).activo) throw new ApiError('Selecciona un trabajador activo.',400)
      }
      if (payload.tipo_muestra_id && !(await getDoc(doc(db,COL.tipos,payload.tipo_muestra_id))).exists()) throw new ApiError('Selecciona un tipo de muestra válido.',400)
      if (payload.numero_muestra !== undefined && !text(payload.numero_muestra,40)) throw new ApiError('El número de muestra es obligatorio.',400)
      await updateDoc(ref,{...payload, actualizado_en:nowIso()}); return {ok:true as const}
    },
    eliminar: async (id: ID, confirmarEnviada=false) => {
      await requireSupervisor(); const ref=doc(db,COL.muestras,id); const snap=await getDoc(ref)
      if (!snap.exists()) throw new ApiError('Muestra no encontrada.',404)
      if ((snap.data() as MuestraBase).enviado && !confirmarEnviada) throw new ApiError('Confirma para eliminar una muestra enviada.',409)
      await deleteDoc(ref); return {ok:true as const}
    },
  },

  envios: {
    list: async (params: { fecha?: string; trabajador?: ID | '' }) => {
      await requireSupervisor()
      const usuarios = new Map(
        (await leerColeccion<UsuarioRegistro>(COL.usuarios)).map((usuario) => [
          usuario.id,
          usuario.nombre,
        ])
      )
      const envios = (await leerColeccion<Envio>(COL.envios))
        .filter((envio) => {
          if (params.fecha && envio.fecha !== params.fecha) return false
          if (params.trabajador && envio.trabajador_id !== params.trabajador) return false
          return true
        })
        .sort(
          (a, b) =>
            b.fecha.localeCompare(a.fecha) ||
            b.hora.localeCompare(a.hora) ||
            b.creado_en.localeCompare(a.creado_en)
        )
        .map((envio) => ({
          ...envio,
          trabajador_nombre: usuarios.get(envio.trabajador_id) ?? envio.trabajador_nombre,
        }))
      return { envios }
    },

    enviar: async (payload: {
      fecha: string
      hora: string
      items: EnvioEntrante[]
    }) => {
      const user = await requireUser()
      if (user.rol !== 'trabajador') {
        throw new ApiError('Solo los trabajadores envían listas.', 403)
      }

      const fecha = isValidDate(payload.fecha) ? payload.fecha : todayLocal()
      const hora = normalizeTime(payload.hora) ?? timeNow()
      const items = Array.isArray(payload.items) ? payload.items : []

      if (!items.length) {
        throw new ApiError('No hay muestras marcadas para enviar.', 400)
      }
      if (items.length > 500) {
        throw new ApiError('Demasiadas muestras en un solo envío.', 400)
      }

      const ids = items.map((item) => item.muestra_id)
      if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
        throw new ApiError('La lista de muestras contiene IDs inválidos o repetidos.', 400)
      }

      const [tipos, muestrasSnap] = await Promise.all([
        leerColeccion<TipoMuestra>(COL.tipos),
        Promise.all(items.map((item) => getDoc(doc(db, COL.muestras, item.muestra_id)))),
      ])
      const tiposPorId = new Map(tipos.map((tipo) => [tipo.id, tipo]))
      const detalles: EnvioItem[] = []
      const operaciones: Array<{
        muestra: MuestraBase
        estado: 'hecha' | 'no_hecha'
        fechaMarcado: string
        horaMarcado: string
        valores: Record<string, string>
        valoresDetalle: EnvioItem['valores']
      }> = []

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]
        const snapshot = muestrasSnap[index]
        if (!snapshot.exists()) {
          throw new ApiError(`La muestra ${item.muestra_id} no existe.`, 404)
        }
        const muestra = {
          ...(snapshot.data() as object),
          id: snapshot.id,
        } as MuestraBase
        if (muestra.asignado_a !== user.id) {
          throw new ApiError(`La muestra ${item.muestra_id} no pertenece a tu lista.`, 403)
        }
        if (item.estado !== 'hecha' && item.estado !== 'no_hecha') {
          throw new ApiError(
            'Cada muestra enviada debe estar marcada como hecha o no hecha.',
            400
          )
        }

        const tipo = tiposPorId.get(muestra.tipo_muestra_id)
        if (!tipo) throw new ApiError('El tipo de muestra de esta lista ya no existe.', 400)
        const campos = new Map((tipo.campos ?? []).map((campo) => [campo.id, campo]))

        const fechaMarcado = isValidDate(item.fecha_marcado)
          ? item.fecha_marcado
          : todayLocal()
        const horaMarcado = normalizeTime(item.hora_marcado) ?? timeNow()
        const valores: Record<string, string> = {}
        const valoresDetalle: EnvioItem['valores'] = []

        if (item.valores && typeof item.valores === 'object') {
          for (const [campoId, valor] of Object.entries(item.valores)) {
            const campo = campos.get(campoId)
            const limpio = text(valor, 500)
            if (campo && limpio) {
              valores[campoId] = limpio
              valoresDetalle.push({
                campo_tipo_id: campoId,
                nombre_campo: campo.nombre_campo,
                tipo_dato: campo.tipo_dato,
                valor: limpio,
              })
            }
          }
        }

        if (item.estado === 'hecha') {
          const faltantes = (tipo.campos ?? [])
            .filter((campo) => campo.requerido && !valores[campo.id])
            .map((campo) => campo.nombre_campo)
          if (faltantes.length) {
            throw new ApiError(
              `Completa los campos obligatorios de la muestra #${muestra.numero_muestra}: ${faltantes.join(', ')}.`,
              400
            )
          }
        }

        operaciones.push({
          muestra,
          estado: item.estado,
          fechaMarcado,
          horaMarcado,
          valores,
          valoresDetalle,
        })
        detalles.push({
          muestra_id: muestra.id,
          numero_muestra: muestra.numero_muestra,
          tipo_muestra_id: muestra.tipo_muestra_id,
          tipo_nombre: tipo.nombre,
          estado: item.estado,
          fecha_marcado: fechaMarcado,
          hora_marcado: horaMarcado,
          valores: valoresDetalle,
          comentario: text(item.comentario, 1000),
        })
      }

      const creadoEn = nowIso()
      const envio: Envio = {
        id: randomId('envio'),
        trabajador_id: user.id,
        trabajador_nombre: user.nombre,
        fecha,
        hora,
        cantidad_muestras: operaciones.length,
        creado_en: creadoEn,
        detalle: { fecha, hora, items: detalles },
      }

      const escrituras: Array<(batch: WriteBatch) => void> = [
        (batch) => batch.set(doc(db, COL.envios, envio.id), envio),
      ]
      for (const operacion of operaciones) {
        escrituras.push((batch) =>
          batch.update(doc(db, COL.muestras, operacion.muestra.id), {
            estado: operacion.estado,
            fecha_marcado: operacion.fechaMarcado,
            hora_marcado: operacion.horaMarcado,
            enviado: true,
            fecha_envio: creadoEn,
            actualizado_en: creadoEn,
            valores: operacion.valores,
            comentario: text(items.find((i) => i.muestra_id === operacion.muestra.id)?.comentario, 1000),
          })
        )
        escrituras.push((batch) =>
          batch.delete(doc(db, COL.pendientes, pendingId(user.id, operacion.muestra.id)))
        )
      }
      await commitEnLotes(escrituras)

      return { envio_id: envio.id, cantidad: operaciones.length, detalle: envio.detalle }
    },
  },

  pendientes: {
    list: async () => {
      const user = await requireUser()
      if (user.rol !== 'trabajador') {
        throw new ApiError('Esta lista es solo para trabajadores.', 403)
      }
      const snapshot = await getDocs(
        query(collection(db, COL.pendientes), where('usuario_id', '==', user.id))
      )
      return { pendientes: docsConId<Pendiente>(snapshot) }
    },

    guardar: async (payload: {
      muestra_id: ID
      estado: EstadoMuestra
      fecha_marcado: string | null
      hora_marcado: string | null
      valores: Record<string, string>
      comentario?: string
    }) => {
      const user = await requireUser()
      if (user.rol !== 'trabajador') {
        throw new ApiError('Esta lista es solo para trabajadores.', 403)
      }
      const pendiente: Pendiente = {
        id: pendingId(user.id, payload.muestra_id),
        usuario_id: user.id,
        muestra_id: payload.muestra_id,
        estado: payload.estado,
        fecha_marcado: payload.fecha_marcado,
        hora_marcado: payload.hora_marcado,
        valores: { ...payload.valores },
        comentario: text(payload.comentario, 1000),
        actualizado_en: nowIso(),
      }
      await setDoc(doc(db, COL.pendientes, pendiente.id), pendiente)
      return { pendiente }
    },

    eliminar: async (ids: string[]) => {
      const user = await requireUser()
      if (user.rol !== 'trabajador') {
        throw new ApiError('Esta lista es solo para trabajadores.', 403)
      }
      const validos = ids.filter((id) => id.startsWith(`${user.id}__`))
      await commitEnLotes(
        validos.map((id) => (batch) => batch.delete(doc(db, COL.pendientes, id)))
      )
      return { ok: true as const }
    },
  },

  reportes: {
    resumen: async (fecha: string): Promise<Resumen> => {
      await requireSupervisor()
      const dia = isValidDate(fecha) ? fecha : todayLocal()
      const [muestras, usuarios] = await Promise.all([
        leerColeccion<MuestraBase>(COL.muestras),
        leerColeccion<UsuarioRegistro>(COL.usuarios),
      ])
      const delDia = muestras.filter((muestra) => muestra.fecha_asignacion === dia)
      const totales = {
        asignadas: delDia.length,
        hechas: delDia.filter((muestra) => muestra.estado === 'hecha').length,
        no_hechas: delDia.filter((muestra) => muestra.estado === 'no_hecha').length,
        pendientes: delDia.filter((muestra) => muestra.estado === 'pendiente').length,
        enviadas: delDia.filter((muestra) => muestra.enviado).length,
      }

      const porTrabajador = new Map<
        ID,
        {
          id: ID
          nombre: string
          asignadas: number
          hechas: number
          no_hechas: number
          pendientes: number
        }
      >()
      for (const muestra of delDia) {
        const usuario = usuarios.find((item) => item.id === muestra.asignado_a)
        const actual = porTrabajador.get(muestra.asignado_a) ?? {
          id: muestra.asignado_a,
          nombre: usuario?.nombre ?? 'Trabajador',
          asignadas: 0,
          hechas: 0,
          no_hechas: 0,
          pendientes: 0,
        }
        actual.asignadas += 1
        if (muestra.estado === 'hecha') actual.hechas += 1
        if (muestra.estado === 'no_hecha') actual.no_hechas += 1
        if (muestra.estado === 'pendiente') actual.pendientes += 1
        porTrabajador.set(muestra.asignado_a, actual)
      }

      return {
        fecha: dia,
        totales,
        trabajadores: [...porTrabajador.values()].sort((a, b) =>
          a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
        ),
      }
    },

    historial: async (params: {
      fecha?: string
      trabajador?: ID | ''
      numero?: string
      tipo?: ID | ''
    }) => {
      await requireSupervisor()
      const numero = text(params.numero, 80).toLocaleLowerCase('es')
      const rows = (await leerColeccion<MuestraBase>(COL.muestras))
        .filter((muestra) => {
          if (muestra.estado === 'pendiente') return false
          if (params.fecha && muestra.fecha_marcado !== params.fecha) return false
          if (params.trabajador && muestra.asignado_a !== params.trabajador) return false
          if (params.tipo && muestra.tipo_muestra_id !== params.tipo) return false
          if (numero && !muestra.numero_muestra.toLocaleLowerCase('es').includes(numero)) {
            return false
          }
          return true
        })
        .sort(
          (a, b) =>
            (b.fecha_marcado ?? '').localeCompare(a.fecha_marcado ?? '') ||
            (b.hora_marcado ?? '').localeCompare(a.hora_marcado ?? '')
        )
      return { muestras: await hydrateMuestras(rows) }
    },
  },
}

function conManejoDeErrores<T>(valor: T): T {
  if (typeof valor === 'function') {
    // Las funciones async se envuelven para normalizar errores de Firestore.
    // `observarMias` devuelve una función de limpieza síncrona y se deja intacta.
    if (Object.prototype.toString.call(valor) !== '[object AsyncFunction]') return valor
    return ((...args: unknown[]) =>
      Promise.resolve((valor as (...args: unknown[]) => unknown)(...args)).catch((error) => {
        throw normalizarError(error)
      })) as T
  }
  if (valor && typeof valor === 'object') {
    return new Proxy(valor as object, {
      get(target, prop, receiver) {
        return conManejoDeErrores(Reflect.get(target, prop, receiver))
      },
    }) as T
  }
  return valor
}

export const api = conManejoDeErrores(apiLocal)
