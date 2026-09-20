import { SafetyCertificateOutlined } from '@ant-design/icons'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import * as api from '../api'
import { getErrorMessage } from '../api/client'
import type { TwoFactorSetup } from '../api/types'
import { useAuth } from '../auth/AuthContext'

interface EnableForm {
  code: string
}

export default function Profile() {
  const { user } = useAuth()
  const { message } = AntdApp.useApp()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<EnableForm>()

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const status = await api.fetchTwoFactorStatus()
      setEnabled(status.enabled)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const handleSetup = async () => {
    setSubmitting(true)
    try {
      const data = await api.setupTwoFactor()
      setSetup(data)
      form.resetFields()
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleEnable = async (values: EnableForm) => {
    if (!setup) {
      return
    }
    setSubmitting(true)
    try {
      const status = await api.enableTwoFactor(setup.secret, values.code)
      setEnabled(status.enabled)
      setSetup(null)
      form.resetFields()
      message.success('已开启二次验证')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDisable = async () => {
    setSubmitting(true)
    try {
      const status = await api.disableTwoFactor()
      setEnabled(status.enabled)
      setSetup(null)
      message.success('已关闭二次验证')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Card title="账号信息" bordered={false}>
        <Descriptions column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="用户名">{user?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="显示名">
            {user?.display_name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="邮箱">{user?.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="管理员">
            {user?.is_admin ? <Tag color="blue">是</Tag> : <Tag>否</Tag>}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title={
          <Space>
            <SafetyCertificateOutlined />
            二次验证 (2FA)
          </Space>
        }
        bordered={false}
        extra={
          <Button onClick={() => void loadStatus()} loading={loading}>
            刷新状态
          </Button>
        }
      >
        {enabled === null ? (
          <Spin />
        ) : (
          <Space direction="vertical" size={16} style={{ display: 'flex' }}>
            <Space>
              <Typography.Text>当前状态：</Typography.Text>
              {enabled ? (
                <Tag color="green">已开启</Tag>
              ) : (
                <Tag color="default">未开启</Tag>
              )}
            </Space>

            {!enabled && !setup && (
              <div>
                <Button
                  type="primary"
                  onClick={() => void handleSetup()}
                  loading={submitting}
                >
                  开启二次验证
                </Button>
              </div>
            )}

            {!enabled && setup && (
              <Space direction="vertical" size={12} style={{ display: 'flex' }}>
                <Alert
                  type="info"
                  showIcon
                  message="请将以下密钥添加到认证器应用，或点击 otpauth 链接导入。"
                />
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="密钥 (secret)">
                    <Typography.Text code copyable>
                      {setup.secret}
                    </Typography.Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="otpauth URL">
                    <Typography.Paragraph
                      copyable={{ text: setup.otpauth_url }}
                      style={{ marginBottom: 0, wordBreak: 'break-all' }}
                    >
                      <a href={setup.otpauth_url}>{setup.otpauth_url}</a>
                    </Typography.Paragraph>
                  </Descriptions.Item>
                </Descriptions>
                <Form<EnableForm>
                  form={form}
                  layout="inline"
                  onFinish={handleEnable}
                  disabled={submitting}
                >
                  <Form.Item
                    name="code"
                    rules={[{ required: true, message: '请输入验证码' }]}
                  >
                    <Input placeholder="输入 6 位验证码" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item>
                    <Space>
                      <Button type="primary" htmlType="submit" loading={submitting}>
                        确认启用
                      </Button>
                      <Button
                        onClick={() => {
                          setSetup(null)
                          form.resetFields()
                        }}
                      >
                        取消
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>
              </Space>
            )}

            {enabled && (
              <div>
                <Popconfirm
                  title="关闭二次验证"
                  description="确认关闭吗？关闭后登录将不再需要邮箱验证码。"
                  okText="关闭"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => void handleDisable()}
                >
                  <Button danger loading={submitting}>
                    关闭二次验证
                  </Button>
                </Popconfirm>
              </div>
            )}
          </Space>
        )}
      </Card>
    </Space>
  )
}
