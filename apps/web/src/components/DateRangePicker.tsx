import React, { useState, useEffect, useRef } from 'react'
import { DatePicker, Button, Space } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { CalendarOutlined } from '@ant-design/icons'

const { RangePicker } = DatePicker

export interface DateRangePickerProps {
  value: [Dayjs, Dayjs]
  onChange: (dates: [Dayjs, Dayjs]) => void
  style?: React.CSSProperties
  placeholder?: [string, string]
}

const PRESETS = [
  { label: '今天', value: [dayjs(), dayjs()] },
  { label: '昨天', value: [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')] },
  { label: '过去7天', value: [dayjs().subtract(6, 'day'), dayjs()] },
  { label: '过去14天', value: [dayjs().subtract(13, 'day'), dayjs()] },
  { label: '过去30天', value: [dayjs().subtract(29, 'day'), dayjs()] },
  { label: '本周', value: [dayjs().startOf('week'), dayjs()] },
  { label: '上周', value: [dayjs().subtract(1, 'week').startOf('week'), dayjs().subtract(1, 'week').endOf('week')] },
  { label: '本月', value: [dayjs().startOf('month'), dayjs()] },
  { label: '上月', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
]

const TIMEZONE_LABEL = 'UTC+8 (北京时间)'

const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange, style, placeholder }) => {
  const [open, setOpen] = useState(false)
  const [tempValue, setTempValue] = useState<[Dayjs, Dayjs]>(value)
  const isConfirming = useRef(false)
  const selectionJustMade = useRef(false)

  // Sync temp value when opening
  useEffect(() => {
    if (open) {
      setTempValue(value)
    }
  }, [open])

  const handleConfirm = () => {
    isConfirming.current = true
    onChange(tempValue)
    setOpen(false)
  }

  const handleCancel = () => {
    isConfirming.current = true
    setTempValue(value)
    setOpen(false)
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      if (selectionJustMade.current) {
        // Preset or manual selection just happened — keep panel open
        selectionJustMade.current = false
        setTimeout(() => setOpen(true), 0)
        return
      }
      if (!isConfirming.current) {
        // Clicked outside — revert
        setTempValue(value)
      }
      isConfirming.current = false
    }
    setOpen(isOpen)
  }

  return (
    <RangePicker
      value={open ? tempValue : value}
      onChange={(dates) => {
        if (dates) {
          selectionJustMade.current = true
          setTempValue(dates as [Dayjs, Dayjs])
        }
      }}
      open={open}
      onOpenChange={handleOpenChange}
      presets={PRESETS.map((p) => ({ label: p.label, value: p.value as any }))}
      renderExtraFooter={() => (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 4px 4px',
            borderTop: '1px solid #f0f0f0',
            marginTop: 8,
          }}
        >
          <Space size={4}>
            <CalendarOutlined style={{ color: '#999', fontSize: 12 }} />
            <span style={{ color: '#666', fontSize: 13 }}>时区: {TIMEZONE_LABEL}</span>
          </Space>
          <Space>
            <Button size="small" onClick={handleCancel}>
              取消
            </Button>
            <Button type="primary" size="small" onClick={handleConfirm}>
              确认
            </Button>
          </Space>
        </div>
      )}
      style={style}
      placeholder={placeholder || ['开始日期', '结束日期']}
    />
  )
}

export default DateRangePicker
