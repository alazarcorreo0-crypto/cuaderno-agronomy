export type ID = string

export type Rol = 'supervisor' | 'trabajador'

export interface Usuario {
  id: ID
  nombre: string
  rol: Rol
  activo: boolean
}

/** Registro completo de usuario. El hash del PIN solo se usa dentro de la capa local. */
export interface UsuarioRegistro extends Usuario {
  pin_hash: string
  actualizado_en: string
}

export type TipoDato = 'texto' | 'numero' | 'seleccion' | 'rango'

export interface Campo {
  id: ID
  tipo_muestra_id: ID
  nombre_campo: string
  tipo_dato: TipoDato
  opciones: string[] | null
  requerido: boolean
  orden: number
  actualizado_en: string
}

export interface TipoMuestra {
  id: ID
  nombre: string
  activo: boolean
  orden: number
  campos: Campo[]
  actualizado_en: string
}

export type EstadoMuestra = 'pendiente' | 'hecha' | 'no_hecha'

/** Datos persistidos de una muestra, sin nombres/campos derivados. */
export interface MuestraBase {
  id: ID
  numero_muestra: string
  tipo_muestra_id: ID
  asignado_a: ID
  fecha_asignacion: string
  asignado_por: ID
  estado: EstadoMuestra
  fecha_marcado: string | null
  hora_marcado: string | null
  enviado: boolean
  fecha_envio: string | null
  creado_en: string
  actualizado_en: string
  valores: Record<string, string>
}

/** Muestra lista para mostrar: incluye los nombres y campos vigentes del tipo. */
export interface Muestra extends MuestraBase {
  tipo_nombre: string | null
  trabajador_nombre: string | null
  asignado_por_nombre: string | null
  campos: Campo[]
}

export interface ResumenTrabajador {
  id: ID
  nombre: string
  asignadas: number
  hechas: number
  no_hechas: number
  pendientes: number
}

export interface Resumen {
  fecha: string
  totales: {
    asignadas: number
    hechas: number
    no_hechas: number
    pendientes: number
    enviadas: number
  }
  trabajadores: ResumenTrabajador[]
}

export interface EnvioValor {
  campo_tipo_id: ID
  nombre_campo: string
  tipo_dato: TipoDato
  valor: string
}

export interface EnvioItem {
  muestra_id: ID
  numero_muestra: string
  tipo_muestra_id: ID
  tipo_nombre: string | null
  estado: 'hecha' | 'no_hecha'
  fecha_marcado: string
  hora_marcado: string
  valores: EnvioValor[]
}

export interface Envio {
  id: ID
  trabajador_id: ID
  trabajador_nombre: string
  fecha: string
  hora: string
  cantidad_muestras: number
  creado_en: string
  detalle: {
    fecha: string
    hora: string
    items: EnvioItem[]
  }
}

export interface EnvioEntrante {
  muestra_id: ID
  estado: 'hecha' | 'no_hecha'
  fecha_marcado: string
  hora_marcado: string
  valores: Record<string, string>
}

export interface Pendiente {
  id: string
  usuario_id: ID
  muestra_id: ID
  estado: EstadoMuestra
  fecha_marcado: string | null
  hora_marcado: string | null
  valores: Record<string, string>
  actualizado_en: string
}

/** Archivo de transferencia que se descarga o se importa entre dispositivos. */
export interface ArchivoReporte {
  app: 'cuaderno-campo'
  version: 1
  exportado_en: string
  datos: {
    usuarios: UsuarioRegistro[]
    tipos: TipoMuestra[]
    muestras: MuestraBase[]
    envios: Envio[]
  }
}

export interface ResumenImportacion {
  usuarios: number
  tipos: number
  muestras: number
  envios: number
}
