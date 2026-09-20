import { DesktopOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons'
import {
  App as AntdApp,
  Avatar,
  Card,
  Col,
  Descriptions,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import { useEffect, useState } from 'react'
import * as api from '../api'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { userStatusMeta } from '../utils/status'

export default function Overview() {
  const { user, isAdmin } = useAuth()
  const { message } = AntdApp.useApp()
  const [deviceCount, setDeviceCount] = useState<number | null>(null)
  const [userCount, setUserCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .fetchDevices()
      .then((devices) => {
        if (!cancelled) {
          setDeviceCount(devices.length)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          message.error(getErrorMessage(error))
        }
      })
    return () => {
      cancelled = true
    }
  }, [message])

  useEffect(() => {
    if (!isAdmin) {
      return
    }
    let cancelled = false
    api
      .fetchUsers()
      .then((users) => {
        if (!cancelled) {
          setUserCount(users.length)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          message.error(getErrorMessage(error))
        }
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin, message])

  const statusMeta = userStatusMeta(user?.status)

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Row gutter={16}>
        <Col xs={24} sm={12} lg={8}>
          <Card bordered={false}>
            <Statistic
              title="设备总数"
              value={deviceCount ?? 0}
              prefix={<DesktopOutlined />}
              loading={deviceCount === null}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card bordered={false}>
            <Statistic
              title="用户总数"
              value={isAdmin ? userCount ?? 0 : '-'}
              prefix={<TeamOutlined />}
              loading={isAdmin && userCount === null}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card bordered={false}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar size={48} src={user?.avatar || undefined} icon={<UserOutlined />} />
              <div>
                <Typography.Text type="secondary">当前登录用户</Typography.Text>
                <div>
                  <Typography.Text strong style={{ fontSize: 18 }}>
                    {user?.display_name || user?.name || '-'}
                  </Typography.Text>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="当前用户信息" bordered={false}>
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="用户名">{user?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="显示名">
            {user?.display_name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="邮箱">{user?.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusMeta.color}>{statusMeta.text}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="管理员">
            {user?.is_admin ? <Tag color="blue">是</Tag> : <Tag>否</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="备注">{user?.note || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  )
}
