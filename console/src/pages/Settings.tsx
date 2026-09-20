import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
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
  Typography,
} from 'antd'
import type { TableProps } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import * as api from '../api'
import { getErrorMessage } from '../api/client'
import type { Setting } from '../api/types'
import { formatTime } from '../utils/format'

interface SettingFormValues {
  key: string
  value: string
}

type ModalMode = 'create' | 'edit'

export default function Settings() {
  const { message } = AntdApp.useApp()
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<ModalMode | null>(null)
  const [editing, setEditing] = useState<Setting | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<SettingFormValues>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSettings(await api.fetchSettings())
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
  }

  const openEdit = (record: Setting) => {
    setEditing(record)
    setMode('edit')
    form.resetFields()
    form.setFieldsValue({ key: record.key, value: record.value })
  }

  const closeModal = () => {
    setMode(null)
    setEditing(null)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await api.saveSetting(values.key, values.value)
      message.success('已保存')
      closeModal()
      await load()
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (record: Setting) => {
    try {
      await api.deleteSetting(record.key)
      message.success('已删除')
      await load()
    } catch (error) {
      message.error(getErrorMessage(error))
    }
  }

  const columns: TableProps<Setting>['columns'] = [
    {
      title: '键 (key)',
      dataIndex: 'key',
      key: 'key',
      width: 320,
      fixed: 'left',
      render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
    },
    {
      title: '值 (value)',
      dataIndex: 'value',
      key: 'value',
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: '修改时间',
      dataIndex: 'modified_at',
      key: 'modified_at',
      width: 190,
      render: (value: Setting['modified_at']) => formatTime(value),
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
            title="删除设置"
            description={`确认删除 ${record.key} 吗？`}
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
      title="策略设置"
      bordered={false}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增设置
          </Button>
        </Space>
      }
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        key 为客户端选项键，value 为字符串值，将通过心跳下发给设备作为策略。
      </Typography.Paragraph>
      <Table<Setting>
        rowKey="key"
        columns={columns}
        dataSource={settings}
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 项` }}
      />

      <Modal
        title={mode === 'create' ? '新增设置' : `编辑设置 ${editing?.key ?? ''}`}
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
            label="键 (key)"
            name="key"
            rules={[{ required: true, message: '请输入键' }]}
          >
            <Input placeholder="例如 allow-remote-config-modification" disabled={mode === 'edit'} />
          </Form.Item>
          <Form.Item label="值 (value)" name="value">
            <Input.TextArea rows={3} placeholder="字符串值，例如 Y 或 N" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
