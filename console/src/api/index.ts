import { http } from './client'
import type {
  AuditRecord,
  CreateUserPayload,
  Device,
  LoginResponse,
  Setting,
  TwoFactorSetup,
  TwoFactorStatus,
  UpdateDevicePayload,
  UpdateUserPayload,
  UserPayload,
} from './types'

function enc(value: string | number): string {
  return encodeURIComponent(String(value))
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const { data } = await http.post<LoginResponse>('/login', {
    username,
    password,
  })
  return data
}

export async function loginWithTfa(
  username: string,
  tfaCode: string,
): Promise<LoginResponse> {
  const { data } = await http.post<LoginResponse>('/login', {
    type: 'email_code',
    username,
    tfaCode,
    id: '',
    uuid: '',
    autoLogin: true,
  })
  return data
}

export async function logout(): Promise<void> {
  await http.post('/logout')
}

export async function fetchCurrentUser(): Promise<UserPayload> {
  const { data } = await http.post<UserPayload>('/currentUser')
  return data
}

export async function fetchUsers(): Promise<UserPayload[]> {
  const { data } = await http.get<UserPayload[]>('/users')
  return data
}

export async function createUser(
  payload: CreateUserPayload,
): Promise<{ id: number | string }> {
  const { data } = await http.post<{ id: number | string }>('/users', payload)
  return data
}

export async function updateUser(
  id: string | number,
  payload: UpdateUserPayload,
): Promise<void> {
  await http.post(`/users/${enc(id)}`, payload)
}

export async function deleteUser(id: string | number): Promise<void> {
  await http.delete(`/users/${enc(id)}`)
}

export async function fetchDevices(): Promise<Device[]> {
  const { data } = await http.get<Device[]>('/devices')
  return data
}

export async function updateDevice(
  id: string | number,
  payload: UpdateDevicePayload,
): Promise<void> {
  await http.post(`/devices/${enc(id)}`, payload)
}

export async function deleteDevice(id: string | number): Promise<void> {
  await http.delete(`/devices/${enc(id)}`)
}

export async function fetchSettings(): Promise<Setting[]> {
  const { data } = await http.get<Setting[]>('/settings')
  return data
}

export async function saveSetting(
  key: string,
  value: string,
): Promise<{ modified_at: number | string }> {
  const { data } = await http.post<{ modified_at: number | string }>(
    '/settings',
    { key, value },
  )
  return data
}

export async function deleteSetting(key: string): Promise<void> {
  await http.delete(`/settings/${enc(key)}`)
}

export async function fetchAudit(
  type?: string,
  limit = 200,
): Promise<AuditRecord[]> {
  const path = type
    ? `/audit/${enc(type)}?limit=${limit}`
    : `/audit?limit=${limit}`
  const { data } = await http.get<AuditRecord[]>(path)
  return data
}

export async function fetchTwoFactorStatus(): Promise<TwoFactorStatus> {
  const { data } = await http.get<TwoFactorStatus>('/me/2fa')
  return data
}

export async function setupTwoFactor(): Promise<TwoFactorSetup> {
  const { data } = await http.post<TwoFactorSetup>('/me/2fa/setup')
  return data
}

export async function enableTwoFactor(
  secret: string,
  code: string,
): Promise<TwoFactorStatus> {
  const { data } = await http.post<TwoFactorStatus>('/me/2fa/enable', {
    secret,
    code,
  })
  return data
}

export async function disableTwoFactor(): Promise<TwoFactorStatus> {
  const { data } = await http.post<TwoFactorStatus>('/me/2fa/disable')
  return data
}
