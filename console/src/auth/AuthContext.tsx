import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import * as api from '../api'
import { clearToken, getToken, setToken } from '../api/client'
import type { LoginResponse, UserPayload } from '../api/types'

interface AuthContextValue {
  user: UserPayload | null
  loading: boolean
  isAdmin: boolean
  login: (username: string, password: string) => Promise<LoginResponse>
  loginWithTfa: (username: string, code: string) => Promise<LoginResponse>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!getToken()) {
      setLoading(false)
      return
    }
    api
      .fetchCurrentUser()
      .then((current) => {
        if (!cancelled) {
          setUser(current)
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearToken()
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const applyLoginResult = useCallback((data: LoginResponse) => {
    if (data.type === 'access_token') {
      setToken(data.access_token)
      setUser(data.user)
      return true
    }
    return false
  }, [])

  const login = useCallback(
    async (username: string, password: string) => {
      const data = await api.login(username, password)
      applyLoginResult(data)
      return data
    },
    [applyLoginResult],
  )

  const loginWithTfa = useCallback(
    async (username: string, code: string) => {
      const data = await api.loginWithTfa(username, code)
      applyLoginResult(data)
      return data
    },
    [applyLoginResult],
  )

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // 忽略登出接口异常，本地状态必须清理
    } finally {
      clearToken()
      setUser(null)
    }
  }, [])

  const refresh = useCallback(async () => {
    const current = await api.fetchCurrentUser()
    setUser(current)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.is_admin === true,
      login,
      loginWithTfa,
      logout,
      refresh,
    }),
    [user, loading, login, loginWithTfa, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内使用')
  }
  return context
}
