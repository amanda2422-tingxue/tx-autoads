import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { prisma } from '@autoads/database';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/campaigns - List all campaigns
router.get(
  '/',
  [
    query('status').optional().isIn(['draft', 'scheduled', 'active', 'paused', 'ended', 'archived']),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const { status, limit = 20, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.status = status;

    const [campaigns, total] = await Promise.all([
      prisma.adCampaign.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: { createdAt: 'desc' },
        include: {
          adAccount: {
            select: { id: true, name: true, metaAccountId: true }
          },
          adSets: {
            include: {
              _count: {
                select: { ads: true }
              }
            }
          },
          _count: {
            select: { adSets: true }
          }
        }
      }),
      prisma.adCampaign.count({ where })
    ]);

    res.json({
      data: campaigns,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + campaigns.length < total
      }
    });
  })
);

// GET /api/campaigns/:id - Get campaign by ID
router.get(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const campaign = await prisma.adCampaign.findUnique({
      where: { id },
      include: {
        adAccount: true,
        adSets: {
          include: {
            ads: {
              include: {
                creative: true
              }
            }
          }
        },
        autoRules: true
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ data: campaign });
  })
);

// POST /api/campaigns - Create new campaign
router.post(
  '/',
  [
    body('name').notEmpty().trim(),
    body('objective').notEmpty().trim(),
    body('adAccountId').isUUID(),
    body('budgetType').isIn(['daily', 'lifetime']),
    body('budgetAmount').isFloat({ min: 0 }),
    body('startDate').isISO8601(),
    body('endDate').optional().isISO8601(),
  ],
  asyncHandler(async (req, res) => {
    const campaign = await prisma.adCampaign.create({
      data: req.body
    });

    logger.info(`Campaign created: ${campaign.id}`);
    res.status(201).json({ data: campaign });
  })
);

// PUT /api/campaigns/:id - Update campaign
router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim(),
    body('status').optional().isIn(['draft', 'scheduled', 'active', 'paused', 'ended', 'archived']),
    body('budgetAmount').optional().isFloat({ min: 0 }),
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const campaign = await prisma.adCampaign.update({
      where: { id },
      data: req.body
    });

    logger.info(`Campaign updated: ${id}`);
    res.json({ data: campaign });
  })
);

// POST /api/campaigns/:id/duplicate - Duplicate campaign
router.post(
  '/:id/duplicate',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const original = await prisma.adCampaign.findUnique({
      where: { id },
      include: {
        adSets: {
          include: {
            ads: true
          }
        }
      }
    });

    if (!original) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Create new campaign with copied data
    const { id: _, metaCampaignId, createdAt, updatedAt, adSets, ...campaignData } = original;
    
    const newCampaign = await prisma.adCampaign.create({
      data: {
        ...campaignData,
        name: `${campaignData.name} (Copy)`,
        status: 'draft',
        isAutoCreated: false
      }
    });

    logger.info(`Campaign duplicated: ${id} -> ${newCampaign.id}`);
    res.status(201).json({ data: newCampaign });
  })
);

// AdSet routes
// GET /api/campaigns/:campaignId/adsets
router.get(
  '/:campaignId/adsets',
  [param('campaignId').isUUID()],
  asyncHandler(async (req, res) => {
    const { campaignId } = req.params;

    const adSets = await prisma.adSet.findMany({
      where: { campaignId },
      include: {
        ads: {
          include: {
            creative: true
          }
        },
        _count: {
          select: { ads: true }
        }
      }
    });

    res.json({ data: adSets });
  })
);

// POST /api/campaigns/:campaignId/adsets
router.post(
  '/:campaignId/adsets',
  [
    param('campaignId').isUUID(),
    body('name').notEmpty().trim(),
    body('targeting').optional().isObject(),
    body('audienceTemplate').optional().trim(),
    body('budgetAmount').optional().isFloat(),
    body('optimizationGoal').notEmpty().trim(),
  ],
  asyncHandler(async (req, res) => {
    const { campaignId } = req.params;

    const adSet = await prisma.adSet.create({
      data: {
        ...req.body,
        campaignId
      }
    });

    logger.info(`AdSet created: ${adSet.id} for campaign ${campaignId}`);
    res.status(201).json({ data: adSet });
  })
);

export { router as campaignsRouter };
