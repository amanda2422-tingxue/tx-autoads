import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { prisma, Prisma } from '@autoads/database';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// Ensure upload directory exists with absolute path
const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'creatives');
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_ROOT);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// 计算文件 SHA-256 哈希
function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// POST /api/creatives/upload
router.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '请选择文件' });
      }

      const { country, designer, uploadedAt, width, height } = req.body;

      if (!country) {
        return res.status(400).json({ error: '必须选择国家' });
      }

      // 计算文件内容哈希用于去重
      const uploadedFilePath = path.join(UPLOAD_ROOT, req.file.filename);
      const fileHash = await computeFileHash(uploadedFilePath);

      // 检查是否已存在相同内容的素材
      const existing = await prisma.creative.findFirst({
        where: { fileHash }
      });

      if (existing) {
        // 删除刚上传的重复文件
        fs.unlinkSync(uploadedFilePath);
        return res.status(409).json({
          error: '素材已存在，请勿重复上传！',
          duplicate: true,
          existingName: existing.name,
          existingId: existing.id,
        });
      }

      const originalName = req.file.originalname;
      const isVideo = req.file.mimetype.startsWith('video') || 
                      ['.mp4', '.mov'].includes(path.extname(originalName).toLowerCase());
      
      const fileUrl = `/uploads/creatives/${req.file.filename}`;
      const fileSize = req.file.size || null;

      const creative = await prisma.creative.create({
        data: {
          name: originalName,
          type: isVideo ? 'video' : 'image',
          fileUrl,
          fileSize,
          fileHash,
          status: 'active',
          designer: designer || '未知',
          country,
          width: width ? parseInt(width) : null,
          height: height ? parseInt(height) : null,
          uploadedAt: uploadedAt ? new Date(uploadedAt) : new Date(),
          tags: [],
          ownerId: req.user?.userId,
        }
      });

      logger.info(`素材上传成功: ${creative.id} (hash: ${fileHash.substring(0, 12)}...)`);
      res.status(201).json({ data: creative });
    } catch (err: any) {
      logger.error('上传处理失败:', err);
      res.status(500).json({ 
        error: '数据库保存失败', 
        details: err.message,
        code: err.code 
      });
    }
  })
);

// GET /api/creatives
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, type, limit = 100, offset = 0, withStats } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [creatives, total] = await Promise.all([
      prisma.creative.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { ads: true } },
          owner: { select: { id: true, displayName: true, username: true } }
        }
      }),
      prisma.creative.count({ where })
    ]);

    // 如果需要统计信息，查询各国家的消耗数据
    let creativesWithStats = creatives;
    if (withStats === 'true' && creatives.length > 0) {
      const creativeIds = creatives.map(c => c.id);
      
      // 查询每个素材关联的广告的消耗数据
      const stats = await prisma.$queryRaw`
        SELECT 
          c.id as creative_id,
          a.country_code,
          COALESCE(SUM(ap.spend), 0) as total_spend,
          COALESCE(SUM(ap.conversions), 0) as total_conversions,
          CASE 
            WHEN SUM(ap.conversions) > 0 THEN SUM(ap.spend) / SUM(ap.conversions)
            ELSE NULL 
          END as avg_cpa
        FROM creatives c
        LEFT JOIN ads ad ON ad.creative_id = c.id
        LEFT JOIN ad_sets a ON a.id = ad.adset_id
        LEFT JOIN ad_performance ap ON ap.ad_id = ad.id
        WHERE c.id IN (${Prisma.join(creativeIds)})
        GROUP BY c.id, a.country_code
      `;

      // 将统计数据合并到素材对象
      creativesWithStats = creatives.map(c => {
        const creativeStats = (stats as any[]).filter(s => s.creative_id === c.id);
        return {
          ...c,
          countryStats: creativeStats.map(s => ({
            countryCode: s.country_code,
            totalSpend: Number(s.total_spend),
            totalConversions: Number(s.total_conversions),
            avgCpa: s.avg_cpa ? Number(s.avg_cpa) : null,
          })).filter(s => s.countryCode),
          totalSpend: creativeStats.reduce((sum, s) => sum + Number(s.total_spend), 0),
          totalConversions: creativeStats.reduce((sum, s) => sum + Number(s.total_conversions), 0),
        };
      });
    }

    res.json({
      data: creativesWithStats,
      pagination: { total, limit: Number(limit), offset: Number(offset) }
    });
  })
);

// GET /api/creatives/:id/stats - 获取单个素材的详细统计数据
router.get(
  '/:id/stats',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // 验证素材存在
    const creative = await prisma.creative.findUnique({ where: { id } });
    if (!creative) {
      return res.status(404).json({ error: '素材不存在' });
    }

    // 查询该素材在各国家的消耗数据
    const countryStats = await prisma.$queryRaw`
      SELECT 
        a.country_code,
        COUNT(DISTINCT ad.id) as ad_count,
        COALESCE(SUM(ap.spend), 0) as total_spend,
        COALESCE(SUM(ap.impressions), 0) as total_impressions,
        COALESCE(SUM(ap.clicks), 0) as total_clicks,
        COALESCE(SUM(ap.conversions), 0) as total_conversions,
        CASE 
          WHEN SUM(ap.clicks) > 0 THEN SUM(ap.conversions)::float / SUM(ap.clicks)
          ELSE 0 
        END as cvr,
        CASE 
          WHEN SUM(ap.conversions) > 0 THEN SUM(ap.spend) / SUM(ap.conversions)
          ELSE NULL 
        END as avg_cpa,
        MAX(ap.date) as last_active_date
      FROM ads ad
      JOIN ad_sets a ON a.id = ad.adset_id
      LEFT JOIN ad_performance ap ON ap.ad_id = ad.id
      WHERE ad.creative_id = ${id}
      GROUP BY a.country_code
      ORDER BY total_spend DESC
    `;

    // 查询总体数据
    const overallStats = await prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT ad.id) as total_ads,
        COALESCE(SUM(ap.spend), 0) as total_spend,
        COALESCE(SUM(ap.impressions), 0) as total_impressions,
        COALESCE(SUM(ap.clicks), 0) as total_clicks,
        COALESCE(SUM(ap.conversions), 0) as total_conversions,
        CASE 
          WHEN SUM(ap.impressions) > 0 THEN SUM(ap.clicks)::float / SUM(ap.impressions) * 100
          ELSE 0 
        END as ctr,
        CASE 
          WHEN SUM(ap.clicks) > 0 THEN SUM(ap.conversions)::float / SUM(ap.clicks) * 100
          ELSE 0 
        END as cvr,
        CASE 
          WHEN SUM(ap.conversions) > 0 THEN SUM(ap.spend) / SUM(ap.conversions)
          ELSE NULL 
        END as avg_cpa
      FROM ads ad
      LEFT JOIN ad_performance ap ON ap.ad_id = ad.id
      WHERE ad.creative_id = ${id}
    `;

    res.json({
      data: {
        creativeId: id,
        creativeName: creative.name,
        overall: overallStats[0] || {},
        byCountry: countryStats,
      },
    });
  })
);

// DELETE /api/creatives/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.creative.delete({ where: { id } });
    res.status(204).send();
  })
);

export { router as creativesRouter };
