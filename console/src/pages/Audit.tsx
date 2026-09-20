import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import {
  App as AntdApp,
  Button,
  Card,
  Input,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { TableProps } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import * as api from '../api'
import { getErrorMessage } from '../api/client'
import type { AuditRecord } from '../api/types'
import { formatTime } from '../utils/format'

const LIMIT = 200

export default function Audit() {
  const { message } = AntdApp.useApp()
  const [records, setRecords] = useState<AuditRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState('')

  const load = useCallback(
    async (filter: string) => {
      setLoading(true)
      try {
        setRecords(await api.fetchAudit(filter || undefined, LIMIT))
      } catch (error) {
        message.error(getErrorMessage(error))
      } finally {
        setLoading(false)
      }
    },
    [message],
  )

  useEffect(() => {
    void load('')
  }, [load])

  const handleSearch = (value: string) => {
    const next = value.trim()
    setType(next)
    void load(next)
  }

  const columns: TableProps<AuditRecord>['columns'] = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 90, fixed: 'left' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 160,
      render: (value: string) => (value ? <Tag color="blue">{value}</Tag> : '-'),
    },
    {
      title: '用户',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 140,
      render: (value: string) => value || '-',
    },
    {
      title: '设备 ID',
      dataIndex: 'device_id',
      key: 'device_id',
      width: 150,
      render: (value: string) => value || '-',
    },
    {
      title: '对端 ID',
      dataIndex: 'peer_id',
      key: 'peer_id',
      width: 150,
      render: (value: string) => value || '-',
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 160,
      render: (value: string) => value || '-',
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 190,
      render: (value: AuditRecord['created_at']) => formatTime(value),
    },
  ]

  return (
    <Card
      title="审计日志"
      bordered={false}
      extra={
        <Space>
          <Input
            allowClear
            placeholder="按类型过滤，留空显示全部"
            prefix={<SearchOutlined />}
            value={type}
            onChange={(event) => setType(event.target.value)}
            onPressEnter={(event) => handleSearch(event.currentTarget.value)}
            style={{ width: 260 }}
          />
          <Button onClick={() => handleSearch(type)}>查询</Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void load(type)}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      }
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        最多显示最近 {LIMIT} 条记录。
      </Typography.Paragraph>
      <Table<AuditRecord>
        rowKey={(record) => String(record.id)}
        columns={columns}
        dataSource={records}
        loading={loading}
        scroll={{ x: 1400 }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
      />
    </Card>
  )
}
