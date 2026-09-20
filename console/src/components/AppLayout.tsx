import {
  AuditOutlined,
  DashboardOutlined,
  DesktopOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Dropdown, Layout, Menu, Space, Typography, theme } from 'antd'
import type { MenuProps } from 'antd'
import { useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const { Sider, Header, Content } = Layout

export default function AppLayout() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    token: { colorBgContainer, colorBorderSecondary },
  } = theme.useToken()

  const menuItems = useMemo<MenuProps['items']>(() => {
    const items: MenuProps['items'] = [
      { key: '/', icon: <DashboardOutlined />, label: '概览' },
      { key: '/devices', icon: <DesktopOutlined />, label: '设备' },
    ]
    if (isAdmin) {
      items.push(
        { key: '/users', icon: <TeamOutlined />, label: '用户管理' },
        { key: '/settings', icon: <SettingOutlined />, label: '策略设置' },
        { key: '/audit', icon: <AuditOutlined />, label: '审计日志' },
      )
    }
    items.push({
      key: '/profile',
      icon: <SafetyCertificateOutlined />,
      label: '个人 2FA',
    })
    return items
  }, [isAdmin])

  const selectedKey =
    menuItems
      ?.map((item) => (item ? String(item.key) : ''))
      .filter((key) => key && location.pathname === key)[0] ?? '/'

  const userMenu: MenuProps = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: '个人设置',
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        danger: true,
      },
    ],
    onClick: async ({ key }) => {
      if (key === 'logout') {
        await logout()
        navigate('/login', { replace: true })
      } else if (key === 'profile') {
        navigate('/profile')
      }
    },
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" breakpoint="lg" collapsedWidth={64} width={220}>
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 600,
            fontSize: 16,
            letterSpacing: 1,
          }}
        >
          RustDesk 控制台
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: colorBgContainer,
            borderBottom: `1px solid ${colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingInline: 24,
            height: 56,
            lineHeight: '56px',
          }}
        >
          <Dropdown menu={userMenu} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar
                size="small"
                src={user?.avatar || undefined}
                icon={<UserOutlined />}
              />
              <Typography.Text strong>
                {user?.display_name || user?.name}
              </Typography.Text>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
