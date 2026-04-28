import { Router, Request, Response } from 'express';
import { prisma } from '@autoads/database';

const router = Router();

// ==================== 白名单定义 ====================
const VALID_DIMENSIONS = ['date', 'campaign', 'adset', 'creative', 'country', 'audienceTemplate', 'radarType'];
const VALID_METRICS = ['spend', 'conversions', 'clicks', 'impressions', 'ctr', 'cvr', 'cpc', 'cpm', 'frequency', 'cpa', 'epc', 'roas', 'revenue', 'roi'];

// 维度定义：select 字段、group by 字段、依赖的 JOIN key
const DIM_DEFS: Record<string, { selects: string[]; groupBys: string[]; joins: string[] }> = {
  date:            { selects: [`ap.date as "date"`],                                         groupBys: ['ap.date'],                                       joins: [] },
  campaign:        { selects: [`ac.name as "campaign_name"`, `ap.campaign_id as "campaign_id"`], groupBys: ['ap.campaign_id', 'ac.name'],                     joins: ['campaigns'] },
  adset:           { selects: [`a_s.name as "adset_name"`, `ap.adset_id as "adset_id"`],       groupBys: ['ap.adset_id', 'a_s.name'],                        joins: ['adsets'] },
  creative:        { selects: [`c.name as "creative_name"`, `ad.creative_id as "creative_id"`, `c.file_url as "creative_file_url"`], groupBys: ['ad.creative_id', 'c.name', 'c.file_url'], joins: ['ads', 'creatives'] },
  country:         { selects: [`a_s.country_code as "country_code"`],                         groupBys: ['a_s.country_code'],                                joins: ['adsets'] },
  audienceTemplate:{ selects: [`a_s.audience_template as "audience_template"`],                 groupBys: ['a_s.audience_template'],                            joins: ['adsets'] },
  radarType:       { selects: [`a_s.radar_type as "radar_type"`],                             groupBys: ['a_s.radar_type'],                                   joins: ['adsets'] },
};

// JOIN 定义（key → SQL 片段）
const JOIN_DEFS: Record<string, string> = {
  campaigns:  'LEFT JOIN ad_campaigns ac ON ap.campaign_id = ac.id',
  adsets:     'LEFT JOIN ad_sets a_s ON ap.adset_id = a_s.id',
  ads:        'LEFT JOIN ads ad ON ap.ad_id = ad.id',
  creatives:  'LEFT JOIN creatives c ON ad.creative_id = c.id',
  benchmarks: 'LEFT JOIN country_benchmarks cb ON a_s.country_code = cb.country_code',
};

// 指标定义（key → SQL 表达式 + 额外 JOIN）
const METRIC_DEFS: Record<string, { expr: string; joins?: string[] }> = {
  spend:        { expr: 'SUM(ap.spend) as "spend"' },
  conversions:  { expr: 'SUM(ap.conversions) as "conversions"' },
  clicks:       { expr: 'SUM(ap.clicks) as "clicks"' },
  impressions:  { expr: 'SUM(ap.impressions) as "impressions"' },
  ctr:          { expr: 'ROUND(SUM(ap.clicks)::numeric / NULLIF(SUM(ap.impressions), 0) * 100, 2) as "ctr"' },
  cvr:          { expr: 'ROUND(SUM(ap.conversions)::numeric / NULLIF(SUM(ap.clicks), 0) * 100, 2) as "cvr"' },
  cpc:          { expr: 'ROUND(SUM(ap.spend)::numeric / NULLIF(SUM(ap.clicks), 0), 2) as "cpc"' },
  cpm:          { expr: 'ROUND(SUM(ap.spend)::numeric / NULLIF(SUM(ap.impressions), 0) * 1000, 2) as "cpm"' },
  frequency:    { expr: 'ROUND(AVG(ap.frequency)::numeric, 2) as "frequency"' },
  cpa:          { expr: 'ROUND(SUM(ap.spend)::numeric / NULLIF(SUM(ap.conversions), 0), 2) as "cpa"' },
  epc:          { expr: 'ROUND(cb.payout * (SUM(ap.conversions)::numeric / NULLIF(SUM(ap.clicks), 0)), 4) as "epc"',     joins: ['benchmarks'] },
  roas:         { expr: 'ROUND((cb.payout * SUM(ap.conversions))::numeric / NULLIF(SUM(ap.spend), 0) * 100, 2) as "roas"', joins: ['benchmarks'] },
  revenue:      { expr: 'ROUND(SUM(cb.payout * ap.conversions)::numeric, 2) as "revenue"', joins: ['benchmarks'] },
  roi:          { expr: 'ROUND((SUM(cb.payout * ap.conversions) - SUM(ap.spend))::numeric / NULLIF(SUM(ap.spend), 0) * 100, 2) as "roi"', joins: ['benchmarks'] },
};

