import type { TagProps } from 'antd'

export interface StatusMeta {
  color: TagProps['color']
  text: string
}

/** status 语义: 1=正常, 0=禁用, -1=未验证 */
export function userStatusMeta(status: number | undefined): StatusMeta {
  switch (status) {
    case 1:
      return { color: 'green', text: '正常' }
    case 0:
      return { color: 'red', text: '禁用' }
    case -1:
      return { color: 'orange', text: '未验证' }
    default:
      return { color: 'default', text: status === undefined ? '未知' : `未知(${status})` }
  }
}

/** 设备在线状态: 1=在线, 0=离线 */
export function deviceStatusMeta(status: number | undefined): StatusMeta {
  return status === 1
    ? { color: 'green', text: '在线' }
    : { color: 'default', text: '离线' }
}
