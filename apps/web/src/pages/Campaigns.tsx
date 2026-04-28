import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Space, Tag, Input, Select, Modal, message, Progress,
  Row, Col, Checkbox, InputNumber, Drawer, Card, Descriptions, Badge,
  Popconfirm, Tooltip, Alert, Statistic, Radio, Switch, Empty,
} from 'antd'
import {
  SearchOutlined, DeleteOutlined, CopyOutlined,
  PauseCircleOutlined, PlayCircleOutlined, EyeOutlined,
  GlobalOutlined, RocketOutlined, ThunderboltOutlined,
  FileTextOutlined, SettingOutlined, SaveOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  campaignsApi, Campaign, AdSet, Ad,
  CountryTemplate, AudienceTemplate, CountryCopy, AutoCreatePayload,
} from '@/utils/api/campaigns'
import { creativesApi, Creative } from '@/utils/api/creatives'
import dayjs from 'dayjs'

const API_BASE = 'http://localhost:3001'

// ===================== 状态/颜色映射 =====================

const statusMap: Record<string, { color: string; text: string }> = {
  active: { color: 'success', text: '投放中' },
  paused: { color: 'warning', text: '已暂停' },
  draft: { color: 'default', text: '草稿' },
  ended: { color: 'default', text: '已结束' },
  archived: { color: 'default', text: '已归档' },
  scheduled: { color: 'processing', text: '排期中' },
}

const audienceLabels: Record<string, string> = {
  T1: '宽泛流量',
  T2: '调研兴趣',
  T3: '再营销',
}

const ctaLabels: Record<string, string> = {
  LEARN_MORE: '了解更多',
  SIGN_UP: '立即注册',
  GET_OFFER: '获取优惠',
  APPLY_NOW: '立即申请',
}

// ===================== Campaign 设置选项 =====================

const CAMPAIGN_OBJECTIVES = [
  { value: 'OUTCOME_SALES', label: '销量 (Sales)', desc: '获取购买、注册等转化' },
  { value: 'OUTCOME_TRAFFIC', label: '流量 (Traffic)', desc: '获取更多网站访问' },
  { value: 'OUTCOME_ENGAGEMENT', label: '互动 (Engagement)', desc: '获取更多帖子互动' },
  { value: 'OUTCOME_LEADS', label: '潜在客户 (Leads)', desc: '收集潜在客户信息' },
  { value: 'OUTCOME_APP_PROMOTION', label: '应用推广 (App Promotion)', desc: '推广应用安装' },
  { value: 'OUTCOME_AWARENESS', label: '品牌知名度 (Awareness)', desc: '提升品牌认知' },
]

const BID_STRATEGIES = [
  { value: 'LOWEST_COST_WITHOUT_CAP', label: '最低费用 (Lowest Cost)', desc: '系统自动获取最低费用' },
  { value: 'COST_CAP', label: '费用上限 (Cost Cap)', desc: '控制单次成效费用上限' },
  { value: 'BID_CAP', label: '竞价上限 (Bid Cap)', desc: '控制每次竞拍最高出价' },
  { value: 'MINIMUM_ROAS', label: '最低 ROAS', desc: '确保广告支出回报率达标' },
]

const OPTIMIZATION_GOALS: Record<string, { value: string; label: string }[]> = {
  OUTCOME_SALES: [
    { value: 'OFFSITE_CONVERSIONS', label: '最大化转化次数 (Conversions)' },
    { value: 'VALUE', label: '最大化转化价值 (Value)' },
  ],
  OUTCOME_TRAFFIC: [
    { value: 'LINK_CLICKS', label: '最大化链接点击 (Link Clicks)' },
    { value: 'LANDING_PAGE_VIEWS', label: '最大化落地页浏览 (Landing Page Views)' },
  ],
  OUTCOME_ENGAGEMENT: [
    { value: 'POST_ENGAGEMENT', label: '最大化帖子互动 (Post Engagement)' },
    { value: 'THRUPLAY', label: '最大化视频播放 (ThruPlay)' },
  ],
  OUTCOME_LEADS: [
    { value: 'OFFSITE_CONVERSIONS', label: '最大化转化次数 (Conversions)' },
    { value: 'LEAD_GENERATION', label: '最大化表单提交 (Lead Generation)' },
  ],
  OUTCOME_APP_PROMOTION: [
    { value: 'APP_INSTALLS', label: '最大化应用安装 (App Installs)' },
  ],
  OUTCOME_AWARENESS: [
    { value: 'REACH', label: '最大化覆盖人数 (Reach)' },
    { value: 'IMPRESSIONS', label: '最大化展示次数 (Impressions)' },
  ],
}

const CONVERSION_EVENTS = [
  { value: 'PURCHASE', label: 'Purchase (购买)' },
  { value: 'ADD_TO_CART', label: 'Add to Cart (加购)' },
  { value: 'COMPLETE_REGISTRATION', label: 'Complete Registration (注册)' },
  { value: 'LEAD', label: 'Lead (潜在客户)' },
  { value: 'INITIATE_CHECKOUT', label: 'Initiate Checkout (发起结账)' },
  { value: 'ADD_PAYMENT_INFO', label: 'Add Payment Info (添加支付)' },
  { value: 'SEARCH', label: 'Search (搜索)' },
  { value: 'VIEW_CONTENT', label: 'View Content (浏览内容)' },
  { value: 'SUBSCRIBE', label: 'Subscribe (订阅)' },
  { value: 'START_TRIAL', label: 'Start Trial (开始试用)' },
]

const PUBLISHER_PLATFORM_OPTIONS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'messenger', label: 'Messenger' },
  { value: 'audience_network', label: 'Audience Network' },
]

// 向导步骤定义
const WIZARD_STEPS = [
  { key: '1', title: '选择素材', icon: <ThunderboltOutlined /> },
  { key: '2', title: 'Campaign 设置', icon: <SettingOutlined /> },
  { key: '3', title: '定向与版位', icon: <GlobalOutlined /> },
  { key: '4', title: '广告文案', icon: <FileTextOutlined /> },
]

// 预置模板类型
interface CampaignPreset {
  name: string
  campaignObjective: string
  budgetStrategy: 'CBO' | 'ABO'
  dailyBudget: number
  bidStrategy: string
  costPerResultGoal: number | null
  conversionLocation: string
  optimizationGoal: string
  pixelId: string
  conversionEvent: string
  ageMin: number
  ageMax: number
  targetGender: number
  deviceTarget: string
  osTarget: string
  publisherPlatforms: string[]
  placementType: 'automatic' | 'manual'
  selectedCountryCodes: string[]
}

// ===================== 主组件 =====================

