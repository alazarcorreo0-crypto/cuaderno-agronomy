import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Hash,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react'
import { ApiError, api } from '../../lib/api'
import { todayLocal } from '../../lib/dates'
import { cx, parseNumeros } from '../../lib/utils'
import type { TipoMuestra, Usuario } from '../../types'
import { Alert, LoadingBlock, PageHeader, Spinner } from '../../components/ui'
import { CampoInputs } from '../../components/CampoInputs'

type Aviso =
  | { tone: 'success'; texto: string }
  | { tone: 'error'; texto: string; duplicados?: string[] }

export default function Asignar() {
  const [trabajadores, setTrabajadores] = useState<Usuario[]>([])
  const [tipos, setTipos] = useState<TipoMuestra[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [trabajadorId, setTrabajadorId] = useState<string>('')
  const [tipoId, setTipoId] = useState<string>('')
  const [fecha, setFecha] = useState(todayLocal())
  const [numerosTexto, setNumerosTexto] = useState('')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<Aviso | null>(null)

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setErrorCarga('')
      try {
        const [usuariosRes, tiposRes] = await Promise.all([
          api.usuarios.list(),
          api.tipos.list(),
        ])
        if (!activo) return
        setTrabajadores(
          usuariosRes.usuarios.filter((user) => user.rol === 'trabajador' && user.activo)
        )
        const activos = tiposRes.tipos.filter((tipo) => tipo.activo)
        setTipos(activos)
        if (activos.length === 1) setTipoId(activos[0].id)
      } catch (err) {
        if (activo) setErrorCarga(err instanceof Error ? err.message : 'No se pudieron cargar los datos.')
      } finally {
        if (activo) setCargando(false)
      }
    }
    void cargar()
    return () => {
      activo = false
    }
  }, [])

  const tipoSeleccionado = useMemo(
    () => tipos.find((tipo) => tipo.id === tipoId) ?? null,
    [tipos, tipoId]
  )
  const numeros = useMemo(() => parseNumeros(numerosTexto), [numerosTexto])
  const trabajadorSeleccionado = trabajadores.find((user) => user.id === trabajadorId)

  function cambiarTipo(valor: string) {
    setTipoId(valor)
    setValores({})
    setAviso(null)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setAviso(null)

    if (!trabajadorId) {
      setAviso({ tone: 'error', texto: 'Selecciona un trabajador.' })
      return
    }
    if (!tipoId) {
      setAviso({ tone: 'error', texto: 'Selecciona un tipo de muestra.' })
      return
    }
    if (!numeros.length) {
      setAviso({ tone: 'error', texto: 'Ingresa al menos un número de muestra.' })
      return
    }

    setEnviando(true)
    try {
      const resultado = await api.muestras.asignar({
        tipo_muestra_id: tipoId,
        asignado_a: trabajadorId,
        numeros,
        fecha,
        valores,
        comentario,
      })
      const cantidad = resultado.muestras.length
      setAviso({
        tone: 'success',
        texto: `${cantidad} muestra${cantidad === 1 ? '' : 's'} asignada${
          cantidad === 1 ? '' : 's'
        } a ${trabajadorSeleccionado?.nombre ?? 'el trabajador'}.`,
      })
      setNumerosTexto('')
      setValores({})
    } catch (err) {
      if (err instanceof ApiError) {
        setAviso({
          tone: 'error',
          texto: err.message,
          duplicados: err.duplicados,
        })
      } else {
        setAviso({ tone: 'error', texto: 'No se pudieron asignar las muestras.' })
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Asignar muestras"
        subtitle="Elige trabajador y tipo, escribe los números y asigna."
      />

      {errorCarga ? (
        <div className="mb-4">
          <Alert tone="error">{errorCarga}</Alert>
        </div>
      ) : null}

      {cargando ? (
        <LoadingBlock label="Cargando trabajadores y tipos…" />
      ) : (
        <div className="mx-auto max-w-3xl">
          {!trabajadores.length ? (
            <div className="mb-4">
              <Alert tone="warning">
                No hay trabajadores activos. <Link to="/supervisor/usuarios" className="font-semibold underline">Crea o activa un trabajador</Link> para poder asignar.
              </Alert>
            </div>
          ) : null}
          {!tipos.length ? (
            <div className="mb-4">
              <Alert tone="warning">
                No hay tipos de muestra activos. <Link to="/supervisor/tipos" className="font-semibold underline">Configura un tipo</Link> primero.
              </Alert>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="card p-4 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="trabajador" className="label">
                  Trabajador
                </label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                  <select
                    id="trabajador"
                    className="input appearance-none pl-11"
                    value={trabajadorId}
                    onChange={(event) => setTrabajadorId(event.target.value)}
                  >
                    <option value="">Seleccionar trabajador…</option>
                    {trabajadores.map((trabajador) => (
                      <option key={trabajador.id} value={trabajador.id}>
                        {trabajador.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="tipo" className="label">
                  Tipo de muestra
                </label>
                <div className="relative">
                  <ClipboardList className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                  <select
                    id="tipo"
                    className="input appearance-none pl-11"
                    value={tipoId}
                    onChange={(event) => cambiarTipo(event.target.value)}
                  >
                    <option value="">Seleccionar tipo…</option>
                    {tipos.map((tipo) => (
                      <option key={tipo.id} value={tipo.id}>
                        {tipo.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="fecha" className="label">
                Fecha de asignación
              </label>
              <div className="relative sm:max-w-[220px]">
                <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                <input
                  id="fecha"
                  type="date"
                  className="input pl-11"
                  value={fecha}
                  onChange={(event) => setFecha(event.target.value || todayLocal())}
                />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="numeros" className="label">
                Números de muestra
              </label>
              <div className="relative">
                <Hash className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-stone-400" />
                <textarea
                  id="numeros"
                  className="input min-h-[92px] resize-y pl-11"
                  rows={3}
                  placeholder={'731, 732, 733\nTambién puedes separarlos con espacios o saltos de línea.'}
                  value={numerosTexto}
                  onChange={(event) => setNumerosTexto(event.target.value)}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-stone-500">
                  {numeros.length} número{numeros.length === 1 ? '' : 's'} detectado
                  {numeros.length === 1 ? '' : 's'}
                </span>
                {numeros.slice(0, 12).map((numero) => (
                  <span key={numero} className="chip bg-stone-100 text-stone-600">
                    #{numero}
                  </span>
                ))}
                {numeros.length > 12 ? (
                  <span className="chip bg-stone-100 text-stone-500">
                    +{numeros.length - 12} más
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-4"><label htmlFor="nota-inicial" className="label">Comentario o nota inicial (opcional)</label><textarea id="nota-inicial" className="input min-h-20" maxLength={1000} value={comentario} onChange={e=>setComentario(e.target.value)} placeholder="Información útil para el trabajador" /></div>

            {tipoSeleccionado && tipoSeleccionado.campos.length > 0 ? (
              <details className="mt-4 rounded-xl border border-stone-200 bg-stone-50/60">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-stone-700 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-stone-400" />
                    Detalles iniciales (opcional)
                  </span>
                  <ChevronDown className="h-4 w-4 text-stone-400" />
                </summary>
                <div className="border-t border-stone-200 px-4 py-4">
                  <p className="mb-4 text-xs leading-relaxed text-stone-500">
                    Estos valores se aplicarán a todas las muestras de esta asignación. El
                    trabajador podrá ajustarlos después.
                  </p>
                  <CampoInputs
                    campos={tipoSeleccionado.campos}
                    valores={valores}
                    onChange={(campoId, valor) =>
                      setValores((prev) => ({ ...prev, [campoId]: valor }))
                    }
                    idPrefix="asignar"
                  />
                </div>
              </details>
            ) : null}

            {aviso ? (
              <div className="mt-4">
                <Alert tone={aviso.tone} onClose={() => setAviso(null)}>
                  <p>{aviso.texto}</p>
                  {'duplicados' in aviso && aviso.duplicados?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {aviso.duplicados.map((numero) => (
                        <span key={numero} className="chip bg-white text-red-700">
                          #{numero}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </Alert>
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Link
                to="/supervisor/reporte"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-stone-800"
              >
                Ver reporte maestro
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="submit"
                className={cx('btn-primary sm:min-w-[220px]', enviando && 'cursor-wait')}
                disabled={enviando || !trabajadores.length || !tipos.length}
              >
                {enviando ? <Spinner /> : <ClipboardList className="h-4 w-4" />}
                {enviando
                  ? 'Asignando…'
                  : numeros.length
                    ? `Asignar ${numeros.length} muestra${numeros.length === 1 ? '' : 's'}`
                    : 'Asignar muestras'}
              </button>
            </div>

            {!trabajadores.length || !tipos.length ? (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-stone-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Necesitas al menos un trabajador activo y un tipo activo para asignar.
              </p>
            ) : null}
          </form>
        </div>
      )}
    </div>
  )
}
