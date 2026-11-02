import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Loader2, LogIn, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Alert } from '../components/ui'
import { publicAsset } from '../lib/utils'

export default function Login() {
  const { usuario, ingresar } = useAuth()
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!usuario) return
    navigate(usuario.rol === 'supervisor' ? '/supervisor' : '/trabajador', { replace: true })
  }, [usuario, navigate])

  if (usuario) return null

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!nombre.trim() || !pin.trim()) {
      setError('Escribe tu nombre y tu PIN.')
      return
    }
    setEnviando(true)
    try {
      const actual = await ingresar(nombre, pin)
      navigate(actual.rol === 'supervisor' ? '/supervisor' : '/trabajador', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-stone-100">
      <div className="relative overflow-hidden bg-gradient-to-b from-green-800 to-green-900 px-6 pb-20 pt-safe">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-white/5" />
        <div className="mx-auto flex max-w-md flex-col items-center pt-12 text-center">
          <img
            src={publicAsset('icons/icon-192.png')}
            alt=""
            className="h-20 w-20 rounded-2xl shadow-lg"
          />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">Cuaderno de Campo</h1>
          <p className="mt-1 text-sm text-green-100">Muestras claras, un solo listado.</p>
        </div>
      </div>

      <div className="mx-auto -mt-12 w-full max-w-md flex-1 px-4 pb-10">
        <form onSubmit={onSubmit} className="card p-6">
          <h2 className="text-lg font-bold text-stone-900">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-stone-500">
            Usa el nombre y el PIN que te dio el supervisor.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="nombre" className="label">
                Nombre
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                <input
                  id="nombre"
                  name="nombre"
                  className="input pl-11"
                  autoComplete="username"
                  autoCapitalize="words"
                  placeholder="Ej. Juan Pérez"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label htmlFor="pin" className="label">
                PIN o contraseña
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                <input
                  id="pin"
                  name="pin"
                  type="password"
                  className="input pl-11 tracking-[0.3em]"
                  autoComplete="current-password"
                  placeholder="••••"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                />
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-4">
              <Alert tone="error">{error}</Alert>
            </div>
          ) : null}

          <button type="submit" className="btn-primary mt-6 w-full py-3.5 text-base" disabled={enviando}>
            {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs leading-relaxed text-stone-500">
          ¿Olvidaste tu PIN? Pídele al supervisor que lo restablezca.
        </p>
      </div>
    </div>
  )
}