const Campaigns: React.FC = () => {
  const navigate = useNavigate()
  // 列表数据
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Campaign[]>([])
  const [filterStatus, setFilterStatus] = useState<string | undefined>()
  const [filterCountry, setFilterCountry] = useState<string | undefined>()
  const [searchName, setSearchName] = useState('')

  // 批量选择
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  // 推送到 Meta 进度弹窗
  const [pushModalOpen, setPushModalOpen] = useState(false)
  const [pushItems, setPushItems] = useState<Array<{
    campaignId: string
    campaignName?: string
    status: 'pending' | 'pushing' | 'success' | 'failed' | 'skipped' | 'waiting'
    error?: string
    metaCampaignId?: string
    adsPushed?: number
    adsFailed?: number
  }>>([])
  const [pushDone, setPushDone] = useState(false)

  // 操作 loading 状态（防止重复点击 + 显示执行中）
  const [actionLoading, setActionLoading] = useState<{
    toggleStatus: Record<string, boolean>
    batchPause: boolean
    batchActivate: boolean
    batchDelete: boolean
    rePush: boolean
    syncStatus: boolean
  }>({
    toggleStatus: {},
    batchPause: false,
    batchActivate: false,
    batchDelete: false,
    rePush: false,
    syncStatus: false,
  })

  // 创建弹窗
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('1')

  // 模板数据
  const [countryTemplates, setCountryTemplates] = useState<CountryTemplate[]>([])
  const [, setAudienceTemplates] = useState<AudienceTemplate[]>([])

  // 国家文案库
  const [countryCopies, setCountryCopies] = useState<CountryCopy[]>([])

  // 素材选择
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [selectedCreativeIds, setSelectedCreativeIds] = useState<string[]>([])

  // 结构设置
  const [structureMode, setStructureMode] = useState<'1-1-1' | '1-1-N'>('1-1-1')
  const [adsPerAdSet, setAdsPerAdSet] = useState<number>(3)

  // Meta 推送
  const [pushToMeta, setPushToMeta] = useState<boolean>(true)

  // 国家选择
  const [selectedCountryCodes, setSelectedCountryCodes] = useState<string[]>([])

  // 文案输入模式
  const [copyInputMode, setCopyInputMode] = useState<'manual' | 'library'>('manual')

  // Campaign 设置
  const [campaignAlias, setCampaignAlias] = useState('')
  const [campaignObjective, setCampaignObjective] = useState('OUTCOME_SALES')
  const [budgetStrategy, setBudgetStrategy] = useState<'CBO' | 'ABO'>('CBO')
  const [dailyBudget, setDailyBudget] = useState(10)
  const [bidStrategy, setBidStrategy] = useState('LOWEST_COST_WITHOUT_CAP')
  const [costPerResultGoal, setCostPerResultGoal] = useState<number | null>(null)
  const [landingUrl, setLandingUrl] = useState('')

  // 转化设置
  const [conversionLocation, setConversionLocation] = useState('WEBSITE')
  const [optimizationGoal, setOptimizationGoal] = useState('OFFSITE_CONVERSIONS')
  const [pixelId, setPixelId] = useState('')
  const [conversionEvent, setConversionEvent] = useState('PURCHASE')

  // 定向设置
  const [ageMin, setAgeMin] = useState(18)
  const [ageMax, setAgeMax] = useState(65)
  const [targetGender, setTargetGender] = useState(0)
  const [deviceTarget, setDeviceTarget] = useState('all')
  const [osTarget, setOsTarget] = useState('all')
  const [publisherPlatforms, setPublisherPlatforms] = useState<string[]>(['facebook', 'instagram'])
  const [placementType, setPlacementType] = useState<'automatic' | 'manual'>('automatic')

  // 预置模板
  const [savedPresets, setSavedPresets] = useState<CampaignPreset[]>(() => {
    try {
      const saved = window.localStorage.getItem('autoads_campaign_presets')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [presetModalOpen, setPresetModalOpen] = useState(false)
  const [presetName, setPresetName] = useState('')

  // 文案库选择 — 改为按点击顺序的数组（支持多选 + 排序）
  const [selectedPTCopyIds, setSelectedPTCopyIds] = useState<string[]>([])
  const [selectedHLCopyIds, setSelectedHLCopyIds] = useState<string[]>([])

  // 手动文案
  const [manualPrimaryTexts, setManualPrimaryTexts] = useState<string[]>([])
  const [manualHeadlines, setManualHeadlines] = useState<string[]>([])
  const [manualCtaType, setManualCtaType] = useState('LEARN_MORE')
  const [manualPTInput, setManualPTInput] = useState('')
  const [manualHLInput, setManualHLInput] = useState('')

  // 详情抽屉
  const [detailDrawer, setDetailDrawer] = useState(false)
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null)

  // ===================== 数据加载 =====================

  const [syncing, setSyncing] = useState(false)

  const fetchCampaigns = async () => {
    setLoading(true)
    try {
      const response: any = await campaignsApi.list({
        status: filterStatus,
        countryCode: filterCountry,
        limit: 100,
      })
      setData(response.data || [])
    } catch {
      message.error('获取广告列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 同步状态：先从 Meta 拉取最新状态，再加载列表
  const fetchCampaignsWithSync = async () => {
    setLoading(true)
    try {
      // 先同步状态
      await campaignsApi.syncStatus()
      // 再加载列表
      const response: any = await campaignsApi.list({
        status: filterStatus,
        countryCode: filterCountry,
        limit: 100,
      })
      setData(response.data || [])
    } catch {
      message.error('获取广告列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSyncStatus = async () => {
    setActionLoading(prev => ({ ...prev, syncStatus: true }))
    setSyncing(true)
    try {
      const response: any = await campaignsApi.syncStatus()
      const result = response.data
      const parts: string[] = []
      if (result.syncedCampaigns > 0) parts.push(`${result.syncedCampaigns} 个 Campaign`)
      if (result.syncedAdSets > 0) parts.push(`${result.syncedAdSets} 个 AdSet`)
      if (result.syncedAds > 0) parts.push(`${result.syncedAds} 个 Ad`)
      if (parts.length > 0) {
        message.success(`状态已同步：${parts.join('，')} 更新`)
      } else {
        message.info('状态已是最新，无需更新')
      }
      fetchCampaigns()
    } catch (err: any) {
      handleActionError(err, '状态同步')
    } finally {
      setSyncing(false)
      setActionLoading(prev => ({ ...prev, syncStatus: false }))
    }
  }

  const fetchTemplates = async () => {
    try {
      const response: any = await campaignsApi.getTemplates()
      setCountryTemplates(response.data?.countryTemplates || [])
      setAudienceTemplates(response.data?.audienceTemplates || [])
    } catch (error) {
      console.error('获取模板失败', error)
    }
  }

  const fetchCountryCopies = async () => {
    try {
      const response: any = await campaignsApi.getCountryCopies({ limit: 200 })
      setCountryCopies(response.data || [])
    } catch (error) {
      console.error('获取国家文案失败', error)
    }
  }

  const fetchCreatives = async () => {
    try {
      const response: any = await creativesApi.list({ limit: 100 })
      setCreatives(response.data || [])
    } catch (error) {
      console.error('获取素材失败', error)
    }
  }

  useEffect(() => {
    fetchCampaignsWithSync()
    fetchTemplates()
    fetchCountryCopies()
    fetchCreatives()
  }, [])

  useEffect(() => {
    fetchCampaigns()
  }, [filterStatus, filterCountry])

  // ===================== 按地区分组国家 =====================

  const countryByRegion = useMemo(() => {
    const map: Record<string, CountryTemplate[]> = {}
    for (const tpl of countryTemplates) {
      if (!map[tpl.region]) map[tpl.region] = []
      map[tpl.region].push(tpl)
    }
    return map
  }, [countryTemplates])

  // ===================== 国家选择逻辑 =====================

  const toggleCountry = (code: string) => {
    setSelectedCountryCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  const toggleRegion = (region: string) => {
    const regionCodes = (countryByRegion[region] || []).map(c => c.code)
    const allSelected = regionCodes.every(code => selectedCountryCodes.includes(code))
    if (allSelected) {
      setSelectedCountryCodes(prev => prev.filter(c => !regionCodes.includes(c)))
    } else {
      const toAdd = regionCodes.filter(code => !selectedCountryCodes.includes(code))
      setSelectedCountryCodes(prev => [...prev, ...toAdd])
    }
  }

  // ===================== 预置模板 =====================

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      message.warning('请输入模板名称')
      return
    }
    const preset: CampaignPreset = {
      name: presetName.trim(),
      campaignObjective, budgetStrategy, dailyBudget, bidStrategy, costPerResultGoal,
      conversionLocation, optimizationGoal, pixelId, conversionEvent,
      ageMin, ageMax, targetGender, deviceTarget, osTarget,
      publisherPlatforms, placementType, selectedCountryCodes,
    }
    const updated = [...savedPresets, preset]
    setSavedPresets(updated)
    try { window.localStorage.setItem('autoads_campaign_presets', JSON.stringify(updated)) } catch {}
    setPresetModalOpen(false)
    setPresetName('')
    message.success(`模板「${preset.name}」已保存`)
  }

  const handleLoadPreset = (presetIdx: number) => {
    const p = savedPresets[presetIdx]
    if (!p) return
    setCampaignObjective(p.campaignObjective)
    setBudgetStrategy(p.budgetStrategy)
    setDailyBudget(p.dailyBudget)
    setBidStrategy(p.bidStrategy)
    setCostPerResultGoal(p.costPerResultGoal)
    setConversionLocation(p.conversionLocation)
    setOptimizationGoal(p.optimizationGoal)
    setPixelId(p.pixelId)
    setConversionEvent(p.conversionEvent)
    setAgeMin(p.ageMin)
    setAgeMax(p.ageMax)
    setTargetGender(p.targetGender)
    setDeviceTarget(p.deviceTarget)
    setOsTarget(p.osTarget)
    setPublisherPlatforms(p.publisherPlatforms)
    setPlacementType(p.placementType)
    setSelectedCountryCodes(p.selectedCountryCodes || [])
    message.success(`已加载模板「${p.name}」`)
  }

  const handleDeletePreset = (idx: number) => {
    const updated = savedPresets.filter((_, i) => i !== idx)
    setSavedPresets(updated)
    try { window.localStorage.setItem('autoads_campaign_presets', JSON.stringify(updated)) } catch {}
    message.success('模板已删除')
  }

  // ===================== 关闭/重置弹窗 =====================

  // 有序数组 toggle：已选则取消，未选则追加到末尾
  const toggleArrayItem = <T,>(arr: T[], item: T): T[] => {
    const idx = arr.indexOf(item)
    if (idx >= 0) return arr.filter((_, i) => i !== idx)
    return [...arr, item]
  }

  const handleCloseCreateModal = () => {
    setCreateModalOpen(false)
    setSelectedCreativeIds([])
    setSelectedCountryCodes([])
    setActiveTab('1')
    setStructureMode('1-1-1')
    setCopyInputMode('manual')
    setCampaignObjective('OUTCOME_SALES')
    setBudgetStrategy('CBO')
    setDailyBudget(10)
    setBidStrategy('LOWEST_COST_WITHOUT_CAP')
    setCostPerResultGoal(null)
    setLandingUrl('')
    setConversionLocation('WEBSITE')
    setOptimizationGoal('OFFSITE_CONVERSIONS')
    setPixelId('')
    setConversionEvent('PURCHASE')
    setAgeMin(18)
    setAgeMax(65)
    setTargetGender(0)
    setDeviceTarget('all')
    setOsTarget('all')
    setPublisherPlatforms(['facebook', 'instagram'])
    setPlacementType('automatic')
    setManualPrimaryTexts([])
    setManualHeadlines([])
    setManualCtaType('LEARN_MORE')
    setManualPTInput('')
    setManualHLInput('')
    setSelectedPTCopyIds([])
    setSelectedHLCopyIds([])
  }

  // ===================== 创建广告 =====================

  const handleStartCreate = async () => {
    // 手动校验
    if (selectedCreativeIds.length === 0) {
      message.warning('请至少选择一个素材')
      setActiveTab('1')
      return
    }
    if (!landingUrl || !landingUrl.startsWith('http')) {
      message.warning('请输入有效的落地页链接')
      setActiveTab('2')
      return
    }
    if (selectedCountryCodes.length === 0) {
      message.warning('请至少选择一个投放国家')
      setActiveTab('3')
      return
    }
    if (structureMode === '1-1-N' && selectedCreativeIds.length < 1) {
      message.warning('请至少选择 1 个素材')
      setActiveTab('1')
      return
    }

    // 获取文案 — 支持多条文案按点击顺序分配
    let finalPTs: string[] = []
    let finalHLs: string[] = []
    let finalCTA = manualCtaType

    if (copyInputMode === 'manual') {
      // 手动模式：收集所有输入的文案
      finalPTs = manualPrimaryTexts.filter(t => t.trim())
      finalHLs = manualHeadlines.filter(t => t.trim())
      if (finalPTs.length === 0 && finalHLs.length === 0) {
        message.warning('请至少输入一条广告文案')
        setActiveTab('4')
        return
      }
    } else {
      // 文案库模式：按点击顺序收集
      finalPTs = selectedPTCopyIds
        .map(id => countryCopies.find(c => c.id === id)?.primaryText)
        .filter(Boolean) as string[]
      finalHLs = selectedHLCopyIds
        .map(id => countryCopies.find(c => c.id === id)?.headline)
        .filter(Boolean) as string[]
      // CTA 取第一条选中的文案
      const firstPTCopy = selectedPTCopyIds.length > 0 ? countryCopies.find(c => c.id === selectedPTCopyIds[0]) : undefined
      const firstHLCopy = selectedHLCopyIds.length > 0 ? countryCopies.find(c => c.id === selectedHLCopyIds[0]) : undefined
      finalCTA = firstPTCopy?.ctaType || firstHLCopy?.ctaType || 'LEARN_MORE'
      if (finalPTs.length === 0 && finalHLs.length === 0) {
        message.warning('请在文案库中至少选择一条 Primary Text 或 Headline')
        setActiveTab('4')
        return
      }
    }

    const payload: AutoCreatePayload = {
      creativeIds: selectedCreativeIds,
      countries: selectedCountryCodes.map(code => ({
        code,
        dailyBudget,
        audienceTemplate: 'T1',
      })),
      structure: structureMode,
      adsPerAdSet: structureMode === '1-1-N' ? adsPerAdSet : 1,
      audienceTemplate: 'T1',
      alias: campaignAlias || undefined,
      primaryTexts: finalPTs.length > 0 ? finalPTs : undefined,
      headlines: finalHLs.length > 0 ? finalHLs : undefined,
      landingUrl,
      ctaType: finalCTA,
      pushToMeta,
      campaignObjective,
      budgetStrategy,
      bidStrategy,
      costPerResultGoal: costPerResultGoal || undefined,
      conversionLocation,
      optimizationGoal,
      pixelId: pixelId || undefined,
      conversionEvent,
      ageMin,
      ageMax,
      targetGender: targetGender || undefined,
      devicePlatforms: deviceTarget === 'all' ? undefined : [deviceTarget],
      publisherPlatforms: placementType === 'automatic' ? undefined : publisherPlatforms,
      userOs: osTarget === 'all' ? undefined : [osTarget],
      placementType,
    }

    setCreateLoading(true)
    try {
      const response: any = await campaignsApi.autoCreate(payload)
      const result = response.data
      const metaPush = result.summary.metaPush

      // 如果开启了推 Meta 且配置了，需要确认推送成功
      if (pushToMeta && metaPush?.configured) {
        const pushResult = result.metaPushResults?.[0]
        if (pushResult && pushResult.status === 'success' && pushResult.adsPushed > 0) {
          message.success(`成功创建并推送到 Facebook：${result.summary.totalCreated} 个 Campaign，${pushResult.adsPushed} 个 Ads（广告组/广告已开启）`)
        } else if (pushResult && pushResult.status === 'success') {
          message.warning(`Campaign 创建成功，但 Ad 推送失败（${pushResult.adsFailed} 个失败）。请检查 Meta 广告账户设置。`)
        } else {
          message.error('Campaign 创建成功，但推送到 Facebook 失败')
        }
      } else if (pushToMeta && !metaPush?.configured) {
        message.warning(`广告已创建，但 Meta API 未配置，仅在本地创建`)
      } else {
        message.success(`成功创建 ${result.summary.totalCreated} 个广告活动（已暂停状态）`)
      }
      handleCloseCreateModal()
      fetchCampaigns()
    } catch (error: any) {
      const msg = error.response?.data?.error || '创建广告失败'
      message.error(msg)
    } finally {
      setCreateLoading(false)
    }
  }

  // ===================== 操作 =====================

  // 通用错误处理：区分鉴权错误与其他错误
  const handleActionError = (err: any, actionName: string) => {
    const errMsg = err?.response?.data?.error || err?.message || '未知错误'
    const isAuthError =
      err?.response?.status === 401 ||
      errMsg.toLowerCase().includes('token') ||
      errMsg.toLowerCase().includes('access') ||
      errMsg.toLowerCase().includes('oauth') ||
      errMsg.toLowerCase().includes('授权') ||
      errMsg.toLowerCase().includes('鉴权')
    if (isAuthError) {
      message.error({
        content: `鉴权失败：Meta Access Token 已过期或无效，请前往「设置」页面重新授权`,
        duration: 6,
      })
    } else {
      message.error(`${actionName}失败：${errMsg}`)
    }
  }

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    setActionLoading(prev => ({ ...prev, toggleStatus: { ...prev.toggleStatus, [id]: true } }))
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    try {
      await campaignsApi.updateStatus(id, newStatus)
      message.success(newStatus === 'active' ? '广告已恢复投放' : '广告已暂停')
      fetchCampaigns()
    } catch (err: any) {
      handleActionError(err, '状态更新')
    } finally {
      setActionLoading(prev => ({ ...prev, toggleStatus: { ...prev.toggleStatus, [id]: false } }))
    }
  }

  const handleDelete = async (id: string) => {
    setActionLoading(prev => ({ ...prev, toggleStatus: { ...prev.toggleStatus, [id]: true } }))
    try {
      await campaignsApi.delete(id)
      message.success('广告活动已删除')
      fetchCampaigns()
    } catch (err: any) {
      handleActionError(err, '删除')
    } finally {
      setActionLoading(prev => ({ ...prev, toggleStatus: { ...prev.toggleStatus, [id]: false } }))
    }
  }

  const handleDuplicate = async (id: string) => {
    setActionLoading(prev => ({ ...prev, toggleStatus: { ...prev.toggleStatus, [id]: true } }))
    try {
      await campaignsApi.duplicate(id)
      message.success('广告活动已复制')
      fetchCampaigns()
    } catch (err: any) {
      handleActionError(err, '复制')
    } finally {
      setActionLoading(prev => ({ ...prev, toggleStatus: { ...prev.toggleStatus, [id]: false } }))
    }
  }

  // ===================== 批量操作 =====================

  const handleBatchPause = async () => {
    if (selectedRowKeys.length === 0) return
    setActionLoading(prev => ({ ...prev, batchPause: true }))
    try {
      await campaignsApi.batchUpdateStatus(selectedRowKeys as string[], 'paused')
      message.success(`已暂停 ${selectedRowKeys.length} 个广告活动`)
      setSelectedRowKeys([])
      fetchCampaigns()
    } catch (err: any) {
      handleActionError(err, '批量暂停')
    } finally {
      setActionLoading(prev => ({ ...prev, batchPause: false }))
    }
  }

  const handleBatchActivate = async () => {
    if (selectedRowKeys.length === 0) return
    setActionLoading(prev => ({ ...prev, batchActivate: true }))
    try {
      await campaignsApi.batchUpdateStatus(selectedRowKeys as string[], 'active')
      message.success(`已开启 ${selectedRowKeys.length} 个广告活动`)
      setSelectedRowKeys([])
      fetchCampaigns()
    } catch (err: any) {
      handleActionError(err, '批量开启')
    } finally {
      setActionLoading(prev => ({ ...prev, batchActivate: false }))
    }
  }

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return
    setActionLoading(prev => ({ ...prev, batchDelete: true }))
    try {
      await campaignsApi.batchDelete(selectedRowKeys as string[])
      message.success(`已删除 ${selectedRowKeys.length} 个广告活动`)
      setSelectedRowKeys([])
      fetchCampaigns()
    } catch (err: any) {
      handleActionError(err, '批量删除')
    } finally {
      setActionLoading(prev => ({ ...prev, batchDelete: false }))
    }
  }

  // 重新推送到 Meta（针对未推送成功的 Campaign）—— SSE 实时进度
  const handleRePush = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要重新推送的广告活动')
      return
    }

    setActionLoading(prev => ({ ...prev, rePush: true }))
    const ids = selectedRowKeys as string[]
    // 初始化进度列表
    setPushItems(ids.map(id => ({ campaignId: id, status: 'pending' })))
    setPushDone(false)
    setPushModalOpen(true)

    try {
      const token = localStorage.getItem('autoads_access_token')
      const response = await fetch('/api/campaigns/re-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ campaignIds: ids }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        const errMsg = errData.error || '推送请求失败'
        const isAuthError =
          response.status === 401 ||
          errMsg.toLowerCase().includes('token') ||
          errMsg.toLowerCase().includes('access') ||
          errMsg.toLowerCase().includes('授权') ||
          errMsg.toLowerCase().includes('鉴权')
        if (isAuthError) {
          message.error({
            content: `鉴权失败：Meta Access Token 已过期或无效，请前往「设置」页面重新授权`,
            duration: 6,
          })
        } else {
          message.error(errMsg)
        }
        setPushDone(true)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        message.error('浏览器不支持流式读取')
        setPushDone(true)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (eventType === 'progress') {
                setPushItems(prev => prev.map((item, idx) =>
                  idx === data.index ? {
                    ...item,
                    campaignName: data.campaignName || item.campaignName,
                    status: data.status as any,
                    error: data.error,
                    metaCampaignId: data.metaCampaignId,
                    adsPushed: data.adsPushed,
                    adsFailed: data.adsFailed,
                  } : item
                ))
              } else if (eventType === 'waiting') {
                setPushItems(prev => prev.map((item, idx) =>
                  idx === data.index ? { ...item, status: 'waiting' } : item
                ))
              } else if (eventType === 'done') {
                setPushDone(true)
                const s = data.summary
                if (s.failed > 0) {
                  message.warning({
                    content: `推送完成：${s.success} 成功，${s.failed} 失败`,
                    duration: 4,
                  })
                } else {
                  message.success({
                    content: `推送完成：全部 ${s.success} 个成功`,
                    duration: 4,
                  })
                }
                setSelectedRowKeys([])
                fetchCampaigns()
              }
            } catch {}
            eventType = ''
          }
        }
      }
    } catch (error: any) {
      const errMsg = error.message || '未知错误'
      const isAuthError =
        errMsg.toLowerCase().includes('token') ||
        errMsg.toLowerCase().includes('access') ||
        errMsg.toLowerCase().includes('授权') ||
        errMsg.toLowerCase().includes('鉴权')
      if (isAuthError) {
        message.error({
          content: `鉴权失败：Meta Access Token 已过期或无效，请前往「设置」页面重新授权`,
          duration: 6,
        })
      } else {
        message.error('推送请求失败：' + errMsg)
      }
      setPushDone(true)
    } finally {
      setActionLoading(prev => ({ ...prev, rePush: false }))
    }
  }

  const showDetail = (campaign: Campaign) => {
    setDetailCampaign(campaign)
    setDetailDrawer(true)
  }

  // ===================== 过滤数据 =====================

  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (searchName && !item.name.toLowerCase().includes(searchName.toLowerCase())) return false
      return true
    })
  }, [data, searchName])

  // ===================== 汇总统计 =====================

  const stats = useMemo(() => {
    const active = data.filter(c => c.status === 'active').length
    const paused = data.filter(c => c.status === 'paused').length
    const failed = data.filter(c => (c as any).pushStatus === 'failed').length
    const authFailed = data.filter(c => (c as any).pushStatus === 'auth_failed').length
    const totalBudget = data
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + (c.budgetAmount || 0), 0)
    const totalAdSets = data.reduce((sum, c) => sum + (c._count?.adSets || 0), 0)
    return { 
      total: data.length, 
      active, 
      paused, 
      failed, 
      authFailed, 
      totalBudget, 
      totalAdSets 
    }
  }, [data])

  // ===================== 预览 =====================

  const previewCount = useMemo(() => {
    if (structureMode === '1-1-1') {
      return selectedCreativeIds.length * selectedCountryCodes.length
    }
    // 1-1-N: 每 N 个素材一组，每组一个 Campaign，每个国家都独立
    const groupCount = selectedCreativeIds.length > 0 ? Math.ceil(selectedCreativeIds.length / adsPerAdSet) : 0
    return groupCount * selectedCountryCodes.length
  }, [structureMode, selectedCreativeIds.length, selectedCountryCodes.length, adsPerAdSet])

  const previewAdsCount = useMemo(() => {
    if (structureMode === '1-1-1') {
      return selectedCreativeIds.length * selectedCountryCodes.length
    }
    // 1-1-N: 所有素材都会被用到，每个国家一套
    return selectedCreativeIds.length * selectedCountryCodes.length
  }, [structureMode, selectedCreativeIds.length, selectedCountryCodes.length, adsPerAdSet])

  const previewBudget = useMemo(() => {
    if (structureMode === '1-1-1') {
      return dailyBudget * selectedCreativeIds.length * selectedCountryCodes.length
    }
    // 1-1-N: 每个 Campaign 一份预算
    const groupCount = selectedCreativeIds.length > 0 ? Math.ceil(selectedCreativeIds.length / adsPerAdSet) : 0
    return dailyBudget * groupCount * selectedCountryCodes.length
  }, [dailyBudget, structureMode, selectedCreativeIds.length, selectedCountryCodes.length, adsPerAdSet])

  // 文案库分离 PT 和 HL
  const ptCopies = useMemo(() => countryCopies.filter(c => c.isActive && c.primaryText), [countryCopies])
  const hlCopies = useMemo(() => countryCopies.filter(c => c.isActive && c.headline), [countryCopies])

  // ===================== 表格列定义 =====================

  const columns: ColumnsType<Campaign> = [
    {
      title: '广告活动',
      dataIndex: 'name',
      key: 'name',
      width: 260,
      ellipsis: true,
      render: (name, record) => (
        <div>
          <a onClick={() => navigate(`/campaigns/${record.id}`)} style={{ fontWeight: 500 }}>{name}</a>
          {record.isAutoCreated && (
            <Tag color="blue" style={{ marginLeft: 6, fontSize: 10 }}>自动</Tag>
          )}
          {record.countryRadarConfig?.structure && (
            <Tag color="purple" style={{ marginLeft: 6, fontSize: 10 }}>
              {record.countryRadarConfig.structure}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: '国家',
      key: 'country',
      width: 100,
      render: (_, record) => {
        const config = record.countryRadarConfig as any
        if (config?.countryCode) {
          return <Tag color="cyan" icon={<GlobalOutlined />}>{config.countryName || config.countryCode}</Tag>
        }
        return <span style={{ color: '#999' }}>--</span>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const config = statusMap[status] || { color: 'default', text: status }
        return <Badge status={config.color as any} text={config.text} />
      },
    },
    {
      title: '推送状态',
      key: 'pushStatus',
      width: 120,
      render: (_: any, record: Campaign) => {
        const pushStatus = (record as any).pushStatus || 'pending'
        const pushStatusMap: Record<string, { color: string; text: string }> = {
          pending: { color: 'default', text: '未推送' },
          pushing: { color: 'processing', text: '推送中...' },
          success: { color: 'success', text: '已推送' },
          failed: { color: 'error', text: '推送失败' },
          auth_failed: { color: 'error', text: '需重新授权' },
          skipped: { color: 'warning', text: '已跳过' },
        }
        const cfg = pushStatusMap[pushStatus] || pushStatusMap.pending
        const pushTime = record.metaCampaignId ? dayjs(record.updatedAt).format('HH:mm') : ''
        
        return (
          <Tooltip
            title={
              pushStatus === 'success' && (record as any).metaCampaignId
                ? `Meta ID: ${(record as any).metaCampaignId} (推送于 ${dayjs(record.updatedAt).format('YYYY-MM-DD HH:mm:ss')})`
                : pushStatus === 'auth_failed'
                  ? 'Access Token 已失效，请前往「设置」页面重新授权'
                  : pushStatus === 'failed' && (record as any).metaPushError
                    ? `错误: ${(record as any).metaPushError}`
                    : undefined
            }
          >
            <Space size={4} direction="vertical">
              <Badge status={cfg.color as any} text={`${cfg.text}${pushTime ? ' ' + pushTime : ''}`} />
              {pushStatus === 'auth_failed' && (
                <Button 
                  type="link" 
                  size="small" 
                  icon={<GlobalOutlined />} 
                  style={{ padding: 0, height: 'auto', fontSize: 12 }}
                  onClick={() => navigate('/settings')}
                >
                  去授权
                </Button>
              )}
            </Space>
          </Tooltip>
        )
      },
    },
    {
      title: '创建者',
      dataIndex: 'owner',
      key: 'owner',
      width: 100,
      render: (owner: any) => owner ? <Tag color="geekblue">{owner.displayName || owner.username}</Tag> : <span>-</span>
    },
    {
      title: '日预算',
      dataIndex: 'budgetAmount',
      key: 'budget',
      width: 90,
      render: (amount) => `$${(amount || 0).toFixed(0)}/天`,
      sorter: (a, b) => (a.budgetAmount || 0) - (b.budgetAmount || 0),
    },
    {
      title: '受众',
      key: 'audience',
      width: 100,
      render: (_, record) => {
        const firstAdSet = record.adSets?.[0]
        const tpl = firstAdSet?.audienceTemplate
        return tpl ? <Tag>{audienceLabels[tpl] || tpl}</Tag> : '--'
      },
    },
    {
      title: '广告组',
      key: 'adSetCount',
      width: 70,
      render: (_, record) => record._count?.adSets || record.adSets?.length || 0,
    },
    {
      title: '广告数',
      key: 'adCount',
      width: 70,
      render: (_, record) => {
        if (record.adSets) {
          return record.adSets.reduce((sum, as_) => sum + (as_._count?.ads || as_.ads?.length || 0), 0)
        }
        return 0
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (date) => date ? dayjs(date).format('MM-DD HH:mm') : '-',
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      defaultSortOrder: 'descend',
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_, record) => {
        const isLoading = actionLoading.toggleStatus[record.id]
        return (
          <Space size={0}>
            <Tooltip title="查看详情">
              <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)} disabled={isLoading} />
            </Tooltip>
            <Tooltip title="数据分析">
              <Button type="link" size="small" icon={<BarChartOutlined />} onClick={() => navigate(`/campaigns/${record.id}`)} disabled={isLoading} />
            </Tooltip>
            <Tooltip title={record.status === 'active' ? '暂停' : '恢复投放'}>
              <Button
                type="link"
                size="small"
                loading={isLoading}
                icon={record.status === 'active' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={() => handleToggleStatus(record.id, record.status)}
                disabled={isLoading}
                style={{ color: record.status === 'active' ? '#faad14' : '#52c41a' }}
              />
            </Tooltip>
            <Tooltip title="复制">
              <Button type="link" size="small" loading={isLoading} icon={<CopyOutlined />} onClick={() => handleDuplicate(record.id)} disabled={isLoading} />
            </Tooltip>
            <Popconfirm
              title="确认删除此广告活动？"
              description="将同时删除关联的广告组和广告"
              onConfirm={() => handleDelete(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small" loading={isLoading} icon={<DeleteOutlined />} danger disabled={isLoading} />
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  // ===================== 渲染 =====================

  return (
    <div className="page-container">
      {/* 头部 */}
      <div className="card-header">
        <h2 style={{ margin: 0 }}>广告活动</h2>
        <Space>
          <Tooltip title="从 Facebook 同步最新状态">
            <Button
              icon={<RocketOutlined />}
              loading={syncing}
              onClick={handleSyncStatus}
            >
              同步状态
            </Button>
          </Tooltip>
          <Button
            type="primary"
            icon={<RocketOutlined />}
            size="large"
            onClick={() => setCreateModalOpen(true)}
          >
            一键创建广告
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={5}>
          <Card size="small">
            <Statistic title="广告活动总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="投放中" value={stats.active} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="已暂停" value={stats.paused} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="活跃日预算" value={stats.totalBudget} prefix="$" suffix="/天" />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="总广告组" value={stats.totalAdSets} />
          </Card>
        </Col>
      </Row>

      {/* 筛选栏 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Input
            placeholder="搜索广告活动名称..."
            prefix={<SearchOutlined />}
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            allowClear
          />
        </Col>
        <Col span={4}>
          <Select
            placeholder="状态筛选"
            style={{ width: '100%' }}
            allowClear
            value={filterStatus}
            onChange={setFilterStatus}
          >
            <Select.Option value="active">投放中</Select.Option>
            <Select.Option value="paused">已暂停</Select.Option>
            <Select.Option value="draft">草稿</Select.Option>
            <Select.Option value="ended">已结束</Select.Option>
          </Select>
        </Col>
        <Col span={4}>
          <Select
            placeholder="国家筛选"
            style={{ width: '100%' }}
            allowClear
            showSearch
            value={filterCountry}
            onChange={setFilterCountry}
          >
            {countryTemplates.map(c => (
              <Select.Option key={c.code} value={c.code}>{c.name} ({c.code})</Select.Option>
            ))}
          </Select>
        </Col>
      </Row>

      {/* 批量操作栏 */}
      {selectedRowKeys.length > 0 && (
        <Alert
          message={
            <Space>
              <span>已选择 <strong>{selectedRowKeys.length}</strong> 个广告活动</span>
              <Button
                size="small"
                icon={<PlayCircleOutlined />}
                type="link"
                onClick={handleBatchActivate}
                loading={actionLoading.batchActivate}
                disabled={actionLoading.batchPause || actionLoading.batchDelete || actionLoading.rePush}
              >
                批量开启
              </Button>
              <Button
                size="small"
                icon={<PauseCircleOutlined />}
                type="link"
                onClick={handleBatchPause}
                loading={actionLoading.batchPause}
                disabled={actionLoading.batchActivate || actionLoading.batchDelete || actionLoading.rePush}
              >
                批量暂停
              </Button>
              <Popconfirm
                title={`确认删除 ${selectedRowKeys.length} 个广告活动？`}
                description="将同时删除关联的广告组和广告，此操作不可恢复"
                onConfirm={handleBatchDelete}
                okText="确认删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                disabled={actionLoading.batchActivate || actionLoading.batchPause || actionLoading.batchDelete || actionLoading.rePush}
              >
                <Button
                  size="small"
                  icon={<DeleteOutlined />}
                  type="link"
                  danger
                  loading={actionLoading.batchDelete}
                  disabled={actionLoading.batchActivate || actionLoading.batchPause || actionLoading.rePush}
                >
                  批量删除
                </Button>
              </Popconfirm>
              <Button
                size="small"
                icon={<RocketOutlined />}
                type="link"
                onClick={handleRePush}
                loading={actionLoading.rePush}
                disabled={actionLoading.batchActivate || actionLoading.batchPause || actionLoading.batchDelete}
              >
                推送到 Meta
              </Button>
              <Button size="small" type="link" onClick={() => setSelectedRowKeys([])} disabled={actionLoading.batchActivate || actionLoading.batchPause || actionLoading.batchDelete || actionLoading.rePush}>取消选择</Button>
            </Space>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 推送失败提醒 */}
      {(stats.failed > 0 || stats.authFailed > 0) && (
        <Alert
          message={
            <Space>
              <span>
                检测到有 <strong>{stats.failed + stats.authFailed}</strong> 个广告活动推送失败
                {stats.authFailed > 0 && `（其中 ${stats.authFailed} 个为鉴权失效）`}
              </span>
              <Button 
                size="small" 
                type="primary" 
                danger 
                ghost 
                icon={<ThunderboltOutlined />}
                onClick={() => {
                  const failedIds = data
                    .filter(c => (c as any).pushStatus === 'failed' || (c as any).pushStatus === 'auth_failed')
                    .map(c => c.id)
                  setSelectedRowKeys(failedIds)
                  message.info(`已选中 ${failedIds.length} 个失败的任务，请点击下方“推送到 Meta”重试`)
                }}
              >
                选中所有失败项
              </Button>
              {stats.authFailed > 0 && (
                <Button size="small" icon={<SettingOutlined />} onClick={() => navigate('/settings')}>
                  前往设置重新授权
                </Button>
              )}
            </Space>
          }
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 广告列表 */}
      <Table
        columns={columns}
        dataSource={filteredData}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        size="small"
        scroll={{ x: 1100 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
      />

      {/* ===================== 创建广告弹窗 ===================== */}
      <Modal
        title={<Space><RocketOutlined /><span>一键创建广告活动</span></Space>}
        open={createModalOpen}
        onCancel={createLoading ? undefined : handleCloseCreateModal}
        footer={null}
        width={960}
        styles={{ body: { padding: 0 } }}
        closable={!createLoading}
        maskClosable={!createLoading}
      >
        {/* ---- 创建中遮罩层 ---- */}
        {createLoading && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(255,255,255,0.85)', zIndex: 100,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRadius: '0 0 8px 8px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#1890ff' }}>正在创建广告</div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>正在推送到 Facebook 广告账户，请稍候...</div>
              <div style={{ width: 300 }}>
                <div style={{
                  height: 6, borderRadius: 3, background: '#e8e8e8', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 3, width: '60%',
                    background: 'linear-gradient(90deg, #1890ff, #69c0ff)',
                    animation: 'loadingBar 1.5s ease-in-out infinite',
                  }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- 步骤导航（吸顶） ---- */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10, background: '#fff',
          padding: '12px 24px 0', borderBottom: '1px solid #f0f0f0',
        }}>
          <div style={{ display: 'flex' }}>
            {WIZARD_STEPS.map((step, idx) => {
              const isActive = activeTab === step.key
              let badge: React.ReactNode = null
              if (step.key === '1' && selectedCreativeIds.length > 0) badge = <Tag color="blue" style={{ marginLeft: 4, fontSize: 10, padding: '0 4px' }}>{selectedCreativeIds.length}</Tag>
              if (step.key === '3' && selectedCountryCodes.length > 0) badge = <Tag color="blue" style={{ marginLeft: 4, fontSize: 10, padding: '0 4px' }}>{selectedCountryCodes.length}</Tag>
              return (
                <div
                  key={step.key}
                  onClick={() => setActiveTab(step.key)}
                  style={{
                    flex: 1, padding: '10px 8px', textAlign: 'center', cursor: 'pointer',
                    borderBottom: isActive ? '2px solid #1890ff' : '2px solid transparent',
                    color: isActive ? '#1890ff' : '#666',
                    fontWeight: isActive ? 600 : 400, fontSize: 14, transition: 'all 0.2s',
                  }}
                >
                  <span style={{ marginRight: 4 }}>{step.icon}</span>
                  {step.title}
                  {badge}
                </div>
              )
            })}
          </div>
        </div>

        {/* ---- 内容区域 ---- */}
        <div style={{ padding: '16px 24px', maxHeight: '58vh', overflowY: 'auto', minHeight: 320 }}>

          {/* === Tab 1: 选择素材 === */}
          {activeTab === '1' && (
            <div>
              <Alert
                message={`已选择 ${selectedCreativeIds.length} 个素材${structureMode === '1-1-N' ? `（每 ${adsPerAdSet} 个一组，共 ${Math.ceil(selectedCreativeIds.length / adsPerAdSet)} 组）` : ''}`}
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
              />
              <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
                {creatives.length === 0 ? (
                  <Alert message="素材库为空，请先上传素材" type="warning" showIcon />
                ) : (
                  <Checkbox.Group
                    value={selectedCreativeIds}
                    onChange={(vals) => setSelectedCreativeIds(vals as string[])}
                    style={{ width: '100%' }}
                  >
                    <Row gutter={[8, 8]}>
                      {creatives.map((c) => (
                        <Col span={12} key={c.id}>
                          <Checkbox value={c.id} style={{ width: '100%' }}>
                            <Space size={8}>
                              <span style={{
                                display: 'inline-block', width: 18, textAlign: 'center', fontSize: 11,
                                color: selectedCreativeIds.includes(c.id) ? '#1890ff' : '#ccc',
                              }}>
                                {selectedCreativeIds.indexOf(c.id) >= 0 ? selectedCreativeIds.indexOf(c.id) + 1 : ''}
                              </span>
                              {c.type === 'image' ? (
                                <img
                                  src={c.fileUrl?.startsWith('http') ? c.fileUrl : `${API_BASE}${c.fileUrl}`}
                                  alt={c.name}
                                  style={{ width: 36, height: 28, objectFit: 'cover', borderRadius: 4, border: '1px solid #f0f0f0' }}
                                  onError={(e: any) => { e.target.style.display = 'none' }}
                                />
                              ) : (
                                <div style={{
                                  width: 36, height: 28, background: '#000', borderRadius: 4,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  position: 'relative', overflow: 'hidden'
                                }}>
                                  <video src={c.fileUrl?.startsWith('http') ? c.fileUrl : `${API_BASE}${c.fileUrl}`} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
                                  <PlayCircleOutlined style={{ color: '#fff', fontSize: 10, position: 'absolute' }} />
                                </div>
                              )}
                              <span style={{ fontSize: 13 }}>{c.name}</span>
                              {c.width && c.height && <Tag style={{ fontSize: 10, lineHeight: '16px' }}>{c.width}x{c.height}</Tag>}
                            </Space>
                          </Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </Checkbox.Group>
                )}
              </div>
            </div>
          )}

          {/* === Tab 2: Campaign 设置 === */}
          {activeTab === '2' && (
            <div>
              {/* 预置模板选择 */}
              {savedPresets.length > 0 && (
                <Card size="small" style={{ marginBottom: 16, background: '#fffbe6', border: '1px solid #ffe58f' }}>
                  <div style={{ fontWeight: 500, marginBottom: 8 }}>
                    <SaveOutlined style={{ marginRight: 6 }} />
                    快速加载预置模板
                  </div>
                  <Space wrap>
                    {savedPresets.map((p, idx) => (
                      <Tag
                        key={idx}
                        color="gold"
                        style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13 }}
                        onClick={() => handleLoadPreset(idx)}
                        closable
                        onClose={(e) => { e.stopPropagation(); handleDeletePreset(idx) }}
                      >
                        {p.name}
                      </Tag>
                    ))}
                  </Space>
                </Card>
              )}

              {/* 自定义标签 */}
              <Card title="自定义标签（可选）" size="small" style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 500, marginBottom: 6 }}>Campaign Alias（自定义标签）</div>
                  <Input
                    placeholder="如优化师姓名：amanda（不填则使用默认命名规则）"
                    value={campaignAlias}
                    onChange={(e) => setCampaignAlias(e.target.value.trim())}
                    style={{ width: '50%' }}
                    allowClear
                  />
                  <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                    填写后命名规则变为：<b>{campaignAlias || 'alias'}_国家代码_日期</b>，例如：{campaignAlias || 'amanda'}_PH_20260428
                  </div>
                </div>
              </Card>

              {/* Campaign 目标 */}
              <Card title="Campaign 目标与预算" size="small" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 500, marginBottom: 6 }}>Campaign Objective（广告目标）</div>
                      <Select
                        value={campaignObjective}
                        onChange={(val) => {
                          setCampaignObjective(val)
                          const goals = OPTIMIZATION_GOALS[val]
                          if (goals && goals.length > 0) setOptimizationGoal(goals[0].value)
                        }}
                        style={{ width: '100%' }}
                      >
                        {CAMPAIGN_OBJECTIVES.map(o => (
                          <Select.Option key={o.value} value={o.value}>
                            {o.label}
                            <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>{o.desc}</span>
                          </Select.Option>
                        ))}
                      </Select>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 500, marginBottom: 6 }}>Budget Strategy（预算策略）</div>
                      <Radio.Group value={budgetStrategy} onChange={(e) => setBudgetStrategy(e.target.value)}>
                        <Radio.Button value="CBO">Campaign 预算 (CBO)</Radio.Button>
                        <Radio.Button value="ABO">Ad Set 预算 (ABO)</Radio.Button>
                      </Radio.Group>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                        {budgetStrategy === 'CBO'
                          ? 'Advantage Campaign Budget — 系统自动在广告组间分配预算'
                          : '各广告组独立设置预算和出价策略'}
                      </div>
                    </div>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 500, marginBottom: 6 }}>Daily Budget（日预算）</div>
                      <InputNumber
                        value={dailyBudget}
                        onChange={(val) => setDailyBudget(val || 10)}
                        min={1}
                        max={10000}
                        prefix="$"
                        suffix="USD / 天"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 500, marginBottom: 6 }}>Bid Strategy（出价策略）</div>
                      <Select value={bidStrategy} onChange={setBidStrategy} style={{ width: '100%' }}>
                        {BID_STRATEGIES.map(b => (
                          <Select.Option key={b.value} value={b.value}>{b.label}</Select.Option>
                        ))}
                      </Select>
                    </div>
                  </Col>
                  <Col span={8}>
                    {(bidStrategy === 'COST_CAP' || bidStrategy === 'BID_CAP' || bidStrategy === 'MINIMUM_ROAS') && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 500, marginBottom: 6 }}>
                          {bidStrategy === 'MINIMUM_ROAS' ? 'Minimum ROAS' : 'Cost Per Result Goal'}
                        </div>
                        <InputNumber
                          value={costPerResultGoal}
                          onChange={setCostPerResultGoal}
                          min={0.01}
                          step={0.1}
                          prefix={bidStrategy === 'MINIMUM_ROAS' ? '' : '$'}
                          style={{ width: '100%' }}
                          placeholder={bidStrategy === 'MINIMUM_ROAS' ? '如: 2.0' : '如: 0.60'}
                        />
                      </div>
                    )}
                  </Col>
                </Row>
              </Card>

              {/* 转化设置 */}
              {(campaignObjective === 'OUTCOME_SALES' || campaignObjective === 'OUTCOME_LEADS') && (
                <Card title="Conversion 转化设置" size="small" style={{ marginBottom: 16 }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 500, marginBottom: 6 }}>Conversion Location</div>
                        <Select value={conversionLocation} onChange={setConversionLocation} style={{ width: '100%' }}>
                          <Select.Option value="WEBSITE">网站 (Website)</Select.Option>
                          <Select.Option value="APP">应用 (App)</Select.Option>
                          <Select.Option value="MESSAGING">即时通讯 (Messaging)</Select.Option>
                          <Select.Option value="CALLS">电话 (Calls)</Select.Option>
                        </Select>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 500, marginBottom: 6 }}>Performance Goal</div>
                        <Select value={optimizationGoal} onChange={setOptimizationGoal} style={{ width: '100%' }}>
                          {(OPTIMIZATION_GOALS[campaignObjective] || []).map(g => (
                            <Select.Option key={g.value} value={g.value}>{g.label}</Select.Option>
                          ))}
                        </Select>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 500, marginBottom: 6 }}>Conversion Event</div>
                        <Select value={conversionEvent} onChange={setConversionEvent} style={{ width: '100%' }}>
                          {CONVERSION_EVENTS.map(e => (
                            <Select.Option key={e.value} value={e.value}>{e.label}</Select.Option>
                          ))}
                        </Select>
                      </div>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 500, marginBottom: 6 }}>Dataset / Pixel</div>
                        <Input
                          value={pixelId}
                          onChange={(e) => setPixelId(e.target.value)}
                          placeholder="Pixel ID（如: 123456789012345）"
                          allowClear
                        />
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 500, marginBottom: 6 }}>Attribution Model</div>
                        <Select defaultValue="7d_click_1d_view" style={{ width: '100%' }}>
                          <Select.Option value="7d_click_1d_view">7天点击 + 1天浏览 (默认)</Select.Option>
                          <Select.Option value="1d_click">1天点击</Select.Option>
                          <Select.Option value="7d_click">7天点击</Select.Option>
                        </Select>
                      </div>
                    </Col>
                  </Row>
                </Card>
              )}

              {/* 广告结构 */}
              <Card title="广告结构模式" size="small" style={{ marginBottom: 16 }}>
                <Radio.Group value={structureMode} onChange={(e) => setStructureMode(e.target.value)}>
                  <Radio.Button value="1-1-1">1-1-1（每个素材独立）</Radio.Button>
                  <Radio.Button value="1-1-N">1-1-N（多素材组合）</Radio.Button>
                </Radio.Group>
                <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
                  {structureMode === '1-1-1' ? (
                    <span><strong>1 Campaign : 1 Ad Set : 1 Ad</strong> — 创建数量 = 素材数 x 国家数</span>
                  ) : (
                    <span>
                      <strong>1 Campaign : 1 Ad Set : N Ads</strong> — 每个 Ad Set 的 N =
                      <InputNumber min={2} max={10} value={adsPerAdSet} onChange={(val) => setAdsPerAdSet(val || 3)} style={{ margin: '0 8px', width: 60 }} size="small" />
                      （需要至少 {adsPerAdSet} 个素材）
                    </span>
                  )}
                </div>
              </Card>

              {/* 落地页 */}
              <Card title="落地页链接（必填）" size="small">
                <Input
                  value={landingUrl}
                  onChange={(e) => setLandingUrl(e.target.value)}
                  placeholder="https://..."
                  size="large"
                />
              </Card>
            </div>
          )}

          {/* === Tab 3: 定向与版位 === */}
          {activeTab === '3' && (
            <div>
              {/* 受众定向 */}
              <Card title="Audience 受众定向" size="small" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 500, marginBottom: 6 }}>Minimum Age</div>
                      <InputNumber value={ageMin} onChange={(val) => setAgeMin(val || 18)} min={13} max={65} style={{ width: '100%' }} />
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 500, marginBottom: 6 }}>Maximum Age</div>
                      <InputNumber value={ageMax} onChange={(val) => setAgeMax(val || 65)} min={13} max={65} style={{ width: '100%' }} />
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 500, marginBottom: 6 }}>Gender</div>
                      <Radio.Group value={targetGender} onChange={(e) => setTargetGender(e.target.value)}>
                        <Radio.Button value={0}>不限</Radio.Button>
                        <Radio.Button value={1}>男</Radio.Button>
                        <Radio.Button value={2}>女</Radio.Button>
                      </Radio.Group>
                    </div>
                  </Col>
                </Row>
              </Card>

              {/* 设备与系统 */}
              <Card title="Devices 设备与系统" size="small" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 500, marginBottom: 6 }}>Device Platform</div>
                      <Radio.Group value={deviceTarget} onChange={(e) => setDeviceTarget(e.target.value)}>
                        <Radio.Button value="all">全部设备</Radio.Button>
                        <Radio.Button value="mobile">仅移动端</Radio.Button>
                        <Radio.Button value="desktop">仅桌面端</Radio.Button>
                      </Radio.Group>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 500, marginBottom: 6 }}>Operating System</div>
                      <Radio.Group value={osTarget} onChange={(e) => setOsTarget(e.target.value)}>
                        <Radio.Button value="all">全部系统</Radio.Button>
                        <Radio.Button value="Android">仅 Android</Radio.Button>
                        <Radio.Button value="iOS">仅 iOS</Radio.Button>
                      </Radio.Group>
                    </div>
                  </Col>
                </Row>
              </Card>

              {/* 版位 */}
              <Card title="Placements 版位设置" size="small" style={{ marginBottom: 16 }}>
                <Radio.Group value={placementType} onChange={(e) => setPlacementType(e.target.value)}>
                  <Radio.Button value="automatic">Advantage+ 自动版位（推荐）</Radio.Button>
                  <Radio.Button value="manual">手动选择版位</Radio.Button>
                </Radio.Group>
                {placementType === 'manual' && (
                  <div style={{ marginTop: 12 }}>
                    <Checkbox.Group value={publisherPlatforms} onChange={(vals) => setPublisherPlatforms(vals as string[])}>
                      <Row gutter={16}>
                        {PUBLISHER_PLATFORM_OPTIONS.map(p => (
                          <Col span={6} key={p.value}><Checkbox value={p.value}>{p.label}</Checkbox></Col>
                        ))}
                      </Row>
                    </Checkbox.Group>
                  </div>
                )}
              </Card>

              {/* 国家选择 */}
              <Card
                title={<span><GlobalOutlined style={{ marginRight: 6 }} />投放国家 {selectedCountryCodes.length > 0 && <Tag color="blue">{selectedCountryCodes.length} 个国家</Tag>}</span>}
                size="small"
                style={{ marginBottom: 16 }}
              >
                {Object.entries(countryByRegion).map(([region, countries]) => {
                  const allSelected = countries.every(c => selectedCountryCodes.includes(c.code))
                  const someSelected = countries.some(c => selectedCountryCodes.includes(c.code))
                  return (
                    <div key={region} style={{ marginBottom: 10 }}>
                      <Checkbox
                        checked={allSelected}
                        indeterminate={!allSelected && someSelected}
                        onChange={() => toggleRegion(region)}
                      >
                        <strong>{region}</strong>
                      </Checkbox>
                      <div style={{ paddingLeft: 24, marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {countries.map(c => {
                          const selected = selectedCountryCodes.includes(c.code)
                          return (
                            <Tag
                              key={c.code}
                              color={selected ? 'blue' : undefined}
                              style={{ cursor: 'pointer', userSelect: 'none' }}
                              onClick={() => toggleCountry(c.code)}
                            >
                              {c.name} ({c.code})
                            </Tag>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </Card>

              {/* 保存预置模板 */}
              <div style={{ textAlign: 'right' }}>
                <Button
                  icon={<SaveOutlined />}
                  onClick={() => setPresetModalOpen(true)}
                >
                  保存为预置模板
                </Button>
              </div>
            </div>
          )}

          {/* === Tab 4: 广告文案 === */}
          {activeTab === '4' && (
            <div>
              <Radio.Group
                value={copyInputMode}
                onChange={(e) => setCopyInputMode(e.target.value)}
                style={{ marginBottom: 16 }}
                buttonStyle="solid"
              >
                <Radio.Button value="manual">手动输入</Radio.Button>
                <Radio.Button value="library">使用文案库</Radio.Button>
              </Radio.Group>

              {copyInputMode === 'manual' ? (
                <>
                  <Row gutter={16}>
                    <Col span={12}>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 500, marginBottom: 6 }}>广告正文 (Primary Text) — 可添加多条</div>
                        <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
                          <Input.TextArea
                            rows={2}
                            maxLength={125}
                            showCount
                            placeholder="输入一条广告正文，最多 125 字符"
                            value={manualPTInput}
                            onChange={(e) => setManualPTInput(e.target.value)}
                            style={{ resize: 'none' }}
                          />
                          <Button
                            type="primary"
                            onClick={() => {
                              if (!manualPTInput.trim()) { message.warning('请输入内容'); return }
                              setManualPrimaryTexts(prev => [...prev, manualPTInput.trim()])
                              setManualPTInput('')
                            }}
                          >添加</Button>
                        </Space.Compact>
                        {manualPrimaryTexts.length > 0 && (
                          <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 8 }}>
                            {manualPrimaryTexts.map((text, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 4, padding: '4px 8px', background: '#f6ffed', borderRadius: 4 }}>
                                <Tag color="blue" style={{ fontSize: 10, marginRight: 8 }}>{idx + 1}</Tag>
                                <span style={{ flex: 1, fontSize: 12, lineHeight: 1.4 }}>{text}</span>
                                <Button
                                  type="link" size="small" danger
                                  style={{ padding: 0, fontSize: 12 }}
                                  onClick={() => setManualPrimaryTexts(prev => prev.filter((_, i) => i !== idx))}
                                >删除</Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 500, marginBottom: 6 }}>标题 (Headline) — 可添加多条</div>
                        <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
                          <Input
                            maxLength={25}
                            showCount
                            placeholder="输入一个标题，最多 25 字符"
                            value={manualHLInput}
                            onChange={(e) => setManualHLInput(e.target.value)}
                          />
                          <Button
                            type="primary"
                            onClick={() => {
                              if (!manualHLInput.trim()) { message.warning('请输入内容'); return }
                              setManualHeadlines(prev => [...prev, manualHLInput.trim()])
                              setManualHLInput('')
                            }}
                          >添加</Button>
                        </Space.Compact>
                        {manualHeadlines.length > 0 && (
                          <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 8 }}>
                            {manualHeadlines.map((text, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 4, padding: '4px 8px', background: '#f9f0ff', borderRadius: 4 }}>
                                <Tag color="purple" style={{ fontSize: 10, marginRight: 8 }}>{idx + 1}</Tag>
                                <span style={{ flex: 1, fontSize: 12, lineHeight: 1.4 }}>{text}</span>
                                <Button
                                  type="link" size="small" danger
                                  style={{ padding: 0, fontSize: 12 }}
                                  onClick={() => setManualHeadlines(prev => prev.filter((_, i) => i !== idx))}
                                >删除</Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 500, marginBottom: 6 }}>CTA 按钮</div>
                        <Select value={manualCtaType} onChange={setManualCtaType} style={{ width: '100%' }}>
                          <Select.Option value="LEARN_MORE">了解更多</Select.Option>
                          <Select.Option value="SIGN_UP">立即注册</Select.Option>
                          <Select.Option value="GET_OFFER">获取优惠</Select.Option>
                          <Select.Option value="APPLY_NOW">立即申请</Select.Option>
                        </Select>
                      </div>
                    </Col>
                  </Row>
                  <Alert
                    message={
                      copyInputMode === 'manual' && (manualPrimaryTexts.length > 0 || manualHeadlines.length > 0)
                        ? `已添加 ${manualPrimaryTexts.length} 条 Primary Text，${manualHeadlines.length} 条 Headline。将按顺序循环分配给各个广告。`
                        : "输入多条文案后，系统将按添加顺序循环分配给每个广告。"
                    }
                    type="info"
                    showIcon
                  />
                </>
              ) : (
                <Row gutter={16}>
                  {/* Primary Text 列 — 多选 + 点击顺序 */}
                  <Col span={12}>
                    <Card
                      title={
                        <Space>
                          <span style={{ color: '#1890ff' }}>Primary Text 选择</span>
                          {selectedPTCopyIds.length > 0 && (
                            <Tag color="blue">{selectedPTCopyIds.length} 条已选</Tag>
                          )}
                          {selectedPTCopyIds.length > 0 && (
                            <Button
                              size="small" type="link" danger
                              style={{ padding: 0, fontSize: 11 }}
                              onClick={() => setSelectedPTCopyIds([])}
                            >清空</Button>
                          )}
                        </Space>
                      }
                      size="small"
                      style={{ marginBottom: 12 }}
                      bodyStyle={{ maxHeight: 300, overflowY: 'auto', padding: '8px 12px' }}
                    >
                      {ptCopies.length === 0 ? (
                        <Empty description="暂无 Primary Text 文案" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      ) : (
                        ptCopies.map(copy => {
                          const selectIdx = selectedPTCopyIds.indexOf(copy.id)
                          const isSelected = selectIdx >= 0
                          return (
                            <div
                              key={copy.id}
                              onClick={() => setSelectedPTCopyIds(prev => toggleArrayItem(prev, copy.id))}
                              style={{
                                padding: '8px 10px',
                                marginBottom: 6,
                                borderRadius: 6,
                                border: isSelected ? '2px solid #1890ff' : '1px solid #f0f0f0',
                                background: isSelected ? '#e6f7ff' : '#fafafa',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Space size={4}>
                                  <Tag color="cyan" style={{ fontSize: 10 }}>{copy.countryCode}</Tag>
                                  {isSelected && (
                                    <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>#{selectIdx + 1}</Tag>
                                  )}
                                </Space>
                                <span style={{ fontSize: 11, color: '#999' }}>{copy.name}</span>
                              </div>
                              <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5, color: '#333' }}>
                                {copy.primaryText}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </Card>
                  </Col>

                  {/* Headline 列 — 多选 + 点击顺序 */}
                  <Col span={12}>
                    <Card
                      title={
                        <Space>
                          <span style={{ color: '#722ed1' }}>Headline 选择</span>
                          {selectedHLCopyIds.length > 0 && (
                            <Tag color="purple">{selectedHLCopyIds.length} 条已选</Tag>
                          )}
                          {selectedHLCopyIds.length > 0 && (
                            <Button
                              size="small" type="link" danger
                              style={{ padding: 0, fontSize: 11 }}
                              onClick={() => setSelectedHLCopyIds([])}
                            >清空</Button>
                          )}
                        </Space>
                      }
                      size="small"
                      style={{ marginBottom: 12 }}
                      bodyStyle={{ maxHeight: 300, overflowY: 'auto', padding: '8px 12px' }}
                    >
                      {hlCopies.length === 0 ? (
                        <Empty description="暂无 Headline 文案" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      ) : (
                        hlCopies.map(copy => {
                          const selectIdx = selectedHLCopyIds.indexOf(copy.id)
                          const isSelected = selectIdx >= 0
                          return (
                            <div
                              key={copy.id}
                              onClick={() => setSelectedHLCopyIds(prev => toggleArrayItem(prev, copy.id))}
                              style={{
                                padding: '8px 10px',
                                marginBottom: 6,
                                borderRadius: 6,
                                border: isSelected ? '2px solid #722ed1' : '1px solid #f0f0f0',
                                background: isSelected ? '#f9f0ff' : '#fafafa',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Space size={4}>
                                  <Tag color="purple" style={{ fontSize: 10 }}>{copy.countryCode}</Tag>
                                  {isSelected && (
                                    <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>#{selectIdx + 1}</Tag>
                                  )}
                                </Space>
                                <span style={{ fontSize: 11, color: '#999' }}>{copy.name}</span>
                              </div>
                              <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5, color: '#333' }}>
                                {copy.headline}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </Card>
                  </Col>
                </Row>
              )}
            </div>
          )}
        </div>

        {/* ---- 预览条 ---- */}
        {previewCount > 0 && (
          <div style={{ padding: '8px 24px', background: '#f6ffed', borderTop: '1px solid #d9f7be' }}>
            <RocketOutlined style={{ marginRight: 8, color: '#52c41a' }} />
            <span>
              将创建 <strong>{previewCount}</strong> 个 Campaign，
              共 <strong>{previewAdsCount}</strong> 个 Ads，
              总日预算 <strong>${previewBudget}</strong>/天
              {structureMode === '1-1-N' && <span>（1-1-{adsPerAdSet} 结构，{selectedCreativeIds.length} 素材分 {Math.ceil(selectedCreativeIds.length / adsPerAdSet)} 组）</span>}
              {copyInputMode === 'library' && (
                <span> | 已选 <strong>{selectedPTCopyIds.length}</strong> 条 Primary Text，<strong>{selectedHLCopyIds.length}</strong> 条 Headline</span>
              )}
              {copyInputMode === 'manual' && (manualPrimaryTexts.length > 0 || manualHeadlines.length > 0) && (
                <span> | 已输入 <strong>{manualPrimaryTexts.length}</strong> 条 Primary Text，<strong>{manualHeadlines.length}</strong> 条 Headline</span>
              )}
            </span>
          </div>
        )}

        {/* ---- 底部操作栏 ---- */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <Switch
              checked={pushToMeta}
              onChange={setPushToMeta}
              checkedChildren="推送 Meta"
              unCheckedChildren="仅本地"
              size="small"
            />
            <span style={{ marginLeft: 8, color: pushToMeta ? '#389e0d' : '#999', fontSize: 12 }}>
              {pushToMeta ? '创建后将同步推送到 Facebook 广告账户（广告组/广告为开启状态）' : '仅在本地创建广告记录'}
            </span>
          </div>
          <Space>
            <Button onClick={handleCloseCreateModal}>取消</Button>
            {activeTab !== '1' && (
              <Button onClick={() => setActiveTab(String(parseInt(activeTab) - 1))}>上一步</Button>
            )}
            {activeTab !== '4' ? (
              <Button type="primary" onClick={() => setActiveTab(String(parseInt(activeTab) + 1))}>
                下一步
              </Button>
            ) : (
              <Button type="primary" loading={createLoading} onClick={handleStartCreate}>
                开始创建
              </Button>
            )}
          </Space>
        </div>
      </Modal>

      {/* ===================== 保存预置模板弹窗 ===================== */}
      <Modal
        title="保存为预置模板"
        open={presetModalOpen}
        onCancel={() => { setPresetModalOpen(false); setPresetName('') }}
        onOk={handleSavePreset}
        okText="保存"
        cancelText="取消"
        width={400}
      >
        <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>
          将当前的 Campaign 设置、定向、版位、国家等配置保存为可复用的模板。
        </div>
        <Input
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="输入模板名称，如：越南-销量-宽泛"
          size="large"
          autoFocus
          onPressEnter={handleSavePreset}
        />
      </Modal>

      {/* ===================== 推送进度弹窗 ===================== */}
      <Modal
        title="推送到 Meta Ads"
        open={pushModalOpen}
        onCancel={pushDone ? () => setPushModalOpen(false) : undefined}
        closable={pushDone}
        maskClosable={false}
        footer={pushDone ? [
          <Button key="close" type="primary" onClick={() => setPushModalOpen(false)}>关闭</Button>
        ] : null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Progress
            percent={Math.round(
              (pushItems.filter(i => ['success', 'failed', 'skipped'].includes(i.status)).length / Math.max(pushItems.length, 1)) * 100
            )}
            status={
              pushDone
                ? (pushItems.some(i => i.status === 'failed') ? 'exception' : 'success')
                : 'active'
            }
          />
        </div>
        <div style={{ maxHeight: 360, overflow: 'auto' }}>
          {pushItems.map((item, idx) => {
            const statusConfig: Record<string, { color: string; text: string }> = {
              pending: { color: 'default', text: '等待中' },
              waiting: { color: 'processing', text: '排队中...' },
              pushing: { color: 'processing', text: '推送中...' },
              success: { color: 'success', text: '成功' },
              failed: { color: 'error', text: '失败' },
              skipped: { color: 'warning', text: '跳过' },
            }
            const sc = statusConfig[item.status] || statusConfig.pending
            return (
              <div key={idx} style={{
                padding: '8px 12px',
                marginBottom: 4,
                borderRadius: 4,
                background: item.status === 'failed' ? '#fff2f0' : item.status === 'success' ? '#f6ffed' : '#fafafa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 500, marginRight: 8 }}>G{idx + 1}</span>
                  <span style={{ color: '#666', fontSize: 13 }}>{item.campaignName || item.campaignId.slice(0, 8)}</span>
                </div>
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {item.status === 'success' && item.adsPushed !== undefined && (
                    <span style={{ fontSize: 12, color: '#52c41a' }}>
                      {item.adsPushed} Ads{item.adsFailed ? <span style={{ color: '#ff4d4f' }}>, {item.adsFailed} 失败</span> : ''}
                    </span>
                  )}
                  <Tag color={sc.color}>{sc.text}</Tag>
                </div>
                {item.status === 'failed' && item.error && (
                  <div style={{ width: '100%', marginTop: 4, fontSize: 12, color: '#ff4d4f', paddingLeft: 24 }}>
                    {item.error.includes('too many calls') ? '触发 Meta API 速率限制，请等待几分钟后重试' : item.error}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {pushDone && pushItems.some(i => i.status === 'failed') && (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 12 }}
            message="部分推送失败"
            description="Meta 广告账户存在 API 调用频率限制。建议等待 3-5 分钟后，重新选择失败的 Campaign 再次推送。"
          />
        )}
      </Modal>

      {/* ===================== 详情抽屉 ===================== */}
      <Drawer
        title={detailCampaign?.name || '广告活动详情'}
        open={detailDrawer}
        onClose={() => { setDetailDrawer(false); setDetailCampaign(null) }}
        width={640}
      >
        {detailCampaign && (
          <div>
            <Descriptions title="Campaign 层" bordered size="small" column={2}>
              <Descriptions.Item label="名称" span={2}>{detailCampaign.name}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {(() => {
                  const cfg = statusMap[detailCampaign.status]
                  return <Badge status={cfg?.color as any} text={cfg?.text || detailCampaign.status} />
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="目标">
                {CAMPAIGN_OBJECTIVES.find(o => o.value === detailCampaign.objective)?.label || detailCampaign.objective}
              </Descriptions.Item>
              <Descriptions.Item label="日预算">${detailCampaign.budgetAmount}/天</Descriptions.Item>
              <Descriptions.Item label="预算策略">
                {(detailCampaign.countryRadarConfig as any)?.campaignSettings?.budgetStrategy || 'CBO'}
              </Descriptions.Item>
              <Descriptions.Item label="出价策略">
                {(() => {
                  const bs = (detailCampaign.countryRadarConfig as any)?.campaignSettings?.bidStrategy
                  return BID_STRATEGIES.find(b => b.value === bs)?.label || bs || 'Lowest Cost'
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="结构">
                {(detailCampaign.countryRadarConfig as any)?.structure || '1-1-1'}
              </Descriptions.Item>
              <Descriptions.Item label="国家" span={2}>
                {(detailCampaign.countryRadarConfig as any)?.countryName || '--'}
              </Descriptions.Item>
              {(detailCampaign.countryRadarConfig as any)?.campaignSettings?.pixelId && (
                <Descriptions.Item label="Pixel ID" span={2}>
                  {(detailCampaign.countryRadarConfig as any).campaignSettings.pixelId}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="创建时间" span={2}>
                {dayjs(detailCampaign.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>

            {detailCampaign.adSets?.map((adSet: AdSet, i: number) => (
              <div key={adSet.id} style={{ marginTop: 20 }}>
                <Descriptions title={`Ad Set 层 #${i + 1}`} bordered size="small" column={2}>
                  <Descriptions.Item label="名称" span={2}>{adSet.name}</Descriptions.Item>
                  <Descriptions.Item label="状态">
                    {(() => {
                      const cfg = statusMap[adSet.status]
                      return <Badge status={cfg?.color as any} text={cfg?.text || adSet.status} />
                    })()}
                  </Descriptions.Item>
                  <Descriptions.Item label="受众模板">
                    {audienceLabels[adSet.audienceTemplate || ''] || adSet.audienceTemplate || '--'}
                  </Descriptions.Item>
                  <Descriptions.Item label="日预算">
                    {adSet.budgetAmount ? `$${adSet.budgetAmount}` : '--'}
                  </Descriptions.Item>
                  <Descriptions.Item label="竞价策略">{adSet.bidStrategy || '--'}</Descriptions.Item>
                  <Descriptions.Item label="国家代码">{adSet.countryCode || '--'}</Descriptions.Item>
                  <Descriptions.Item label="版位">{adSet.placements?.join(', ') || '--'}</Descriptions.Item>
                </Descriptions>

                {adSet.ads?.map((ad: Ad, j: number) => {
                  let adParams: any = {}
                  try { adParams = JSON.parse(ad.urlParameters || '{}') } catch {}
                  return (
                    <Card
                      key={ad.id}
                      size="small"
                      title={`Ad #${j + 1}: ${ad.name}`}
                      style={{ marginTop: 12, marginLeft: 24 }}
                    >
                      <Row gutter={16}>
                        <Col span={8}>
                          {ad.creative?.fileUrl && (
                            <img
                              src={ad.creative.fileUrl.startsWith('http') ? ad.creative.fileUrl : `${API_BASE}${ad.creative.fileUrl}`}
                              alt={ad.creative?.name}
                              style={{ width: '100%', borderRadius: 4, maxHeight: 100, objectFit: 'cover' }}
                              onError={(e: any) => { e.target.style.display = 'none' }}
                            />
                          )}
                        </Col>
                        <Col span={16}>
                          <div><strong>素材：</strong>{ad.creative?.name || '--'}</div>
                          <div><strong>正文：</strong>{adParams.primaryText || '--'}</div>
                          <div><strong>标题：</strong>{adParams.headline || '--'}</div>
                          <div><strong>CTA：</strong>{ctaLabels[adParams.ctaType] || adParams.ctaType || '--'}</div>
                          <div><strong>落地页：</strong>
                            <a href={adParams.landingUrl} target="_blank" rel="noreferrer">{adParams.landingUrl || '--'}</a>
                          </div>
                        </Col>
                      </Row>
                    </Card>
                  )
                })}
              </div>
            ))}

            {(!detailCampaign.adSets || detailCampaign.adSets.length === 0) && (
              <Alert message="暂无广告组数据" type="info" showIcon style={{ marginTop: 20 }} />
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default Campaigns
