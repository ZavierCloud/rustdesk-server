import { LockOutlined, SafetyOutlined, UserOutlined } from '@ant-design/icons'
import { App as AntdApp, Button, Card, Form, Input, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'

interface Credentials {
  username: string
  password: string
}

interface TfaValues {
  code: string
}

export default function Login() {
  const { user, login, loginWithTfa } = useAuth()
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()
  const [loading, setLoading] = useState(false)
  const [tfaUsername, setTfaUsername] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  const handleLogin = async (values: Credentials) => {
    setLoading(true)
    try {
      const data = await login(values.username, values.password)
      if (data.type === 'access_token') {
        message.success('登录成功')
        navigate('/', { replace: true })
      } else {
        setTfaUsername(values.username)
        message.info('该账号已开启二次验证，请输入邮箱收到的验证码')
      }
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleTfa = async (values: TfaValues) => {
    if (!tfaUsername) {
      return
    }
    setLoading(true)
    try {
      const data = await loginWithTfa(tfaUsername, values.code)
      if (data.type === 'access_token') {
        message.success('登录成功')
        navigate('/', { replace: true })
      } else {
        message.error('验证未通过，请重试')
      }
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
        padding: 16,
      }}
    >
      <Card style={{ width: 380 }} bordered={false}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Typography.Title level={3} style={{ marginBottom: 4 }}>
            RustDesk 控制台
          </Typography.Title>
          <Typography.Text type="secondary">
            {tfaUsername ? '二次验证' : '请登录以继续'}
          </Typography.Text>
        </div>

        {tfaUsername ? (
          <Form<TfaValues> layout="vertical" onFinish={handleTfa} disabled={loading}>
            <Form.Item
              label={`验证码（${tfaUsername}）`}
              name="code"
              rules={[{ required: true, message: '请输入验证码' }]}
            >
              <Input
                prefix={<SafetyOutlined />}
                placeholder="6 位邮箱验证码"
                autoFocus
                allowClear
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 8 }}>
              <Button type="primary" htmlType="submit" block loading={loading}>
                验证并登录
              </Button>
            </Form.Item>
            <Button
              type="link"
              block
              disabled={loading}
              onClick={() => setTfaUsername(null)}
            >
              返回重新输入账号
            </Button>
          </Form>
        ) : (
          <Form<Credentials> layout="vertical" onFinish={handleLogin} disabled={loading}>
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="用户名" autoFocus allowClear />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block loading={loading}>
                登录
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  )
}
