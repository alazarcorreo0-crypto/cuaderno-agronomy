import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Usuario } from '../types'
import {
  ApiError,
  api,
  getAuthToken,
  getCachedUser,
  saveCachedUser,
  setAuthToken,
} from '../lib/api'

interface AuthContextValue {
  usuario: Usuario | null
  token: string | null
  cargando: boolean
  ingresar: (nombre: string, pin: string) => Promise<Usuario>
  salir: () => void
  actualizarUsuario: (usuario: Usuario) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialToken = getAuthToken()
  const initialUser = initialToken ? getCachedUser() : null

  const [usuario, setUsuario] = useState<Usuario | null>(initialUser)
  const [token, setToken] = useState<string | null>(initialToken)
  const [cargando, setCargando] = useState(!initialUser && Boolean(initialToken))

  const limpiarSesion = useCallback(() => {
    setAuthToken(null)
    saveCachedUser(null)
    setToken(null)
    setUsuario(null)
  }, [])

  useEffect(() => {
    if (!initialToken) return
    let cancelled = false

    api.auth
      .me()
      .then(({ usuario: actual }) => {
        if (cancelled) return
        setUsuario(actual)
        saveCachedUser(actual)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 401) limpiarSesion()
        // Sin red: se conserva la sesión y la lista local para trabajar offline.
      })
      .finally(() => {
        if (!cancelled) setCargando(false)
      })

    return () => {
      cancelled = true
    }
  }, [initialToken, limpiarSesion])

  const ingresar = useCallback(async (nombre: string, pin: string) => {
    const resultado = await api.auth.login(nombre.trim(), pin)
    setAuthToken(resultado.token)
    saveCachedUser(resultado.usuario)
    setToken(resultado.token)
    setUsuario(resultado.usuario)
    return resultado.usuario
  }, [])

  const actualizarUsuario = useCallback((actualizado: Usuario) => {
    saveCachedUser(actualizado)
    setUsuario(actualizado)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      usuario,
      token,
      cargando,
      ingresar,
      salir: limpiarSesion,
      actualizarUsuario,
    }),
    [usuario, token, cargando, ingresar, limpiarSesion, actualizarUsuario]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
