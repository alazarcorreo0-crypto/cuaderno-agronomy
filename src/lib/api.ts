import type {
  Envio,
  EnvioEntrante,
  EstadoMuestra,
  Muestra,
  Resumen,
  Rol,
  TipoMuestra,
  Usuario,
} from '../types'

const TOKEN_KEY = 'cuaderno.token'
const USER_KEY = 'cuaderno.usuario'

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

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

async function request<T>(path: string, { method = 'GET', body, signal }: RequestOptions = {}) {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch {
    throw new ApiError('Sin conexión con el servidor.', 0)
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(
      typeof data?.error === 'string' ? data.error : 'Ocurrió un error inesperado.',
      response.status,
      { duplicados: Array.isArray(data?.duplicados) ? data.duplicados : undefined }
    )
  }
  return data as T
}

function query(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const api = {
  auth: {
    login: (nombre: string, pin: string) =>
      request<{ token: string; usuario: Usuario }>('/auth/login', {
        method: 'POST',
        body: { nombre, pin },
      }),
    me: () => request<{ usuario: Usuario }>('/auth/me'),
  },

  usuarios: {
    list: () => request<{ usuarios: Usuario[] }>('/usuarios'),
    create: (payload: { nombre: string; rol: Rol; pin: string }) =>
      request<{ usuario: Usuario }>('/usuarios', { method: 'POST', body: payload }),
    update: (
      id: number,
      payload: { nombre?: string; rol?: Rol; pin?: string; activo?: boolean }
    ) => request<{ usuario: Usuario }>(`/usuarios/${id}`, { method: 'PUT', body: payload }),
    deactivate: (id: number) =>
      request<{ usuario: Usuario }>(`/usuarios/${id}`, { method: 'DELETE' }),
  },

  tipos: {
    list: (incluirInactivos = false) =>
      request<{ tipos: TipoMuestra[] }>(
        `/tipos${incluirInactivos ? '?incluir_inactivos=1' : ''}`
      ),
    create: (nombre: string) =>
      request<{ tipo: TipoMuestra }>('/tipos', { method: 'POST', body: { nombre } }),
    update: (id: number, payload: { nombre?: string; activo?: boolean }) =>
      request<{ tipo: TipoMuestra }>(`/tipos/${id}`, { method: 'PUT', body: payload }),
    remove: (id: number) => request<{ ok: true }>(`/tipos/${id}`, { method: 'DELETE' }),
    reorder: (ids: number[]) =>
      request<{ tipos: TipoMuestra[] }>('/tipos/reordenar', { method: 'POST', body: { ids } }),
    addCampo: (
      tipoId: number,
      payload: {
        nombre_campo: string
        tipo_dato: string
        opciones: string[]
        requerido: boolean
      }
    ) => request<{ campo: unknown }>(`/tipos/${tipoId}/campos`, { method: 'POST', body: payload }),
    updateCampo: (
      campoId: number,
      payload: {
        nombre_campo: string
        tipo_dato: string
        opciones: string[]
        requerido: boolean
      }
    ) => request<{ campo: unknown }>(`/tipos/campos/${campoId}`, { method: 'PUT', body: payload }),
    removeCampo: (campoId: number) =>
      request<{ ok: true }>(`/tipos/campos/${campoId}`, { method: 'DELETE' }),
    reorderCampos: (tipoId: number, ids: number[]) =>
      request<{ tipo: TipoMuestra }>(`/tipos/${tipoId}/campos/reordenar`, {
        method: 'POST',
        body: { ids },
      }),
  },

  muestras: {
    list: (params: {
      fecha?: string
      trabajador?: number | ''
      tipo?: number | ''
      estado?: EstadoMuestra | ''
      numero?: string
      enviado?: '0' | '1' | ''
    }) => request<{ muestras: Muestra[] }>(`/muestras${query(params)}`),
    mias: (fecha: string) =>
      request<{ fecha: string; muestras: Muestra[] }>(
        `/muestras/mias${query({ fecha })}`
      ),
    asignar: (payload: {
      tipo_muestra_id: number
      asignado_a: number
      numeros: string[]
      valores?: Record<string, string>
      fecha?: string
    }) => request<{ muestras: Muestra[] }>('/muestras', { method: 'POST', body: payload }),
  },

  envios: {
    list: (params: { fecha?: string; trabajador?: number | '' }) =>
      request<{ envios: Envio[] }>(`/envios${query(params)}`),
    enviar: (payload: {
      fecha: string
      hora: string
      items: EnvioEntrante[]
    }) => request<{ envio_id: number; cantidad: number }>('/envios', {
      method: 'POST',
      body: payload,
    }),
  },

  reportes: {
    resumen: (fecha: string) =>
      request<Resumen>(`/reportes/resumen${query({ fecha })}`),
    historial: (params: {
      fecha?: string
      trabajador?: number | ''
      numero?: string
      tipo?: number | ''
    }) => request<{ muestras: Muestra[] }>(`/reportes/historial${query(params)}`),
  },
}
