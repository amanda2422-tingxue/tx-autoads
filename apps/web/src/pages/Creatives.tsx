import React, { useState, useEffect } from 'react'
import {
  Table, Button, Space, Tag, Input, Modal, Form, Upload, Select, message, DatePicker, Row, Col, Image, Tabs, Card, Statistic, Popconfirm, Switch,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, DeleteOutlined, InboxOutlined, FileTextOutlined, EditOutlined, GlobalOutlined, PlayCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { creativesApi, Creative } from '@/utils/api/creatives'
import { campaignsApi, CountryCopy } from '@/utils/api/campaigns'
import DateRangePicker from '@/components/DateRangePicker'
import dayjs from 'dayjs'

const { Dragger } = Upload
const { TextArea } = Input


// 语言/国家缩写到投放国家的映射
const langToCountryMap: Record<string, string> = {
  'BN': 'BD',
  'VN': 'VN', 'VI': 'VN',
  'ID': 'ID', 'IN': 'ID',
  'PH': 'PH', 'TL': 'PH',
  'TH': 'TH',
  'EN': 'EN',
  'AR': 'AR',
  'PT': 'PT',
  'ES': 'ES',
  'HI': 'HI',
  'JP': 'JP', 'JA': 'JP',
  'KR': 'KR', 'KO': 'KR',
  'MS': 'MY', 'MY': 'MY',
  'TR': 'TR',
  'RU': 'RU',
  'DE': 'DE',
  'FR': 'FR',
  'IT': 'IT',
}

// 预置国家选项
const defaultCountries = [
  { label: '孟加拉 (BD)', value: 'BD' },
  { label: '越南 (VN)', value: 'VN' },
  { label: '印度尼西亚 (ID)', value: 'ID' },
  { label: '菲律宾 (PH)', value: 'PH' },
  { label: '泰国 (TH)', value: 'TH' },
  { label: '印度 (HI)', value: 'HI' },
  { label: '日本 (JP)', value: 'JP' },
  { label: '韩国 (KR)', value: 'KR' },
  { label: '英语 (EN)', value: 'EN' },
  { label: '阿拉伯语 (AR)', value: 'AR' },
  { label: '葡萄牙语 (PT)', value: 'PT' },
  { label: '西班牙语 (ES)', value: 'ES' },
  { label: '全球 (Global)', value: 'Global' },
]

// 预置设计师选项
const defaultDesigners = [
  { label: '裴云溪', value: '裴云溪' },
  { label: '向中华', value: '向中华' },
]

// 常见广告素材尺寸
const commonSizes = [
  { label: '1080 x 1080 (1:1 方形)', value: '1080x1080' },
  { label: '1200 x 628 (1.91:1 横版)', value: '1200x628' },
  { label: '1080 x 1920 (9:16 竖版)', value: '1080x1920' },
  { label: '1080 x 1350 (4:5 竖版)', value: '1080x1350' },
  { label: '1920 x 1080 (16:9 横版)', value: '1920x1080' },
  { label: '600 x 600 (1:1 小方形)', value: '600x600' },
  { label: '750 x 1334 (iPhone)', value: '750x1334' },
  { label: '1242 x 2208 (iPhone Plus)', value: '1242x2208' },
]

// 国家文案库 - 国家选项
const COPY_COUNTRY_OPTIONS: { code: string; name: string }[] = [
  { code: 'VN', name: '越南' },
  { code: 'ID', name: '印度尼西亚' },
  { code: 'PH', name: '菲律宾' },
  { code: 'TH', name: '泰国' },
  { code: 'BD', name: '孟加拉' },
  { code: 'HI', name: '印度' },
  { code: 'JP', name: '日本' },
  { code: 'KR', name: '韩国' },
  { code: 'EN', name: '英语区(US/UK)' },
  { code: 'AR', name: '阿拉伯语区' },
  { code: 'PT', name: '葡萄牙语区(BR)' },
  { code: 'ES', name: '西班牙语区' },
  { code: 'DE', name: '德国' },
  { code: 'FR', name: '法国' },
  { code: 'RU', name: '俄罗斯' },
  { code: 'TR', name: '土耳其' },
  { code: 'MY', name: '马来西亚' },
]

const CTA_OPTIONS = [
  { value: 'LEARN_MORE', label: '了解更多' },
  { value: 'SIGN_UP', label: '立即注册' },
  { value: 'GET_OFFER', label: '获取优惠' },
  { value: 'APPLY_NOW', label: '立即申请' },
]

const Creatives: React.FC = () => {
  // ========== Tab 状态 ==========
  const [activeTab, setActiveTab] = useState('creatives')

  // ========== 素材库状态 ==========
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Creative[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [uploadLoading, setUploadLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<'image' | 'video' | null>(null)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(7, 'days'), dayjs()])
  const [filterDesigner, setFilterDesigner] = useState<string | undefined>()
  const [filterCountry, setFilterCountry] = useState<string | undefined>()
  const [searchName, setSearchName] = useState('')
  const [detectedWidth, setDetectedWidth] = useState<number | null>(null)
  const [detectedHeight, setDetectedHeight] = useState<number | null>(null)
  const [countrySearch, setCountrySearch] = useState('')
  const [designerSearch, setDesignerSearch] = useState('')

  // ========== 素材批量上传状态 ==========
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [batchFiles, setBatchFiles] = useState<Array<{
    id: string
    file: File
    name: string
    designer?: string
    country?: string
    date?: dayjs.Dayjs
    width?: number
    height?: number
    status: 'pending' | 'uploading' | 'success' | 'error' | 'duplicate'
    errorMsg?: string
    creativeId?: string
  }>>([])
  const [batchUploading, setBatchUploading] = useState(false)
  const [batchFillDesigner, setBatchFillDesigner] = useState<string | undefined>()
  const [batchFillCountry, setBatchFillCountry] = useState<string | undefined>()
  const [batchFillSize, setBatchFillSize] = useState<string | undefined>()
  const [selectedCreativeIds, setSelectedCreativeIds] = useState<React.Key[]>([])

  // ========== 文案批量导入状态 ==========
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importCountry, setImportCountry] = useState<string>('')
  const [importText, setImportText] = useState('')
  const [importPreview, setImportPreview] = useState<Array<{
    seq: number
    primaryText: string
    headline: string
    ctaType: string
  }>>([])
  const [importLoading, setImportLoading] = useState(false)

  // ========== 国家文案库状态 ==========
  const [copies, setCopies] = useState<CountryCopy[]>([])
  const [copiesLoading, setCopiesLoading] = useState(false)
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [copyForm] = Form.useForm()
  const [editingCopy, setEditingCopy] = useState<CountryCopy | null>(null)
  const [copyFilterCountry, setCopyFilterCountry] = useState<string | undefined>()
  const [selectedCopyIds, setSelectedCopyIds] = useState<React.Key[]>([])

  // ========== 素材库 API ==========
  const fetchCreatives = async () => {
    setLoading(true)
    try {
      const response = await creativesApi.list({ withStats: true, limit: 100 })
      setData(response.data)
    } catch (error) {
      message.error('获取素材列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCreatives()
  }, [])

  // 从文件中读取实际像素尺寸
  const detectFileDimensions = (file: File): Promise<{ width: number; height: number } | null> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const img = new window.Image()
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight })
          URL.revokeObjectURL(img.src)
        }
        img.onerror = () => resolve(null)
        img.src = URL.createObjectURL(file)
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video')
        video.onloadedmetadata = () => {
          resolve({ width: video.videoWidth, height: video.videoHeight })
          URL.revokeObjectURL(video.src)
        }
        video.onerror = () => resolve(null)
        video.src = URL.createObjectURL(file)
      } else {
        resolve(null)
      }
    })
  }

  const handleFileChange = async (info: any) => {
    if (info.file) {
      const file = info.file
      const rawFile = file.originFileObj || file
      const url = URL.createObjectURL(rawFile)
      setPreviewUrl(url)
      setPreviewType(file.type?.startsWith('video') ? 'video' : 'image')

      const fileName = file.name || ''
      const nameParts = fileName.split('-')

      let identifiedDesigner: string | undefined = undefined
      let identifiedCountry: string | undefined = undefined
      let identifiedDate = dayjs()

      if (nameParts.length >= 3) {
        const designerCode = nameParts[0].toUpperCase()
        const designerMap: Record<string, string> = { 'PYX': '裴云溪', 'XZH': '向中华' }
        identifiedDesigner = designerMap[designerCode]

        const langCode = nameParts[1].toUpperCase()
        identifiedCountry = langToCountryMap[langCode]

        const dateMatch = nameParts[2].match(/(\d{4})/)
        if (dateMatch) {
          const month = parseInt(dateMatch[1].substring(0, 2)) - 1
          const day = parseInt(dateMatch[1].substring(2, 4))
          if (!isNaN(month) && !isNaN(day)) {
            const parsed = dayjs().set('month', month).set('date', day)
            if (parsed.isValid()) identifiedDate = parsed
          }
        }
      }

      const dims = await detectFileDimensions(rawFile)
      if (dims) {
        setDetectedWidth(dims.width)
        setDetectedHeight(dims.height)
        const sizeStr = `${dims.width}x${dims.height}`
        const matchedPreset = commonSizes.find(s => s.value === sizeStr)
        form.setFieldsValue({ dimensions: matchedPreset ? sizeStr : 'auto' })
      } else {
        setDetectedWidth(null)
        setDetectedHeight(null)
      }

      form.setFieldsValue({
        designer: identifiedDesigner,
        country: identifiedCountry,
        uploadedAt: identifiedDate,
      })
    } else {
      setPreviewUrl(null)
      setPreviewType(null)
      setDetectedWidth(null)
      setDetectedHeight(null)
    }
  }

  const handleUpload = async (values: any) => {
    const { file, country, designer, uploadedAt, dimensions } = values

    if (!file || !file.file) {
      message.error('请选择要上传的文件')
      return
    }

    let width: number | null = null
    let height: number | null = null
    if (dimensions === 'auto') {
      width = detectedWidth
      height = detectedHeight
    } else if (dimensions) {
      const parts = dimensions.split('x')
      if (parts.length === 2) {
        width = parseInt(parts[0])
        height = parseInt(parts[1])
      }
    }

    const formData = new FormData()
    formData.append('file', file.file.originFileObj || file.file)
    formData.append('country', country)
    formData.append('designer', designer || '未知')
    formData.append('uploadedAt', uploadedAt ? uploadedAt.toISOString() : dayjs().toISOString())
    if (width) formData.append('width', String(width))
    if (height) formData.append('height', String(height))

    setUploadLoading(true)
    try {
      await creativesApi.upload(formData)
      message.success('素材上传成功')
      setIsModalOpen(false)
      form.resetFields()
      setPreviewUrl(null)
      setDetectedWidth(null)
      setDetectedHeight(null)
      fetchCreatives()
    } catch (error: any) {
      const resp = error.response?.data
      if (resp?.duplicate) {
        message.warning(`素材已存在，请勿重复上传！已有同名素材: ${resp.existingName}`)
      } else {
        const errorMsg = resp?.error || '素材上传失败'
        message.error(errorMsg)
      }
    } finally {
      setUploadLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个素材吗？',
      onOk: async () => {
        try {
          await creativesApi.delete(id)
          message.success('删除成功')
          fetchCreatives()
        } catch (error) {
          message.error('删除失败')
        }
      }
    })
  }

  // 批量删除素材
  const handleBatchDeleteCreatives = async () => {
    if (selectedCreativeIds.length === 0) return
    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedCreativeIds.length} 个素材吗？此操作不可恢复。`,
      onOk: async () => {
        let success = 0
        let failed = 0
        for (const id of selectedCreativeIds) {
          try {
            await creativesApi.delete(String(id))
            success++
          } catch (error) {
            failed++
          }
        }
        message.success(`删除完成：成功 ${success}，失败 ${failed}`)
        setSelectedCreativeIds([])
        fetchCreatives()
      },
    })
  }

  // ========== 批量上传辅助函数 ==========

  // 从文件名解析信息（复用单文件上传的逻辑）
  const parseFileNameInfo = (fileName: string) => {
    const nameParts = fileName.split('-')
    let designer: string | undefined = undefined
    let country: string | undefined = undefined
    let date = dayjs()

    if (nameParts.length >= 3) {
      const designerCode = nameParts[0].toUpperCase()
      const designerMap: Record<string, string> = { 'PYX': '裴云溪', 'XZH': '向中华' }
      designer = designerMap[designerCode]

      const langCode = nameParts[1].toUpperCase()
      country = langToCountryMap[langCode]

      const dateMatch = nameParts[2].match(/(\d{4})/)
      if (dateMatch) {
        const month = parseInt(dateMatch[1].substring(0, 2)) - 1
        const day = parseInt(dateMatch[1].substring(2, 4))
        if (!isNaN(month) && !isNaN(day)) {
          const parsed = dayjs().set('month', month).set('date', day)
          if (parsed.isValid()) date = parsed
        }
      }
    }
    return { designer, country, date }
  }

  // 处理批量文件选择（替换模式：每次拖拽直接覆盖旧列表，同批次内部去重）
  const handleBatchFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const allFiles = Array.from(files)

    // 同批次内部去重：同名+同大小只保留第一个
    const seen = new Set<string>()
    const uniqueFiles = allFiles.filter(f => {
      const key = `${f.name}-${f.size}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    if (uniqueFiles.length < allFiles.length) {
      message.warning(`已跳过 ${allFiles.length - uniqueFiles.length} 个重复文件`)
    }

    const items = await Promise.all(
      uniqueFiles.map(async (file) => {
        const info = parseFileNameInfo(file.name)
        const dims = await detectFileDimensions(file)
        return {
          id: Math.random().toString(36).substring(2, 10),
          file,
          name: file.name,
          designer: info.designer,
          country: info.country,
          date: info.date,
          width: dims?.width,
          height: dims?.height,
          status: 'pending' as const,
        }
      })
    )

    setBatchFiles(items) // 替换，不是追加
  }

  // 更新批量文件中的某个字段
  const updateBatchItem = (id: string, updates: Partial<typeof batchFiles[0]>) => {
    setBatchFiles(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item))
  }

  // 执行批量上传
  const handleBatchUpload = async () => {
    if (batchFiles.length === 0) {
      message.warning('请先选择文件')
      return
    }
    const invalid = batchFiles.filter(f => !f.country)
    if (invalid.length > 0) {
      message.warning(`有 ${invalid.length} 个文件未设置国家，请先补充`)
      return
    }

    setBatchUploading(true)
    let successCount = 0
    let failCount = 0
    let dupCount = 0

    for (const item of batchFiles) {
      if (item.status !== 'pending') continue
      updateBatchItem(item.id, { status: 'uploading' })

      const formData = new FormData()
      formData.append('file', item.file)
      formData.append('country', item.country || 'Global')
      formData.append('designer', item.designer || '未知')
      formData.append('uploadedAt', item.date ? item.date.toISOString() : dayjs().toISOString())
      if (item.width) formData.append('width', String(item.width))
      if (item.height) formData.append('height', String(item.height))

      try {
        const resp = await creativesApi.upload(formData)
        updateBatchItem(item.id, { status: 'success', creativeId: resp.data.id })
        successCount++
      } catch (error: any) {
        const resp = error.response?.data
        if (resp?.duplicate) {
          updateBatchItem(item.id, { status: 'duplicate', errorMsg: resp.existingName })
          dupCount++
        } else {
          updateBatchItem(item.id, { status: 'error', errorMsg: resp?.error || '上传失败' })
          failCount++
        }
      }
    }

    setBatchUploading(false)
    message.success(`上传完成：成功 ${successCount}，重复 ${dupCount}，失败 ${failCount}`)
    if (successCount > 0) fetchCreatives()
  }

  // ========== 文案批量导入辅助函数 ==========

  // 下载 CSV 模板
  const downloadCopyTemplate = () => {
    const headers = ['primaryText', 'headline']
    const sample = [
      'Subukan ang iyong swerte! Pumili ng isang picture para malaman kung ano ang napana.\tAng iyong reward ay nandito na!',
      'Alin sa mga ito ang favorite mo? Pumili ng isa para makuha ang iyong surprise!\tPumili na ngayon!',
    ]
    const csv = [headers.join('\t'), ...sample].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/tab-separated-values;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'copy_import_template.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  // 解析导入文本（支持制表符或逗号分隔）
  const parseImportText = () => {
    if (!importCountry) {
      message.warning('请先选择国家')
      return
    }
    const text = importText.trim()
    if (!text) {
      setImportPreview([])
      return
    }

    // 按行分割，支持 \t 或 , 分隔
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    // 检测分隔符：如果第一行包含制表符则用制表符，否则用逗号
    const delimiter = lines[0]?.includes('\t') ? '\t' : ','

    const rows = lines.map((line, idx) => {
      const parts = line.split(delimiter).map(v => v.trim())
      return {
        seq: idx + 1,
        primaryText: parts[0] || '',
        headline: parts[1] || '',
        ctaType: 'LEARN_MORE',
      }
    }).filter(r => r.primaryText || r.headline)

    setImportPreview(rows)
  }

  // 执行批量导入文案
  const handleBatchImportCopies = async () => {
    if (!importCountry) {
      message.warning('请先选择国家')
      return
    }
    if (importPreview.length === 0) {
      message.warning('请先解析数据')
      return
    }
    const invalid = importPreview.filter(r => !r.primaryText && !r.headline)
    if (invalid.length > 0) {
      message.warning(`有 ${invalid.length} 条数据 Primary Text 和 Headline 都为空`)
      return
    }

    const countryName = COPY_COUNTRY_OPTIONS.find(c => c.code === importCountry)?.name || importCountry

    setImportLoading(true)
    let successCount = 0
    let failCount = 0

    // 将 Primary Text 和 Headline 作为独立记录分别导入
    for (const row of importPreview) {
      // 导入 Primary Text 记录
      if (row.primaryText) {
        try {
          await campaignsApi.createCountryCopy({
            countryCode: importCountry,
            countryName,
            name: `${importCountry}-PT-${row.seq}`,
            primaryText: row.primaryText,
            headline: '',
            description: '',
            ctaType: row.ctaType,
            isActive: true,
            isDefault: false,
            tags: [],
          })
          successCount++
        } catch (error) {
          failCount++
        }
      }

      // 导入 Headline 记录
      if (row.headline) {
        try {
          await campaignsApi.createCountryCopy({
            countryCode: importCountry,
            countryName,
            name: `${importCountry}-HL-${row.seq}`,
            primaryText: '',
            headline: row.headline,
            description: '',
            ctaType: row.ctaType,
            isActive: true,
            isDefault: false,
            tags: [],
          })
          successCount++
        } catch (error) {
          failCount++
        }
      }
    }

    setImportLoading(false)
    message.success(`导入完成：成功 ${successCount}，失败 ${failCount}`)
    if (successCount > 0) {
      fetchCopies()
      setImportModalOpen(false)
      setImportText('')
      setImportPreview([])
      setImportCountry('')
    }
  }

  // 过滤后的数据
  const filteredData = data.filter(item => {
    let match = true
    if (searchName) match = match && item.name.toLowerCase().includes(searchName.toLowerCase())
    if (filterDesigner) match = match && item.designer === filterDesigner
    if (filterCountry) match = match && item.country === filterCountry
    return match
  })

  const countryFormOptions = (() => {
    const filtered = defaultCountries.filter(c =>
      !countrySearch ||
      c.label.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.value.toLowerCase().includes(countrySearch.toLowerCase())
    )
    const hasExact = defaultCountries.some(c => c.value === countrySearch)
    if (countrySearch && !hasExact) {
      filtered.push({ label: `使用自定义: ${countrySearch}`, value: countrySearch })
    }
    return filtered
  })()

  const designerFormOptions = (() => {
    const filtered = defaultDesigners.filter(d =>
      !designerSearch ||
      d.label.toLowerCase().includes(designerSearch.toLowerCase()) ||
      d.value.toLowerCase().includes(designerSearch.toLowerCase())
    )
    const hasExact = defaultDesigners.some(d => d.value === designerSearch)
    if (designerSearch && !hasExact) {
      filtered.push({ label: `使用自定义: ${designerSearch}`, value: designerSearch })
    }
    return filtered
  })()

  const dimensionOptions = [
    ...(detectedWidth && detectedHeight
      ? [{ label: `${detectedWidth} x ${detectedHeight} (自动检测)`, value: 'auto' }]
      : []),
    ...commonSizes.map(s => ({ label: s.label, value: s.value })),
  ]

  // ========== 国家文案库 API ==========
  const fetchCopies = async () => {
    setCopiesLoading(true)
    try {
      const response: any = await campaignsApi.getCountryCopies({
        countryCode: copyFilterCountry,
        limit: 100,
      })
      setCopies(response.data || [])
    } catch (error) {
      message.error('获取国家文案失败')
    } finally {
      setCopiesLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'copies') {
      fetchCopies()
    }
  }, [activeTab, copyFilterCountry])

  const openCopyModal = (copy?: CountryCopy) => {
    setEditingCopy(copy || null)
    if (copy) {
      copyForm.setFieldsValue({
        countryCode: copy.countryCode,
        countryName: copy.countryName,
        name: copy.name,
        primaryText: copy.primaryText,
        headline: copy.headline,
        description: copy.description,
        ctaType: copy.ctaType,
        isDefault: copy.isDefault,
        tags: copy.tags?.join(', '),
      })
    } else {
      copyForm.resetFields()
      copyForm.setFieldsValue({ ctaType: 'LEARN_MORE', isDefault: false })
    }
    setCopyModalOpen(true)
  }

  const handleSaveCopy = async (values: any) => {
    const payload = {
      ...values,
      tags: values.tags ? values.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
    }

    try {
      if (editingCopy) {
        await campaignsApi.updateCountryCopy(editingCopy.id, payload)
        message.success('文案已更新')
      } else {
        await campaignsApi.createCountryCopy(payload)
        message.success('文案已创建')
      }
      setCopyModalOpen(false)
      fetchCopies()
    } catch (error: any) {
      message.error(error.response?.data?.error || '保存失败')
    }
  }

  const handleDeleteCopy = async (id: string) => {
    try {
      await campaignsApi.deleteCountryCopy(id)
      message.success('文案已删除')
      fetchCopies()
    } catch (error) {
      message.error('删除失败')
    }
  }

  // 批量删除文案
  const handleBatchDeleteCopies = async () => {
    if (selectedCopyIds.length === 0) return
    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedCopyIds.length} 条文案吗？此操作不可恢复。`,
      onOk: async () => {
        let success = 0
        let failed = 0
        for (const id of selectedCopyIds) {
          try {
            await campaignsApi.deleteCountryCopy(String(id))
            success++
          } catch (error) {
            failed++
          }
        }
        message.success(`删除完成：成功 ${success}，失败 ${failed}`)
        setSelectedCopyIds([])
        fetchCopies()
      },
    })
  }

  // ========== 表格列定义 ==========
  const columns: ColumnsType<any> = [
    {
      title: '素材预览',
      dataIndex: 'fileUrl',
      key: 'preview',
      width: 90,
      render: (url: string, record) => {
        const fullUrl = url
        if (record.type === 'video') {
          return (
            <div style={{ position: 'relative', width: 60, height: 45 }}>
              <video src={fullUrl} style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 4, background: '#000' }} />
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.2)', borderRadius: 4
              }}>
                <PlayCircleOutlined style={{ color: '#fff', fontSize: 16 }} />
              </div>
            </div>
          )
        }
        return (
          <Image
            src={fullUrl}
            alt={record.name}
            width={60}
            height={45}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNDUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjQ1IiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iMzAiIHk9IjI1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEwIiBmaWxsPSIjYmZiZmJmIj5OL0E8L3RleHQ+PC9zdmc+"
            preview={{ mask: '查看' }}
          />
        )
      }
    },
    {
      title: '素材名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      ellipsis: true,
    },
    {
      title: '设计师',
      dataIndex: 'designer',
      key: 'designer',
      width: 100,
      render: (designer) => <Tag color="blue">{designer || '未知'}</Tag>
    },
    {
      title: '创建者',
      dataIndex: 'owner',
      key: 'owner',
      width: 100,
      render: (owner: any) => owner ? <Tag color="geekblue">{owner.displayName || owner.username}</Tag> : <span>-</span>
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 80,
      render: (country) => country ? <Tag color="cyan">{country}</Tag> : <span>-</span>
    },
    {
      title: '尺寸',
      key: 'dimensions',
      width: 120,
      render: (_, record) => {
        if (record.width && record.height) {
          return `${record.width} x ${record.height}`
        }
        return '-'
      }
    },
    {
      title: '被使用次数',
      dataIndex: '_count',
      key: 'usageCount',
      width: 90,
      render: (count) => count?.ads || 0,
      sorter: (a, b) => (a._count?.ads || 0) - (b._count?.ads || 0)
    },
    {
      title: '总消耗',
      key: 'totalSpend',
      width: 100,
      render: (_, record) => {
        const spend = record.totalSpend || 0
        return spend > 0 ? `$${spend.toFixed(0)}` : '-'
      },
      sorter: (a, b) => (a.totalSpend || 0) - (b.totalSpend || 0),
    },
    {
      title: '转化数',
      key: 'totalConversions',
      width: 80,
      render: (_, record) => record.totalConversions || '-',
      sorter: (a, b) => (a.totalConversions || 0) - (b.totalConversions || 0),
    },
    {
      title: '国家消耗',
      key: 'countrySpend',
      width: 180,
      render: (_, record) => {
        if (!record.countryStats || record.countryStats.length === 0) {
          return <span style={{ color: '#999' }}>-</span>
        }
        const topCountries = [...record.countryStats]
          .sort((a, b) => b.totalSpend - a.totalSpend)
          .slice(0, 3)
        return (
          <div style={{ lineHeight: '20px' }}>
            {topCountries.map((stat, idx) => (
              <div key={stat.countryCode} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <Tag color={idx === 0 ? 'red' : idx === 1 ? 'orange' : 'default'} style={{ fontSize: 10, lineHeight: '14px', padding: '0 4px', margin: 0 }}>
                  {stat.countryCode}
                </Tag>
                <span style={{ fontWeight: 500 }}>${stat.totalSpend.toFixed(2)}</span>
                {stat.totalConversions > 0 && (
                  <span style={{ color: '#52c41a', fontSize: 11 }}>({stat.totalConversions}转化)</span>
                )}
              </div>
            ))}
            {record.countryStats.length > 3 && (
              <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
                +{record.countryStats.length - 3} 个国家...
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: '上传时间',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      width: 120,
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 70,
      render: (_, record) => (
        <Button type="link" icon={<DeleteOutlined />} danger size="small" onClick={() => handleDelete(record.id)} />
      ),
    },
  ]

  const copyColumns: ColumnsType<CountryCopy> = [
    {
      title: '国家',
      dataIndex: 'countryCode',
      key: 'countryCode',
      width: 100,
      render: (code, record) => (
        <Tag color="blue">{record.countryName || code} ({code})</Tag>
      ),
    },
    {
      title: '文案名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '标题',
      dataIndex: 'headline',
      key: 'headline',
      width: 150,
      ellipsis: true,
    },
    {
      title: '正文',
      dataIndex: 'primaryText',
      key: 'primaryText',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'CTA',
      dataIndex: 'ctaType',
      key: 'ctaType',
      width: 100,
      render: (cta) => CTA_OPTIONS.find(c => c.value === cta)?.label || cta,
    },
    {
      title: '引用次数',
      dataIndex: 'useCount',
      key: 'useCount',
      width: 90,
      align: 'center' as const,
      sorter: (a, b) => (a.useCount || 0) - (b.useCount || 0),
      render: (count) => count || 0,
    },
    {
      title: '文案消耗',
      dataIndex: 'totalSpend',
      key: 'totalSpend',
      width: 100,
      sorter: (a, b) => (a.totalSpend || 0) - (b.totalSpend || 0),
      render: (val) => val > 0 ? `$${val.toFixed(0)}` : '-',
    },
    {
      title: '平均CPA',
      dataIndex: 'avgCpa',
      key: 'avgCpa',
      width: 90,
      render: (val) => val ? `$${val.toFixed(2)}` : '-',
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => (
        <Space>
          {record.isActive && <Tag color="green">启用</Tag>}
          {record.isDefault && <Tag color="gold">默认</Tag>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openCopyModal(record)} />
          <Popconfirm
            title="确认删除此文案？"
            onConfirm={() => handleDeleteCopy(record.id)}
          >
            <Button type="link" size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ========== Tab Items ==========
  const tabItems = [
    {
      key: 'creatives',
      label: (
        <span>
          <InboxOutlined /> 素材库
        </span>
      ),
      children: (
        <>
          <div className="card-header">
            <h2 style={{ margin: 0 }}>素材库</h2>
            <Space>
              <DateRangePicker
                value={dateRange}
                onChange={(dates) => dates && setDateRange([dates[0]!, dates[1]!])}
              />
              <Button type="primary" icon={<SearchOutlined />} onClick={fetchCreatives}>查询</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
                上传素材
              </Button>
              <Button icon={<InboxOutlined />} onClick={() => setBatchModalOpen(true)}>
                批量上传
              </Button>
              {selectedCreativeIds.length > 0 && (
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleBatchDeleteCreatives}
                >
                  批量删除 ({selectedCreativeIds.length})
                </Button>
              )}
            </Space>
          </div>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Input
                placeholder="按素材名称搜索..."
                prefix={<SearchOutlined />}
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                allowClear
              />
            </Col>
            <Col span={4}>
              <Select
                placeholder="设计师筛选"
                style={{ width: '100%' }}
                allowClear
                showSearch
                value={filterDesigner}
                onChange={(val) => setFilterDesigner(val)}
              >
                {defaultDesigners.map(d => <Select.Option key={d.value} value={d.value}>{d.label}</Select.Option>)}
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="国家筛选"
                style={{ width: '100%' }}
                allowClear
                showSearch
                value={filterCountry}
                onChange={(val) => setFilterCountry(val)}
              >
                {defaultCountries.map(c => <Select.Option key={c.value} value={c.value}>{c.label}</Select.Option>)}
              </Select>
            </Col>
          </Row>

          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="id"
            loading={loading}
            pagination={{
              defaultPageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total) => `共 ${total} 条`,
            }}
            size="small"
            scroll={{ x: 1400 }}
            rowSelection={{
              selectedRowKeys: selectedCreativeIds,
              onChange: (keys) => setSelectedCreativeIds(keys),
            }}
          />

          <Modal
            title="上传素材"
            open={isModalOpen}
            onCancel={() => {
              setIsModalOpen(false)
              setPreviewUrl(null)
              setDetectedWidth(null)
              setDetectedHeight(null)
              form.resetFields()
            }}
            onOk={() => form.submit()}
            confirmLoading={uploadLoading}
            width={640}
            okText="开始上传"
            cancelText="取消"
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleUpload}
              initialValues={{ uploadedAt: dayjs() }}
            >
              <Form.Item
                name="file"
                label="选择素材文件 (支持图片/视频)"
                rules={[{ required: true, message: '请选择文件' }]}
              >
                <Dragger
                  maxCount={1}
                  beforeUpload={() => false}
                  onChange={handleFileChange}
                  showUploadList={false}
                  accept="image/*,video/*"
                >
                  {previewUrl ? (
                    <div style={{ padding: '10px' }}>
                      {previewType === 'video' ? (
                        <video src={previewUrl} style={{ width: '100%', maxHeight: 200 }} controls />
                      ) : (
                        <img src={previewUrl} alt="preview" style={{ width: '100%', maxHeight: 200, objectFit: 'contain' }} />
                      )}
                      <p style={{ marginTop: 10, color: '#1890ff' }}>点击更换文件</p>
                    </div>
                  ) : (
                    <>
                      <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                      <p className="ant-upload-text">点击或拖拽文件到此区域</p>
                    </>
                  )}
                </Dragger>
              </Form.Item>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="country" label="投放国家" rules={[{ required: true, message: '请选择或输入国家' }]}>
                    <Select
                      placeholder="选择或输入国家"
                      showSearch
                      allowClear
                      filterOption={false}
                      onSearch={setCountrySearch}
                      onSelect={() => setCountrySearch('')}
                      options={countryFormOptions}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="designer" label="设计师" rules={[{ required: true, message: '请选择或输入设计师' }]}>
                    <Select
                      placeholder="选择或输入设计师"
                      showSearch
                      allowClear
                      filterOption={false}
                      onSearch={setDesignerSearch}
                      onSelect={() => setDesignerSearch('')}
                      options={designerFormOptions}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="uploadedAt" label="上传日期" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="dimensions" label="素材尺寸">
                <Select
                  placeholder="选择尺寸（上传文件后自动检测）"
                  allowClear
                  options={dimensionOptions}
                />
              </Form.Item>
            </Form>
          </Modal>

          {/* 批量上传 Modal */}
          <Modal
            title="批量上传素材"
            open={batchModalOpen}
            destroyOnClose
            onCancel={() => {
              setBatchModalOpen(false)
              setBatchFiles([])
            }}
            footer={[
              <Button key="cancel" onClick={() => { setBatchModalOpen(false); setBatchFiles([]) }}>
                关闭
              </Button>,
              <Button
                key="upload"
                type="primary"
                loading={batchUploading}
                disabled={batchFiles.length === 0}
                onClick={handleBatchUpload}
              >
                开始上传 ({batchFiles.filter(f => f.status === 'pending').length} 待上传)
              </Button>,
            ]}
            width={900}
          >
            <div style={{ marginBottom: 16 }}>
              <Dragger
                multiple
                beforeUpload={() => false}
                onChange={(info: any) => {
                  const files = info.fileList?.map((f: any) => f.originFileObj || f).filter(Boolean)
                  if (files && files.length > 0) {
                    handleBatchFileSelect(files)
                  }
                }}
                showUploadList={false}
                accept="image/*,video/*"
              >
                <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                <p className="ant-upload-text">点击或拖拽多个文件到此区域</p>
                <p className="ant-upload-hint">支持批量上传图片和视频，文件名格式：设计师代号-语言缩写-日期</p>
              </Dragger>
            </div>

            {batchFiles.length > 0 && (
              <div style={{ marginBottom: 12, padding: 12, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
                <Space wrap>
                  <span style={{ fontWeight: 500, color: '#52c41a' }}>批量填充：</span>
                  <Select
                    size="small"
                    placeholder="设计师"
                    style={{ width: 120 }}
                    allowClear
                    showSearch
                    value={batchFillDesigner}
                    onChange={setBatchFillDesigner}
                    options={defaultDesigners}
                  />
                  <Select
                    size="small"
                    placeholder="国家"
                    style={{ width: 140 }}
                    allowClear
                    showSearch
                    value={batchFillCountry}
                    onChange={setBatchFillCountry}
                    options={defaultCountries}
                  />
                  <Select
                    size="small"
                    placeholder="尺寸"
                    style={{ width: 180 }}
                    allowClear
                    showSearch
                    value={batchFillSize}
                    onChange={setBatchFillSize}
                    options={commonSizes}
                  />
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => {
                      if (!batchFillDesigner && !batchFillCountry && !batchFillSize) {
                        message.warning('请先选择要填充的值')
                        return
                      }
                      setBatchFiles(prev => prev.map(item => {
                        const updates: Partial<typeof batchFiles[0]> = {}
                        if (batchFillDesigner) updates.designer = batchFillDesigner
                        if (batchFillCountry) updates.country = batchFillCountry
                        if (batchFillSize) {
                          const [w, h] = batchFillSize.split('x').map(Number)
                          updates.width = w
                          updates.height = h
                        }
                        return { ...item, ...updates }
                      }))
                      message.success('已应用到全部')
                    }}
                  >
                    应用到全部
                  </Button>
                </Space>
              </div>
            )}

            {batchFiles.length > 0 && (
              <Table
                dataSource={batchFiles}
                rowKey="id"
                size="small"
                pagination={false}
                scroll={{ y: 400 }}
                columns={[
                  {
                    title: '文件名',
                    dataIndex: 'name',
                    width: 180,
                    ellipsis: true,
                  },
                  {
                    title: '设计师',
                    dataIndex: 'designer',
                    width: 120,
                    render: (val, record) => (
                      <Select
                        size="small"
                        style={{ width: 100 }}
                        value={val}
                        allowClear
                        showSearch
                        onChange={(v) => updateBatchItem(record.id, { designer: v })}
                        options={defaultDesigners}
                      />
                    ),
                  },
                  {
                    title: '国家',
                    dataIndex: 'country',
                    width: 120,
                    render: (val, record) => (
                      <Select
                        size="small"
                        style={{ width: 100 }}
                        value={val}
                        allowClear
                        showSearch
                        onChange={(v) => updateBatchItem(record.id, { country: v })}
                        options={defaultCountries}
                      />
                    ),
                  },
                  {
                    title: '尺寸',
                    width: 120,
                    render: (_, record) => (
                      record.width && record.height
                        ? `${record.width} x ${record.height}`
                        : '-'
                    ),
                  },
                  {
                    title: '状态',
                    width: 100,
                    render: (_, record) => {
                      const statusMap: Record<string, { color: string; text: string }> = {
                        pending: { color: 'default', text: '待上传' },
                        uploading: { color: 'processing', text: '上传中' },
                        success: { color: 'success', text: '成功' },
                        error: { color: 'error', text: '失败' },
                        duplicate: { color: 'warning', text: '重复' },
                      }
                      const s = statusMap[record.status] || { color: 'default', text: record.status }
                      return <Tag color={s.color}>{s.text}</Tag>
                    },
                  },
                  {
                    title: '说明',
                    width: 150,
                    render: (_, record) => (
                      record.errorMsg ? <span style={{ color: '#ff4d4f', fontSize: 12 }}>{record.errorMsg}</span> : null
                    ),
                  },
                ]}
              />
            )}
          </Modal>
        </>
      ),
    },
    {
      key: 'copies',
      label: (
        <span>
          <FileTextOutlined /> 国家文案库
        </span>
      ),
      children: (
        <>
          <div className="card-header">
            <h2 style={{ margin: 0 }}>国家文案库</h2>
            <Space>
              <Select
                placeholder="筛选国家"
                style={{ width: 150 }}
                allowClear
                value={copyFilterCountry}
                onChange={setCopyFilterCountry}
              >
                {COPY_COUNTRY_OPTIONS.map(c => (
                  <Select.Option key={c.code} value={c.code}>{c.name}</Select.Option>
                ))}
              </Select>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => openCopyModal()}
              >
                新建文案
              </Button>
              <Button
                icon={<FileTextOutlined />}
                onClick={() => setImportModalOpen(true)}
              >
                批量导入
              </Button>
              {selectedCopyIds.length > 0 && (
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleBatchDeleteCopies}
                >
                  批量删除 ({selectedCopyIds.length})
                </Button>
              )}
            </Space>
          </div>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card>
                <Statistic title="文案总数" value={copies.length} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="启用文案"
                  value={copies.filter(c => c.isActive).length}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="默认文案"
                  value={copies.filter(c => c.isDefault).length}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="覆盖国家"
                  value={new Set(copies.map(c => c.countryCode)).size}
                />
              </Card>
            </Col>
          </Row>

          <Table
            columns={copyColumns}
            dataSource={copies}
            rowKey="id"
            loading={copiesLoading}
            pagination={{
              defaultPageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total) => `共 ${total} 条`,
            }}
            size="small"
            scroll={{ x: 1000 }}
            rowSelection={{
              selectedRowKeys: selectedCopyIds,
              onChange: (keys) => setSelectedCopyIds(keys),
            }}
          />

          <Modal
            title={editingCopy ? '编辑文案' : '新建文案'}
            open={copyModalOpen}
            onCancel={() => setCopyModalOpen(false)}
            onOk={() => copyForm.submit()}
            width={600}
          >
            <Form
              form={copyForm}
              layout="vertical"
              onFinish={handleSaveCopy}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="countryCode"
                    label="国家"
                    rules={[{ required: true, message: '请选择国家' }]}
                  >
                    <Select
                      placeholder="选择国家"
                      showSearch
                      onChange={(value) => {
                        const country = COPY_COUNTRY_OPTIONS.find(c => c.code === value)
                        copyForm.setFieldsValue({ countryName: country?.name || value })
                      }}
                    >
                      {COPY_COUNTRY_OPTIONS.map(c => (
                        <Select.Option key={c.code} value={c.code}>{c.name} ({c.code})</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="name"
                    label="文案名称"
                    rules={[{ required: true, message: '请输入文案名称' }]}
                  >
                    <Input placeholder="如：高转化文案-版本1" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="countryName" hidden>
                <Input />
              </Form.Item>

              <Form.Item
                name="headline"
                label="标题 (Headline)"
                rules={[{ required: true, message: '请输入标题' }]}
              >
                <Input maxLength={25} showCount placeholder="最多 25 字符" />
              </Form.Item>

              <Form.Item
                name="primaryText"
                label="广告正文 (Primary Text)"
                rules={[{ required: true, message: '请输入正文' }]}
              >
                <TextArea
                  rows={3}
                  maxLength={125}
                  showCount
                  placeholder="最多 125 字符"
                />
              </Form.Item>

              <Form.Item name="description" label="描述 (可选)">
                <TextArea rows={2} placeholder="补充描述信息" />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="ctaType" label="CTA 按钮">
                    <Select>
                      {CTA_OPTIONS.map(c => (
                        <Select.Option key={c.value} value={c.value}>{c.label}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="tags" label="标签（逗号分隔）">
                    <Input placeholder="如：高转化,测试通过" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="isDefault" valuePropName="checked">
                    <Switch checkedChildren="默认" unCheckedChildren="非默认" />
                    <span style={{ marginLeft: 8, color: '#666' }}>设为该国默认文案</span>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="isActive" valuePropName="checked" initialValue={true}>
                    <Switch checkedChildren="启用" unCheckedChildren="禁用" defaultChecked />
                    <span style={{ marginLeft: 8, color: '#666' }}>启用此文案</span>
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Modal>

          {/* 文案批量导入 Modal */}
          <Modal
            title="批量导入文案"
            open={importModalOpen}
            onCancel={() => {
              setImportModalOpen(false)
              setImportText('')
              setImportPreview([])
            }}
            footer={[
              <Button key="cancel" onClick={() => { setImportModalOpen(false); setImportText(''); setImportPreview([]); setImportCountry('') }}>
                取消
              </Button>,
              <Button key="template" onClick={downloadCopyTemplate}>
                下载 CSV 模板
              </Button>,
              <Button
                key="import"
                type="primary"
                loading={importLoading}
                disabled={importPreview.length === 0 || !importCountry}
                onClick={handleBatchImportCopies}
              >
                确认导入 ({importPreview.length * 2} 条记录)
              </Button>,
            ]}
            width={960}
          >
            {/* 国家选择 */}
            <div style={{ marginBottom: 16, padding: 12, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
              <span style={{ fontWeight: 600, marginRight: 12 }}>Step 1 - 选择国家：</span>
              <Select
                placeholder="选择要导入文案的国家"
                style={{ width: 220 }}
                value={importCountry || undefined}
                onChange={(val) => setImportCountry(val)}
                showSearch
              >
                {COPY_COUNTRY_OPTIONS.map(c => (
                  <Select.Option key={c.code} value={c.code}>{c.name} ({c.code})</Select.Option>
                ))}
              </Select>
              {!importCountry && <span style={{ color: '#ff4d4f', marginLeft: 12, fontSize: 13 }}>请先选择国家</span>}
            </div>

            {/* 粘贴区域 */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>Step 2 - 粘贴文案数据：</p>
              <p style={{ color: '#666', fontSize: 13, marginBottom: 8 }}>
                <strong>第一列 = Primary Text（主要文本）</strong>&nbsp;&nbsp;&nbsp;&nbsp;<strong>第二列 = Headline（主标题）</strong>
                <br />
                <span style={{ color: '#999' }}>支持用制表符（从 Excel 直接复制）或逗号分隔。两列内容会作为两个独立记录分别导入。</span>
              </p>
              <TextArea
                rows={8}
                placeholder={`示例（可从 Excel 直接复制粘贴，两列用 Tab 分隔）：
