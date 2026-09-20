import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  App as AntdApp,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd'
import type { TableProps } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import * as api from '../api'
import { getErrorMessage } from '../api/client'
import type { UserPayload } from '../api/types'
import { userStatusMeta } from '../utils/status'

interface UserFormValues {
  name?: string
  password?: string
  display_name?: string
  email?: string
  note?: string
  status?: number
  is_admin?: boolean
}

type ModalMode = 'create' | 'edit'

const statusOptions = [
  { value: 1, label: '正常' },
  { value: 0, label: '禁用' },
  { value: -1, label: '未验证' },
]

export default function Users() {
  const { message } = AntdApp.useApp()
  const [users, setUsers] = useState<UserPayload[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<ModalMode | null>(null)
  const [editing, setEditing] = useState<UserPayload | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<UserFormValues>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setUsers(await api.fetchUsers())
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setMode('create')
    form.resetFields()
    form.setFieldsValue({ is_admin: false })
  }

  const openEdit = (record: UserPayload) => {
    setEditing(record)
    setMode('edit')
    form.resetFields()
    form.setFieldsValue({
      name: record.name,
      display_name: record.display_name,
      email: record.email,
      note: record.note,
      status: record.status,
      is_admin: record.is_admin,
    })
  }

  const closeModal = () => {
    setMode(null)
    setEditing(null)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (mode === 'create') {
        await api.createUser({
          name: values.name ?? '',
          password: values.password ?? '',
          is_admin: values.is_admin === true,
        })
        message.success('用户已创建')
      } else if (editing) {
        await api.updateUser(editing.name, {
          display_name: values.display_name,
          email: values.email,
          note: values.note,
          status: values.status,
          is_admin: values.is_admin,
          password: values.password ? values.password : undefined,
        })
        message.success('用户已更新')
      }
      closeModal()
      await load()
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (record: UserPayload) => {
    try {
      await api.deleteUser(record.name)
      message.success('用户已删除')
      await load()
    } catch (error) {
      message.error(getErrorMessage(error))
    }
  }

  const columns: TableProps<UserPayload>['columns'] = [
    { title: '用户名', dataIndex: 'name', key: 'name', width: 160, fixed: 'left' },
    {
      title: '显示名',
      dataIndex: 'display_name',
      key: 'display_name',
      width: 160,
      render: (value: string) => value || '-',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 220,
      render: (value: string) => value || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: number) => {
        const meta = userStatusMeta(value)
        return <Tag color={meta.color}>{meta.text}</Tag>
      },
    },
    {
      title: '管理员',
      dataIndex: 'is_admin',
      key: 'is_admin',
      width: 100,
      render: (value: boolean) =>
        value ? <Tag color="blue">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="删除用户"
            description={`确认删除用户 ${record.name} 吗？`}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record)}
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="用户管理"
      bordered={false}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建用户
          </Button>
        </Space>
      }
    >
      <Table<UserPayload>
        rowKey="name"
        columns={columns}
        dataSource={users}
        loading={loading}
        scroll={{ x: 1000 }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 人` }}
      />

      <Modal
        title={mode === 'create' ? '新建用户' : `编辑用户 ${editing?.name ?? ''}`}
        open={mode !== null}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="用户名"
            name="name"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="登录用户名" disabled={mode === 'edit'} allowClear />
          </Form.Item>
          <Form.Item
            label={mode === 'create' ? '密码' : '密码（留空则不修改）'}
            name="password"
            rules={
              mode === 'create'
                ? [{ required: true, message: '请输入密码' }]
                : []
            }
          >
            <Input.Password placeholder="密码" autoComplete="new-password" />
          </Form.Item>
          {mode === 'edit' && (
            <>
              <Form.Item label="显示名" name="display_name">
                <Input placeholder="显示名" allowClear />
              </Form.Item>
              <Form.Item label="邮箱" name="email">
                <Input placeholder="邮箱" allowClear />
              </Form.Item>
              <Form.Item label="状态" name="status">
                <Select options={statusOptions} />
              </Form.Item>
              <Form.Item label="备注" name="note">
                <Input.TextArea rows={2} placeholder="备注" />
              </Form.Item>
            </>
          )}
          <Form.Item label="管理员" name="is_admin" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          {mode === 'edit' && editing && (
            <div style={{ color: '#999', fontSize: 12 }}>
              创建时间等信息由服务端维护。
            </div>
          )}
        </Form>
      </Modal>
    </Card>
  )
}