// JOIN 顺序（确保依赖正确：creatives 依赖 ads，benchmarks 依赖 adsets）
const JOIN_ORDER = ['campaigns', 'adsets', 'ads', 'creatives', 'benchmarks'];

interface ReportQueryBody {
  dimensions: string[];
  metrics: string[];
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    countryCodes?: string[];
    campaignIds?: string[];
    adSetIds?: string[];
    creativeIds?: string[];
    audienceTemplates?: string[];
    radarTypes?: string[];
  };
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// ==================== 核心查询函数 ====================
async function executeQuery(body: ReportQueryBody) {
  const dims = (body.dimensions || []).filter(d => VALID_DIMENSIONS.includes(d));
  const metrics = (body.metrics || []).filter(m => VALID_METRICS.includes(m));

  if (dims.length === 0) throw new Error('至少选择一个维度');
  if (metrics.length === 0) throw new Error('至少选择一个指标');

  // EPC / ROAS / Revenue / ROI 必须包含 country 维度（payout 按国家区分）
  if ((metrics.includes('epc') || metrics.includes('roas') || metrics.includes('revenue') || metrics.includes('roi')) && !dims.includes('country')) {
    throw new Error('包含 收入/ROI 相关指标时必须选择"国家"维度以获取单价数据');
  }

  // 收集所有需要的 JOIN
  const neededJoins = new Set<string>();
  for (const d of dims) {
    for (const j of DIM_DEFS[d].joins) neededJoins.add(j);
  }
  for (const m of metrics) {
    const def = METRIC_DEFS[m];
    if (def.joins) for (const j of def.joins) neededJoins.add(j);
  }

  // 如果有过滤条件涉及特定字段，也加入对应 JOIN
  const f = body.filters || {};
  if (f.campaignIds?.length) neededJoins.add('campaigns');
  if (f.countryCodes?.length || f.adSetIds?.length || f.audienceTemplates?.length || f.radarTypes?.length) neededJoins.add('adsets');
  if (f.creativeIds?.length) { neededJoins.add('ads'); neededJoins.add('creatives'); }

  // 按固定顺序构建 JOIN SQL
  const joinsSql = JOIN_ORDER.filter(j => neededJoins.has(j)).map(j => JOIN_DEFS[j]).join('\n  ');

  // 构建 SELECT
  const dimSelects = dims.flatMap(d => DIM_DEFS[d].select);
  const metricSelects = metrics.map(m => METRIC_DEFS[m].expr);
  const allSelects = [...dimSelects, ...metricSelects].join(',\n  ');

  // 构建 WHERE（参数化，防注入）
  const whereParts: string[] = ["ap.level = 'ad'"];
  const params: (string | number | string[])[] = [];
  let pIdx = 1;

  const dateFrom = f.dateFrom || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const dateTo = f.dateTo || new Date().toISOString().slice(0, 10);
  whereParts.push(`ap.date >= $${pIdx++}`); params.push(dateFrom);
  whereParts.push(`ap.date <= $${pIdx++}`); params.push(dateTo);

  const inFilter = (field: string, vals?: string[]) => {
    if (!vals?.length) return;
    const placeholders = vals.map(() => `$${pIdx++}`).join(',');
    whereParts.push(`${field} IN (${placeholders})`);
    params.push(...vals);
  };

  inFilter('a_s.country_code', f.countryCodes);
  inFilter('ap.campaign_id', f.campaignIds);
  inFilter('ap.adset_id', f.adSetIds);
  inFilter('ad.creative_id', f.creativeIds);
  inFilter('a_s.audience_template', f.audienceTemplates);
  inFilter('a_s.radar_type', f.radarTypes);

  const whereSql = whereParts.join('\n  AND ');

  // 构建 GROUP BY
  const groupBys = dims.flatMap(d => DIM_DEFS[d].groupBys);
  // EPC/ROAS 的 groupBy 需要包含 cb.payout（因为 SELECT 中用了非聚合列）
  if (metrics.some(m => ['epc', 'roas', 'revenue', 'roi'].includes(m))) {
    if (!groupBys.includes('cb.payout')) groupBys.push('cb.payout');
  }
  const groupBySql = groupBys.join(', ');

  // 构建 ORDER BY
  const sortBy = body.sortBy;
  const sortOrder = body.sortOrder === 'asc' ? 'ASC' : 'DESC';
  let orderBySql: string;
  if (sortBy && [...VALID_METRICS, ...VALID_DIMENSIONS].includes(sortBy)) {
    orderBySql = `"${sortBy}" ${sortOrder}`;
  } else if (dims.includes('date')) {
    orderBySql = `ap.date DESC`;
  } else {
    orderBySql = `"spend" DESC`;
  }

  const limit = Math.min(body.limit || 50, 500);
  const page = Math.max(body.page || 1, 1);
  const offset = (page - 1) * limit;

  // 组装主查询 SQL
  const sql = `SELECT
  ${allSelects}
FROM ad_performance ap
  ${joinsSql}
WHERE ${whereSql}
GROUP BY ${groupBySql}
ORDER BY ${orderBySql}
LIMIT $${pIdx++} OFFSET $${pIdx++}`;
  params.push(limit, offset);

  const data = await prisma.$queryRawUnsafe<any[]>(sql, ...params);

  // 统计总数（用于分页）
  const countSql = `SELECT COUNT(*) as "total" FROM (
  SELECT 1
  FROM ad_performance ap
    ${joinsSql}
  WHERE ${whereSql}
  GROUP BY ${groupBySql}
) t`;
  const countResult = await prisma.$queryRawUnsafe<{ total: bigint }[]>(countSql, ...params.slice(0, -2));
  const total = Number(countResult[0]?.total || 0);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ==================== 路由定义 ====================

// POST /api/reports/query — 动态查询
router.post('/query', async (req: Request, res: Response) => {
  try {
    const result = await executeQuery(req.body);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Report query error:', err);
    res.status(400).json({ success: false, error: err.message || '查询失败' });
  }
});

// GET /api/reports/export?... — CSV 导出
router.get('/export', async (req: Request, res: Response) => {
  try {
    const body: ReportQueryBody = {
      dimensions: req.query.dimensions ? JSON.parse(req.query.dimensions as string) : [],
      metrics: req.query.metrics ? JSON.parse(req.query.metrics as string) : [],
      filters: req.query.filters ? JSON.parse(req.query.filters as string) : {},
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as 'asc' | 'desc',
      page: 1,
      limit: 500,
    };
    const result = await executeQuery(body);

    // 生成 CSV（表头 + 数据行）
    const dims = body.dimensions || [];
    const metrics = body.metrics || [];
    const headers = [...dims, ...metrics];
    const rows = result.data.map((row: any) =>
      headers.map(h => {
        const v = row[h];
        if (v === null || v === undefined) return '';
        const s = String(v);
        // 如果内容包含逗号/换行/引号，用引号包裹并转义
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="autoads-report-${Date.now()}.csv"`);
    res.send('\uFEFF' + csv); // BOM 让 Excel 正确识别 UTF-8
  } catch (err: any) {
    console.error('Export error:', err);
    res.status(400).json({ success: false, error: err.message || '导出失败' });
  }
});

// GET /api/reports/saved — 已保存报表列表
router.get('/saved', async (_req: Request, res: Response) => {
  try {
    const reports = await prisma.savedReport.findMany({
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ success: true, data: reports });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/reports/saved — 保存报表
router.post('/saved', async (req: Request, res: Response) => {
  try {
    const { name, description, config } = req.body;
    if (!name || !config) throw new Error('name 和 config 为必填项');
    const report = await prisma.savedReport.create({
      data: { name, description, config },
    });
    res.json({ success: true, data: report });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/reports/saved/:id — 删除自定义报表
router.delete('/saved/:id', async (req: Request, res: Response) => {
  try {
    const report = await prisma.savedReport.findUnique({ where: { id: req.params.id } });
    if (!report) throw new Error('报表不存在');
    if (report.isSystem) throw new Error('系统预置报表不可删除');
    await prisma.savedReport.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/reports/meta — 返回维度/指标元数据（供前端渲染选择器）
router.get('/meta', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      dimensions: [
        { key: 'date', label: '日期', requires: [] },
        { key: 'campaign', label: '广告活动', requires: [] },
        { key: 'adset', label: '广告组', requires: [] },
        { key: 'creative', label: '素材', requires: [] },
        { key: 'country', label: '国家', requires: [] },
        { key: 'audienceTemplate', label: '受众模板', requires: [] },
        { key: 'radarType', label: '广告组类型', requires: [] },
      ],
      metrics: [
        { key: 'spend', label: '花费', unit: 'USD' },
        { key: 'conversions', label: '转化数' },
        { key: 'clicks', label: '点击数' },
        { key: 'impressions', label: '展示数' },
        { key: 'ctr', label: 'CTR', unit: '%' },
        { key: 'cvr', label: 'CVR', unit: '%' },
        { key: 'cpc', label: 'CPC', unit: 'USD' },
        { key: 'cpm', label: 'CPM', unit: 'USD' },
        { key: 'frequency', label: '频次' },
        { key: 'cpa', label: 'CPA', unit: 'USD' },
        { key: 'epc', label: 'EPC', unit: 'USD', requiresDimension: 'country' },
        { key: 'roas', label: 'ROAS', unit: '%', requiresDimension: 'country' },
        { key: 'revenue', label: '收入', unit: 'USD', requiresDimension: 'country' },
        { key: 'roi', label: 'ROI', unit: '%', requiresDimension: 'country' },
      ],
    },
  });
});

// GET /api/reports/filter-options — 获取过滤选项列表
router.get('/filter-options', async (_req: Request, res: Response) => {
  try {
    const [campaigns, adsets, countries, creatives] = await Promise.all([
      prisma.adCampaign.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.adSet.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.adSet.findMany({ select: { countryCode: true }, distinct: ['countryCode'], where: { countryCode: { not: null } } }),
      prisma.creative.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);

    res.json({
      success: true,
      data: {
        campaigns: campaigns.map(c => ({ value: c.id, label: c.name })),
        adsets: adsets.map(a => ({ value: a.id, label: a.name })),
        countries: countries.map(c => ({ value: c.countryCode, label: c.countryCode })),
        creatives: creatives.map(c => ({ value: c.id, label: c.name })),
        audienceTemplates: [
          { value: 'T1', label: '宽泛流量 (T1)' },
          { value: 'T2', label: '调研兴趣 (T2)' },
          { value: 'T3', label: '再营销 (T3)' },
        ],
        radarTypes: [
          { value: 'monitor', label: '监测组' },
          { value: 'scaling', label: '跑量组' },
        ]
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
