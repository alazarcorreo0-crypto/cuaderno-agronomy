import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Eye,
  EyeOff,
  Layers,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { api } from '../../lib/api'
import { cx } from '../../lib/utils'
import type { Campo, TipoDato, TipoMuestra } from '../../types'
import {
  Alert,
  ConfirmDialog,
  EmptyState,
  LoadingBlock,
  Modal,
  PageHeader,
  Spinner,
} from '../../components/ui'

const TIPO_DATO_LABEL: Record<TipoDato, string> = {
  texto: 'Texto',
  numero: 'Número',
  seleccion: 'Selección',
  rango: 'Rango',
}

function parseOpciones(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ]
}

type Aviso = { tone: 'success' | 'error'; texto: string }

type FormCampo = {
  nombre_campo: string
  tipo_dato: TipoDato
  opciones: string
  requerido: boolean
}

const FORM_CAMPO_INICIAL: FormCampo = {
  nombre_campo: '',
  tipo_dato: 'texto',
  opciones: '',
  requerido: false,
}

export default function Tipos() {
  const [tipos, setTipos] = useState<TipoMuestra[]>([])
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [aviso, setAviso] = useState<Aviso | null>(null)

  const [nuevoNombre, setNuevoNombre] = useState('')
  const [creando, setCreando] = useState(false)

  const [editandoTipo, setEditandoTipo] = useState<TipoMuestra | null>(null)
  const [nombreTipoEdicion, setNombreTipoEdicion] = useState('')
  const [guardandoTipo, setGuardandoTipo] = useState(false)
  const [errorTipo, setErrorTipo] = useState('')

  const [modalCampo, setModalCampo] = useState<{
    modo: 'crear' | 'editar'
    campo?: Campo
  } | null>(null)
  const [formCampo, setFormCampo] = useState<FormCampo>(FORM_CAMPO_INICIAL)
  const [guardandoCampo, setGuardandoCampo] = useState(false)
  const [errorCampo, setErrorCampo] = useState('')

  const [confirmar, setConfirmar] = useState<{
    tipo: 'muestra' | 'campo'
    id: string
    nombre: string
  } | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const cargar = useCallback(async () => {
    setErrorCarga('')
    try {
      const resultado = await api.tipos.list(true)
      setTipos(resultado.tipos)
      setSeleccionadoId((actual) => {
        if (actual && resultado.tipos.some((tipo) => tipo.id === actual)) return actual
        return resultado.tipos[0]?.id ?? null
      })
    } catch (err) {
      setErrorCarga(err instanceof Error ? err.message : 'No se pudieron cargar los tipos.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const seleccionado = tipos.find((tipo) => tipo.id === seleccionadoId) ?? null

  async function crearTipo(event: FormEvent) {
    event.preventDefault()
    if (!nuevoNombre.trim()) return
    setCreando(true)
    setAviso(null)
    try {
      const resultado = await api.tipos.create(nuevoNombre.trim())
      setNuevoNombre('')
      setSeleccionadoId(resultado.tipo.id)
      setAviso({ tone: 'success', texto: `Tipo "${resultado.tipo.nombre}" creado.` })
      await cargar()
    } catch (err) {
      setAviso({
        tone: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo crear el tipo.',
      })
    } finally {
      setCreando(false)
    }
  }

  function abrirEdicionTipo(tipo: TipoMuestra) {
    setEditandoTipo(tipo)
    setNombreTipoEdicion(tipo.nombre)
    setErrorTipo('')
  }

  async function guardarTipo(event: FormEvent) {
    event.preventDefault()
    if (!editandoTipo || !nombreTipoEdicion.trim()) return
    setGuardandoTipo(true)
    setErrorTipo('')
    try {
      await api.tipos.update(editandoTipo.id, { nombre: nombreTipoEdicion.trim() })
      setEditandoTipo(null)
      setAviso({ tone: 'success', texto: 'Tipo actualizado.' })
      await cargar()
    } catch (err) {
      setErrorTipo(err instanceof Error ? err.message : 'No se pudo actualizar el tipo.')
    } finally {
      setGuardandoTipo(false)
    }
  }

  async function alternarActivo(tipo: TipoMuestra) {
    setAviso(null)
    try {
      await api.tipos.update(tipo.id, { activo: !tipo.activo })
      await cargar()
    } catch (err) {
      setAviso({
        tone: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo cambiar el estado.',
      })
    }
  }

  async function moverTipo(tipo: TipoMuestra, direccion: -1 | 1) {
    const index = tipos.findIndex((item) => item.id === tipo.id)
    const destino = index + direccion
    if (index < 0 || destino < 0 || destino >= tipos.length) return
    const reordenados = [...tipos]
    ;[reordenados[index], reordenados[destino]] = [reordenados[destino], reordenados[index]]
    setAviso(null)
    try {
      const resultado = await api.tipos.reorder(reordenados.map((item) => item.id))
      setTipos(resultado.tipos)
    } catch (err) {
      setAviso({ tone: 'error', texto: 'No se pudo reordenar.' })
      await cargar()
    }
  }

  function abrirCrearCampo() {
    setFormCampo(FORM_CAMPO_INICIAL)
    setErrorCampo('')
    setModalCampo({ modo: 'crear' })
  }

  function abrirEditarCampo(campo: Campo) {
    setFormCampo({
      nombre_campo: campo.nombre_campo,
      tipo_dato: campo.tipo_dato,
      opciones: (campo.opciones ?? []).join(', '),
      requerido: campo.requerido,
    })
    setErrorCampo('')
    setModalCampo({ modo: 'editar', campo })
  }

  async function guardarCampo(event: FormEvent) {
    event.preventDefault()
    if (!seleccionado || !modalCampo) return
    setErrorCampo('')

    if (!formCampo.nombre_campo.trim()) {
      setErrorCampo('El nombre del campo es obligatorio.')
      return
    }
    const opciones = parseOpciones(formCampo.opciones)
    if (
      (formCampo.tipo_dato === 'seleccion' || formCampo.tipo_dato === 'rango') &&
      !opciones.length
    ) {
      setErrorCampo('Agrega al menos una opción para este tipo de dato.')
      return
    }

    setGuardandoCampo(true)
    try {
      const payload = {
        nombre_campo: formCampo.nombre_campo.trim(),
        tipo_dato: formCampo.tipo_dato,
        opciones,
        requerido: formCampo.requerido,
      }
      if (modalCampo.modo === 'crear') {
        await api.tipos.addCampo(seleccionado.id, payload)
        setAviso({ tone: 'success', texto: 'Campo agregado.' })
      } else if (modalCampo.campo) {
        await api.tipos.updateCampo(modalCampo.campo.id, payload)
        setAviso({ tone: 'success', texto: 'Campo actualizado.' })
      }
      setModalCampo(null)
      await cargar()
    } catch (err) {
      setErrorCampo(err instanceof Error ? err.message : 'No se pudo guardar el campo.')
    } finally {
      setGuardandoCampo(false)
    }
  }

  async function moverCampo(campo: Campo, direccion: -1 | 1) {
    if (!seleccionado) return
    const index = seleccionado.campos.findIndex((item) => item.id === campo.id)
    const destino = index + direccion
    if (index < 0 || destino < 0 || destino >= seleccionado.campos.length) return
    const reordenados = [...seleccionado.campos]
    ;[reordenados[index], reordenados[destino]] = [reordenados[destino], reordenados[index]]
    setAviso(null)
    try {
      await api.tipos.reorderCampos(
        seleccionado.id,
        reordenados.map((item) => item.id)
      )
      await cargar()
    } catch {
      setAviso({ tone: 'error', texto: 'No se pudo reordenar el campo.' })
      await cargar()
    }
  }

  async function eliminar() {
    if (!confirmar) return
    setEliminando(true)
    setAviso(null)
    try {
      if (confirmar.tipo === 'muestra') {
        await api.tipos.remove(confirmar.id)
        setAviso({ tone: 'success', texto: `Tipo "${confirmar.nombre}" eliminado.` })
      } else {
        await api.tipos.removeCampo(confirmar.id)
        setAviso({ tone: 'success', texto: 'Campo eliminado.' })
      }
      setConfirmar(null)
      await cargar()
    } catch (err) {
      setAviso({
        tone: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo eliminar.',
      })
      setConfirmar(null)
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Tipos de muestra"
        subtitle="Crea tipos y define sus campos sin tocar código. Todo es configurable."
      />

      {errorCarga ? (
        <div className="mb-4">
          <Alert tone="error">{errorCarga}</Alert>
        </div>
      ) : null}
      {aviso ? (
        <div className="mb-4">
          <Alert tone={aviso.tone} onClose={() => setAviso(null)}>
            {aviso.texto}
          </Alert>
        </div>
      ) : null}

      {cargando ? (
        <LoadingBlock label="Cargando configuración…" />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[330px_1fr]">
          <section className="card overflow-hidden">
            <div className="border-b border-stone-100 px-4 py-3.5">
              <h2 className="text-sm font-bold text-stone-800">Tipos configurados</h2>
              <p className="mt-0.5 text-xs text-stone-500">
                El orden define cómo los ve el trabajador.
              </p>
            </div>

            <div className="border-b border-stone-100 p-3">
              <form onSubmit={crearTipo} className="flex gap-2">
                <input
                  className="input py-2.5"
                  placeholder="Nuevo tipo, ej. Suelo"
                  value={nuevoNombre}
                  onChange={(event) => setNuevoNombre(event.target.value)}
                  aria-label="Nombre del nuevo tipo"
                />
                <button
                  type="submit"
                  className="btn-primary shrink-0 px-3"
                  disabled={creando || !nuevoNombre.trim()}
                  aria-label="Crear tipo"
                >
                  {creando ? <Spinner /> : <Plus className="h-5 w-5" />}
                </button>
              </form>
            </div>

            {tipos.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<Layers className="h-6 w-6" />}
                  title="Sin tipos todavía"
                  detail="Escribe un nombre arriba para crear el primero."
                />
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {tipos.map((tipo, index) => (
                  <li key={tipo.id}>
                    <div
                      className={cx(
                        'cursor-pointer px-3 py-3 transition',
                        seleccionadoId === tipo.id ? 'bg-green-50' : 'hover:bg-stone-50'
                      )}
                      onClick={() => setSeleccionadoId(tipo.id)}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={cx(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition',
                            seleccionadoId === tipo.id
                              ? 'bg-green-700 text-white'
                              : 'bg-stone-100 text-stone-500'
                          )}
                          onClick={(event) => {
                            event.stopPropagation()
                            setSeleccionadoId(tipo.id)
                          }}
                          aria-label={`Seleccionar ${tipo.nombre}`}
                        >
                          <Layers className="h-4 w-4" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p
                              className={cx(
                                'truncate text-sm font-semibold',
                                seleccionadoId === tipo.id ? 'text-green-900' : 'text-stone-800'
                              )}
                            >
                              {tipo.nombre}
                            </p>
                            {!tipo.activo ? (
                              <span className="chip bg-stone-200 text-stone-600">Inactivo</span>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-stone-500">
                            {tipo.campos.length} campo{tipo.campos.length === 1 ? '' : 's'}
                          </p>
                        </div>
                        <ChevronRight
                          className={cx(
                            'h-4 w-4 shrink-0',
                            seleccionadoId === tipo.id ? 'text-green-700' : 'text-stone-300'
                          )}
                        />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-stone-400 transition hover:bg-white hover:text-stone-700 disabled:opacity-30"
                          onClick={(event) => {
                            event.stopPropagation()
                            void moverTipo(tipo, -1)
                          }}
                          disabled={index === 0}
                          aria-label="Subir tipo"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-stone-400 transition hover:bg-white hover:text-stone-700 disabled:opacity-30"
                          onClick={(event) => {
                            event.stopPropagation()
                            void moverTipo(tipo, 1)
                          }}
                          disabled={index === tipos.length - 1}
                          aria-label="Bajar tipo"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <span className="mx-0.5 h-4 w-px bg-stone-200" />
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-stone-400 transition hover:bg-white hover:text-stone-700"
                          onClick={(event) => {
                            event.stopPropagation()
                            abrirEdicionTipo(tipo)
                          }}
                          aria-label="Cambiar nombre"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-stone-400 transition hover:bg-white hover:text-stone-700"
                          onClick={(event) => {
                            event.stopPropagation()
                            void alternarActivo(tipo)
                          }}
                          aria-label={tipo.activo ? 'Desactivar tipo' : 'Activar tipo'}
                          title={tipo.activo ? 'Desactivar' : 'Activar'}
                        >
                          {tipo.activo ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                          onClick={(event) => {
                            event.stopPropagation()
                            setConfirmar({ tipo: 'muestra', id: tipo.id, nombre: tipo.nombre })
                          }}
                          aria-label="Eliminar tipo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card min-h-[340px]">
            {!seleccionado ? (
              <div className="p-5">
                <EmptyState
                  icon={<Sparkles className="h-6 w-6" />}
                  title="Selecciona un tipo"
                  detail="Aquí podrás agregar, editar y reordenar sus campos."
                />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-4 py-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-stone-900">{seleccionado.nombre}</h2>
                      <span
                        className={cx(
                          'chip',
                          seleccionado.activo
                            ? 'bg-green-100 text-green-800'
                            : 'bg-stone-200 text-stone-600'
                        )}
                      >
                        {seleccionado.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {seleccionado.campos.length} campo
                      {seleccionado.campos.length === 1 ? '' : 's'} · se muestran en este orden
                    </p>
                    {!seleccionado.activo ? (
                      <p className="mt-1 text-xs text-amber-700">
                        Inactivo: no aparece al asignar ni al trabajador.
                      </p>
                    ) : null}
                  </div>
                  <button type="button" className="btn-primary" onClick={abrirCrearCampo}>
                    <Plus className="h-4 w-4" />
                    Agregar campo
                  </button>
                </div>

                <div className="p-4">
                  {seleccionado.campos.length === 0 ? (
                    <EmptyState
                      icon={<Sparkles className="h-6 w-6" />}
                      title="Este tipo no tiene campos"
                      detail="Agrega los datos que el trabajador debe registrar: profundidad, orientación, medida, etc."
                      action={
                        <button type="button" className="btn-primary" onClick={abrirCrearCampo}>
                          <Plus className="h-4 w-4" />
                          Agregar primer campo
                        </button>
                      }
                    />
                  ) : (
                    <ul className="space-y-2">
                      {seleccionado.campos.map((campo, index) => (
                        <li
                          key={campo.id}
                          className="flex flex-wrap items-start gap-2 rounded-xl border border-stone-200 bg-white p-3"
                        >
                          <div className="flex shrink-0 flex-col gap-0.5">
                            <button
                              type="button"
                              className="rounded p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-25"
                              onClick={() => void moverCampo(campo, -1)}
                              disabled={index === 0}
                              aria-label="Subir campo"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="rounded p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-25"
                              onClick={() => void moverCampo(campo, 1)}
                              disabled={index === seleccionado.campos.length - 1}
                              aria-label="Bajar campo"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-sm font-semibold text-stone-800">
                                {campo.nombre_campo}
                              </p>
                              {campo.requerido ? (
                                <span className="chip bg-amber-50 text-amber-700">Requerido</span>
                              ) : null}
                              <span className="chip bg-stone-100 text-stone-600">
                                {TIPO_DATO_LABEL[campo.tipo_dato]}
                              </span>
                            </div>
                            {campo.opciones?.length ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {campo.opciones.map((opcion) => (
                                  <span
                                    key={opcion}
                                    className="rounded-md bg-stone-50 px-1.5 py-0.5 text-[11px] text-stone-500"
                                  >
                                    {opcion}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-0.5 text-[11px] text-stone-400">
                                {campo.tipo_dato === 'numero'
                                  ? 'El trabajador escribe un número.'
                                  : 'El trabajador escribe texto libre.'}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                              onClick={() => abrirEditarCampo(campo)}
                              aria-label={`Editar ${campo.nombre_campo}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                              onClick={() =>
                                setConfirmar({
                                  tipo: 'campo',
                                  id: campo.id,
                                  nombre: campo.nombre_campo,
                                })
                              }
                              aria-label={`Eliminar ${campo.nombre_campo}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-4 flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2.5 text-xs leading-relaxed text-sky-800">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Los campos son dinámicos. Puedes cambiar opciones, agregar campos nuevos o
                      reordenarlos en cualquier momento; los valores ya registrados se conservan.
                    </span>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      <Modal
        open={Boolean(editandoTipo)}
        onClose={() => {
          if (!guardandoTipo) setEditandoTipo(null)
        }}
        title="Renombrar tipo"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setEditandoTipo(null)}
              disabled={guardandoTipo}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="tipo-edit-form"
              className="btn-primary flex-1"
              disabled={guardandoTipo || !nombreTipoEdicion.trim()}
            >
              {guardandoTipo ? <Spinner /> : null}
              Guardar
            </button>
          </div>
        }
      >
        <form id="tipo-edit-form" onSubmit={guardarTipo} className="space-y-4">
          <div>
            <label htmlFor="tipo-nombre" className="label">
              Nombre del tipo
            </label>
            <input
              id="tipo-nombre"
              className="input"
              value={nombreTipoEdicion}
              onChange={(event) => setNombreTipoEdicion(event.target.value)}
              autoFocus
            />
          </div>
          {errorTipo ? <Alert tone="error">{errorTipo}</Alert> : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(modalCampo)}
        onClose={() => {
          if (!guardandoCampo) setModalCampo(null)
        }}
        title={modalCampo?.modo === 'crear' ? 'Agregar campo' : 'Editar campo'}
        subtitle={
          seleccionado
            ? `Tipo: ${seleccionado.nombre}. Se mostrará en el orden configurado.`
            : undefined
        }
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setModalCampo(null)}
              disabled={guardandoCampo}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="campo-form"
              className="btn-primary flex-1"
              disabled={guardandoCampo}
            >
              {guardandoCampo ? <Spinner /> : null}
              {modalCampo?.modo === 'crear' ? 'Agregar campo' : 'Guardar cambios'}
            </button>
          </div>
        }
      >
        <form id="campo-form" onSubmit={guardarCampo} className="space-y-4">
          <div>
            <label htmlFor="campo-nombre" className="label">
              Nombre del campo
            </label>
            <input
              id="campo-nombre"
              className="input"
              placeholder="Ej. Profundidad, Orientación, Medida"
              value={formCampo.nombre_campo}
              onChange={(event) =>
                setFormCampo((prev) => ({ ...prev, nombre_campo: event.target.value }))
              }
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="campo-tipo" className="label">
              Tipo de dato
            </label>
            <select
              id="campo-tipo"
              className="input"
              value={formCampo.tipo_dato}
              onChange={(event) =>
                setFormCampo((prev) => ({
                  ...prev,
                  tipo_dato: event.target.value as TipoDato,
                }))
              }
            >
              <option value="texto">Texto libre</option>
              <option value="numero">Número</option>
              <option value="seleccion">Selección (una opción)</option>
              <option value="rango">Rango (una opción de medidas)</option>
            </select>
          </div>

          {formCampo.tipo_dato === 'seleccion' || formCampo.tipo_dato === 'rango' ? (
            <div>
              <label htmlFor="campo-opciones" className="label">
                Opciones
              </label>
              <textarea
                id="campo-opciones"
                className="input min-h-[90px] resize-y"
                placeholder={'Ej. 8 pies, 12 pies\nO también: 1-3 pies, 1-5 pies'}
                value={formCampo.opciones}
                onChange={(event) =>
                  setFormCampo((prev) => ({ ...prev, opciones: event.target.value }))
                }
              />
              <p className="mt-1 text-xs text-stone-500">
                Separa las opciones con comas o saltos de línea. El trabajador elegirá una.
              </p>
            </div>
          ) : null}

          <label className="flex items-start gap-2.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-green-700 focus:ring-green-600"
              checked={formCampo.requerido}
              onChange={(event) =>
                setFormCampo((prev) => ({ ...prev, requerido: event.target.checked }))
              }
            />
            <span className="text-sm">
              <span className="font-semibold text-stone-800">Campo requerido</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-stone-500">
                Se marca con * en la app. No bloquea el marcado rápido del trabajador.
              </span>
            </span>
          </label>

          {errorCampo ? <Alert tone="error">{errorCampo}</Alert> : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmar)}
        onClose={() => {
          if (!eliminando) setConfirmar(null)
        }}
        onConfirm={() => void eliminar()}
        title={confirmar?.tipo === 'muestra' ? 'Eliminar tipo' : 'Eliminar campo'}
        confirmLabel={eliminando ? 'Eliminando…' : 'Eliminar'}
        busy={eliminando}
      >
        {confirmar?.tipo === 'muestra' ? (
          <p>
            ¿Eliminar el tipo <strong>{confirmar.nombre}</strong> y todos sus campos? Solo es
            posible si no tiene muestras asignadas. Si ya se usó, desactívalo para conservarlo.
          </p>
        ) : confirmar ? (
          <p>
            ¿Eliminar el campo <strong>{confirmar.nombre}</strong>? También se borrarán los valores
            ya guardados de este campo en todas las muestras.
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}
