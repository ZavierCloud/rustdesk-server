import { ReloadOutlined } from '@ant-design/icons'
import {
  App as AntdApp,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
} from 'antd'
import type { TableProps } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import * as api from '../api'
import { getErrorMessage } from '../api/client'
import type { Device, UpdateDevicePayload } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { formatTime } from '../utils/format'
import { deviceStatusMeta } from '../utils/status'

export default function Devices() {
  const { isAdmin } = useAuth()
  const { message } = AntdApp.useApp()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Device | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<UpdateDevicePayload>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setDevices(await api.fetchDevices())
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (editing) {
      form.setFieldsValue({
        note: editing.note,
        device_group_name: editing.device_group_name,
        user_name: editing.user_name,
      })
    } else {
      form.resetFields()
    }
  }, [editing, form])

  const handleSave = async () => {
    if (!editing) {
      return
    }
    const values = await form.validateFields()
    setSaving(true)
    try {
      await api.updateDevice(editing.id, values)
      message.success('已保存')
      setEditing(null)
      await load()
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (record: Device) => {
    try {
      await api.deleteDevice(record.id)
      message.success('已删除')
      await load()
    } catch (error) {
      message.error(getErrorMessage(error))
    }
  }

  const columns: TableProps<Device>['columns'] = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 150, fixed: 'left' },
    {
      title: '主机名',
      key: 'hostname',
      width: 180,
      render: (_, record) => record.info?.hostname || '-',
    },
    {
      title: '用户名',
      key: 'username',
      width: 140,
      render: (_, record) => record.info?.username || '-',
    },
    {
      title: '平台',
      key: 'platform',
      width: 160,
      render: (_, record) => record.info?.os || record.info?.platform || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (_, record) => {
        const meta = deviceStatusMeta(record.status)
        return <Tag color={meta.color}>{meta.text}</Tag>
      },
    },
    {
      title: '分组',
      dataIndex: 'device_group_name',
      key: 'device_group_name',
      width: 140,
      render: (value: string) => value || '-',
    },
    {
      title: '绑定用户',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 140,
      render: (value: string) => value || '-',
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: '最后在线',
      dataIndex: 'last_seen',
      key: 'last_seen',
      width: 180,
      render: (value: Device['last_seen']) => formatTime(value),
    },
    {
      title: '操作',
      key: 'action',
      width: isAdmin ? 140 : 80,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => setEditing(record)}>
            编辑
          </Button>
          {isAdmin && (
            <Popconfirm
              title="删除设备"
              description={`确认删除设备 ${record.id} 吗？`}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(record)}
            >
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="设备列表"
      bordered={false}
      extra={
        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
          刷新
        </Button>
      }
    >
      <Table<Device>
        rowKey="id"
        columns={columns}
        dataSource={devices}
        loading={loading}
        scroll={{ x: 1400 }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 台` }}
      />

      <Modal
        title={editing ? `编辑设备 ${editing.id}` : '编辑设备'}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={() => void handleSave()}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item label="备注" name="note">
            <Input.TextArea rows={3} placeholder="设备备注" />
          </Form.Item>
          <Form.Item label="设备分组" name="device_group_name">
            <Input placeholder="设备分组名称" allowClear />
          </Form.Item>
          <Form.Item label="绑定用户" name="user_name">
            <Input placeholder="绑定用户名" allowClear />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