Subukan ang iyong swerte! Pumili ng isang picture para malaman kung ano ang napana.\tAng iyong reward ay nandito na!
Alin sa mga ito ang favorite mo? Pumili ng isa para makuha ang iyong surprise!\tPumili na ngayon!
Maswerte ka ba ngayong araw? I-click ang picture na gusto mo para sa iyong reward!\tAng iyong Lucky Day!`}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <Button
                type="primary"
                style={{ marginTop: 8 }}
                disabled={!importCountry}
                onClick={parseImportText}
              >
                解析数据
              </Button>
            </div>

            {/* 预览表格 */}
            {importPreview.length > 0 && (
              <div>
                <h4 style={{ marginBottom: 8 }}>预览 ({importPreview.length} 行 → 导入后生成 {importPreview.length * 2} 条独立记录)</h4>
                <Table
                  dataSource={importPreview.map((item) => ({ ...item, key: item.seq }))}
                  size="small"
                  pagination={{ pageSize: 8 }}
                  scroll={{ x: 700 }}
                  columns={[
                    {
                      title: '序号',
                      dataIndex: 'seq',
                      width: 60,
                      render: (seq) => <Tag color="blue">{importCountry}-{seq}</Tag>,
                    },
                    {
                      title: 'Primary Text（第一列）',
                      dataIndex: 'primaryText',
                      width: 320,
                      ellipsis: true,
                      render: (text) => text ? text : <span style={{ color: '#ff4d4f' }}>-</span>,
                    },
                    {
                      title: 'Headline（第二列）',
                      dataIndex: 'headline',
                      width: 220,
                      ellipsis: true,
                      render: (text) => text ? text : <span style={{ color: '#ff4d4f' }}>-</span>,
                    },
                    {
                      title: '导入记录',
                      width: 130,
                      render: (_, record) => (
                        <div style={{ fontSize: 12 }}>
                          {record.primaryText && <div><Tag color="cyan" size="small">PT</Tag> {importCountry}-PT-{record.seq}</div>}
                          {record.headline && <div style={{ marginTop: 4 }}><Tag color="purple" size="small">HL</Tag> {importCountry}-HL-{record.seq}</div>}
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            )}
          </Modal>
        </>
      ),
    },
  ]

  return (
    <div className="page-container">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
    </div>
  )
}

export default Creatives
