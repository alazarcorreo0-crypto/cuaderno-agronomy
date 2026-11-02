import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { KeyRound, Pencil, Plus, ShieldCheck, UserCheck, UserRound, UserX } from 'lucide-react'
import { api } from '../../lib/api'
import { cx } from '../../lib/utils'
import type { Rol, Usuario } from '../../types'
import { useAuth } from '../../context/AuthContext'
import {
  Alert,
  ConfirmDialog,
  LoadingBlock,
  Modal,
  PageHeader,
  Spinner,
} from '../../components/ui'

type ModalState =
  | { modo: 'crear' }
  | { modo: 'editar'; usuario: Usuario }
  | { modo: 'pin'; usuario: Usuario }
  | null

export default function Usuarios() {
  const { usuario: sesion, actualizarUsuario } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [formError, setFormError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<Rol>('trabajador')
  const [pin, setPin] = useState('')
  const [activo, setActivo] = useState(true)

  const [cambioEstado, setCambioEstado] = useState<{ usuario: Usuario; activo: boolean } | null>(
    null
  )
  const [procesandoEstado, setProcesandoEstado] = useState(false)

  const cargar = useCallback(async () => {
    setError('')
    try {
      const resultado = await api.usuarios.list()
      setUsuarios(resultado.usuarios)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los usuarios.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  function abrirCrear() {
    setNombre('')
    setRol('trabajador')
    setPin('')
    setActivo(true)
    setFormError('')
    setAviso('')
    setModal({ modo: 'crear' })
  }

  function abrirEditar(usuario: Usuario) {
    setNombre(usuario.nombre)
    setRol(usuario.rol)
    setPin('')
    setActivo(usuario.activo)
    setFormError('')
    setAviso('')
    setModal({ modo: 'editar', usuario })
  }

  function abrirPin(usuario: Usuario) {
    setPin('')
    setFormError('')
    setAviso('')
    setModal({ modo: 'pin', usuario })
  }

  async function guardar(event: FormEvent) {
    event.preventDefault()
    if (!modal) return
    setFormError('')

    if (modal.modo !== 'pin' && nombre.trim().length < 2) {
      setFormError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    if ((modal.modo === 'crear' || modal.modo === 'pin') && pin.trim().length < 4) {
      setFormError('El PIN o contraseña debe tener al menos 4 caracteres.')
      return
    }
    if (modal.modo === 'editar' && pin.trim().length > 0 && pin.trim().length < 4) {
      setFormError('El nuevo PIN debe tener al menos 4 caracteres.')
      return
    }

    setGuardando(true)
    try {
      if (modal.modo === 'crear') {
        const resultado = await api.usuarios.create({
          nombre: nombre.trim(),
          rol,
          pin: pin.trim(),
        })
        setAviso(`Usuario "${resultado.usuario.nombre}" creado. Comparte su PIN con la persona.`)
        setModal(null)
      } else if (modal.modo === 'editar') {
        const resultado = await api.usuarios.update(modal.usuario.id, {
          nombre: nombre.trim(),
          rol,
          activo,
          ...(pin.trim() ? { pin: pin.trim() } : {}),
        })
        if (resultado.usuario.id === sesion?.id) actualizarUsuario(resultado.usuario)
        setAviso(
          pin.trim()
            ? 'Usuario y PIN actualizados. Comparte el nuevo PIN con la persona.'
            : 'Usuario actualizado.'
        )
        setModal(null)
      } else {
        await api.usuarios.update(modal.usuario.id, { pin: pin.trim() })
        setAviso(`PIN de "${modal.usuario.nombre}" restablecido. Comparte el nuevo PIN.`)
        setModal(null)
      }
      await cargar()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el usuario.')
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarCambioEstado() {
    if (!cambioEstado) return
    setProcesandoEstado(true)
    try {
      await api.usuarios.update(cambioEstado.usuario.id, { activo: cambioEstado.activo })
      setAviso(
        cambioEstado.activo
          ? `"${cambioEstado.usuario.nombre}" fue activado. Ya puede iniciar sesión.`
          : `"${cambioEstado.usuario.nombre}" fue desactivado. Su historial se conserva.`
      )
      setCambioEstado(null)
      await cargar()
    } catch (err) {
      setAviso('')
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.')
    } finally {
      setProcesandoEstado(false)
    }
  }

  const esPropio = modal && modal.modo !== 'crear' ? modal.usuario.id === sesion?.id : false

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle="Crea supervisores y trabajadores, restablece PIN y activa o desactiva cuentas."
        action={
          <button type="button" className="btn-primary" onClick={abrirCrear}>
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </button>
        }
      />

      <div className="mb-4">
        <Alert tone="info">
          Un usuario desactivado no puede iniciar sesión, pero todo su historial de muestras y
          envíos se conserva.
        </Alert>
      </div>

      {error ? (
        <div className="mb-4">
          <Alert tone="error" onClose={() => setError('')}>
            {error}
          </Alert>
        </div>
      ) : null}
      {aviso ? (
        <div className="mb-4">
          <Alert tone="success" onClose={() => setAviso('')}>
            {aviso}
          </Alert>
        </div>
      ) : null}

      {cargando ? (
        <LoadingBlock label="Cargando usuarios…" />
      ) : (
        <div className="space-y-2.5">
          {usuarios.map((usuario) => {
            const propio = usuario.id === sesion?.id
            return (
              <div key={usuario.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    className={cx(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-bold',
                      usuario.rol === 'supervisor'
                        ? 'bg-green-700 text-white'
                        : 'bg-green-50 text-green-800'
                    )}
                  >
                    {usuario.nombre.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-bold text-stone-900">{usuario.nombre}</p>
                      {propio ? <span className="chip bg-stone-100 text-stone-500">Tú</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cx(
                          'chip',
                          usuario.rol === 'supervisor'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-stone-100 text-stone-600'
                        )}
                      >
                        {usuario.rol === 'supervisor' ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : (
                          <UserRound className="h-3 w-3" />
                        )}
                        {usuario.rol === 'supervisor' ? 'Supervisor' : 'Trabajador'}
                      </span>
                      <span
                        className={cx(
                          'chip',
                          usuario.activo
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-600'
                        )}
                      >
                        {usuario.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>

                  <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
                    <button
                      type="button"
                      className="btn-secondary min-h-[38px] px-3 py-1.5 text-xs"
                      onClick={() => abrirEditar(usuario)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn-secondary min-h-[38px] px-3 py-1.5 text-xs"
                      onClick={() => abrirPin(usuario)}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      PIN
                    </button>
                    {!propio ? (
                      <button
                        type="button"
                        className={cx(
                          'min-h-[38px] px-3 py-1.5 text-xs',
                          usuario.activo ? 'btn-danger' : 'btn-primary'
                        )}
                        onClick={() =>
                          setCambioEstado({ usuario, activo: !usuario.activo })
                        }
                      >
                        {usuario.activo ? (
                          <UserX className="h-3.5 w-3.5" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                        {usuario.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={Boolean(modal)}
        onClose={() => {
          if (!guardando) setModal(null)
        }}
        title={
          modal?.modo === 'crear'
            ? 'Nuevo usuario'
            : modal?.modo === 'editar'
              ? 'Editar usuario'
              : 'Restablecer PIN'
        }
        subtitle={
          modal?.modo === 'pin'
            ? `Asigna un nuevo PIN a ${modal.usuario.nombre}.`
            : 'Los supervisores también pueden crear otros supervisores.'
        }
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setModal(null)}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="usuario-form"
              className="btn-primary flex-1"
              disabled={guardando}
            >
              {guardando ? <Spinner /> : null}
              {modal?.modo === 'crear'
                ? 'Crear usuario'
                : modal?.modo === 'pin'
                  ? 'Guardar PIN'
                  : 'Guardar cambios'}
            </button>
          </div>
        }
      >
        <form id="usuario-form" onSubmit={guardar} className="space-y-4">
          {modal?.modo !== 'pin' ? (
            <>
              <div>
                <label htmlFor="usuario-nombre" className="label">
                  Nombre
                </label>
                <input
                  id="usuario-nombre"
                  className="input"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  placeholder="Ej. Juan Pérez"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="usuario-rol" className="label">
                  Rol
                </label>
                <select
                  id="usuario-rol"
                  className="input"
                  value={rol}
                  onChange={(event) => setRol(event.target.value as Rol)}
                  disabled={Boolean(esPropio)}
                >
                  <option value="trabajador">Trabajador</option>
                  <option value="supervisor">Supervisor</option>
                </select>
                {esPropio ? (
                  <p className="mt-1 text-xs text-stone-500">
                    No puedes cambiar tu propio rol ni desactivar tu cuenta.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          <div>
            <label htmlFor="usuario-pin" className="label">
              {modal?.modo === 'crear'
                ? 'PIN o contraseña inicial'
                : modal?.modo === 'pin'
                  ? 'Nuevo PIN o contraseña'
                  : 'Nuevo PIN (opcional)'}
            </label>
            <input
              id="usuario-pin"
              type="text"
              className="input tracking-[0.2em]"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder={
                modal?.modo === 'editar' ? 'Dejar en blanco para conservar el actual' : 'Mínimo 4 caracteres'
              }
              autoComplete="off"
              autoFocus={modal?.modo === 'pin'}
            />
            <p className="mt-1 text-xs text-stone-500">
              Comparte el PIN directamente con la persona. No se puede consultar después.
            </p>
          </div>

          {modal?.modo === 'editar' ? (
            <label className="flex items-start gap-2.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-green-700 focus:ring-green-600"
                checked={activo}
                onChange={(event) => setActivo(event.target.checked)}
                disabled={Boolean(esPropio)}
              />
              <span className="text-sm">
                <span className="font-semibold text-stone-800">Cuenta activa</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-stone-500">
                  Si la desactivas, no podrá iniciar sesión, pero su historial se conserva.
                </span>
              </span>
            </label>
          ) : null}

          {formError ? <Alert tone="error">{formError}</Alert> : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(cambioEstado)}
        onClose={() => {
          if (!procesandoEstado) setCambioEstado(null)
        }}
        onConfirm={() => void confirmarCambioEstado()}
        title={cambioEstado?.activo ? 'Activar usuario' : 'Desactivar usuario'}
        confirmLabel={cambioEstado?.activo ? 'Activar' : 'Desactivar'}
        tone={cambioEstado?.activo ? 'primary' : 'danger'}
        busy={procesandoEstado}
      >
        {cambioEstado ? (
          <p>
            ¿{cambioEstado.activo ? 'Activar' : 'Desactivar'} a{' '}
            <strong>{cambioEstado.usuario.nombre}</strong>?
            {cambioEstado.activo
              ? ' Podrá iniciar sesión de nuevo.'
              : ' No podrá iniciar sesión, pero todo su historial se conservará.'}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}
