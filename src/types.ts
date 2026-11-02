export type Rol = 'supervisor' | 'trabajador'

export interface Usuario {
  id: number
  nombre: string
  rol: Rol
  activo: boolean
}

export type TipoDato = 'texto' | 'numero' | 'seleccion' | 'rango'

export interface Campo {
  id: number
  tipo_muestra_id: number
  nombre_campo: string
  tipo_dato: TipoDato
  opciones: string[] | null
  requerido: boolean
  orden: number
}

export interface TipoMuestra {
  id: number
  nombre: string
  activo: boolean
  orden: number
  campos: Campo[]
}

export type EstadoMuestra = 'pendiente' | 'hecha' | 'no_hecha'

export interface Muestra {
  id: number
  numero_muestra: string
  tipo_muestra_id: number
  asignado_a: number
  fecha_asignacion: string
  asignado_por: number
  estado: EstadoMuestra
  fecha_marcado: string | null
  hora_marcado: string | null
  enviado: boolean
  fecha_envio: string | null
  creado_en: string
  tipo_nombre: string | null
  trabajador_nombre: string | null
  asignado_por_nombre: string | null
  campos: Campo[]
  valores: Record<string, string>
}

export interface ResumenTrabajador {
  id: number
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
  campo_tipo_id: number
  nombre_campo: string
  tipo_dato: TipoDato
  valor: string
}

export interface EnvioItem {
  muestra_id: number
  numero_muestra: string
  tipo_muestra_id: number
  tipo_nombre: string | null
  estado: 'hecha' | 'no_hecha'
  fecha_marcado: string
  hora_marcado: string
  valores: EnvioValor[]
}

export interface Envio {
  id: number
  trabajador_id: number
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
  muestra_id: number
  estado: 'hecha' | 'no_hecha'
  fecha_marcado: string
  hora_marcado: string
  valores: Record<string, string>
}

export interface Pendiente {
  id: string
  usuario_id: number
  muestra_id: number
  estado: EstadoMuestra
  fecha_marcado: string | null
  hora_marcado: string | null
  valores: Record<string, string>
  actualizado_en: string
}
