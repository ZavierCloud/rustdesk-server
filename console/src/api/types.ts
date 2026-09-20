export interface UserPayload {
  name: string
  display_name: string
  avatar: string
  email: string
  note: string
  /** 1=正常, 0=禁用, -1=未验证 */
  status: number
  is_admin: boolean
}

export interface LoginAccessTokenResponse {
  type: 'access_token'
  access_token: string
  user: UserPayload
}

export interface LoginEmailCheckResponse {
  type: 'email_check'
  tfa_type: string
  secret: string
  user: UserPayload
}

export type LoginResponse = LoginAccessTokenResponse | LoginEmailCheckResponse

export interface DeviceInfo {
  hostname?: string
  username?: string
  os?: string
  platform?: string
  version?: string
  [key: string]: unknown
}

export interface Device {
  id: string
  info: DeviceInfo
  status: number
  note: string
  user_name: string
  device_group_name: string
  created_at: number | string
  last_seen: number | string
}

export interface Setting {
  key: string
  value: string
  modified_at: number | string
}

export interface AuditRecord {
  id: number | string
  type: string
  user_id: string
  device_id: string
  peer_id: string
  ip: string
  detail: string
  created_at: number | string
}

export interface TwoFactorStatus {
  enabled: boolean
}

export interface TwoFactorSetup {
  secret: string
  otpauth_url: string
}

export interface CreateUserPayload {
  name: string
  password: string
  is_admin: boolean
}

export interface UpdateUserPayload {
  display_name?: string
  email?: string
  note?: string
  status?: number
  is_admin?: boolean
  password?: string
}

export interface UpdateDevicePayload {
  note?: string
  device_group_name?: string
  user_name?: string
}
