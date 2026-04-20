import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { prisma } from '@autoads/database';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/creatives - List all creatives
router.get(
  '/',
  [
    query('status').optional().isIn(['draft', 'pending', 'active', 'paused', 'archived']),
    query('type').optional().isIn(['image', 'video', 'carousel', 'collection']),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const { status, type, limit = 20, offset = 0 } = req.query;

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
          variations: true,
          _count: {
            select: { ads: true }
          }
        }
      }),
      prisma.creative.count({ where })
    ]);

    res.json({
      data: creatives,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + creatives.length < total
      }
    });
  })
);

// GET /api/creatives/:id - Get creative by ID
router.get(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const creative = await prisma.creative.findUnique({
      where: { id },
      include: {
        variations: true,
        ads: {
          include: {
            adSet: {
              include: {
                campaign: true
              }
            }
          }
        }
      }
    });

    if (!creative) {
      return res.status(404).json({ error: 'Creative not found' });
    }

    res.json({ data: creative });
  })
);

// POST /api/creatives - Create new creative
router.post(
  '/',
  [
    body('name').notEmpty().trim(),
    body('type').isIn(['image', 'video', 'carousel', 'collection']),
    body('fileUrl').notEmpty().isURL(),
    body('primaryText').optional().trim(),
    body('headline').optional().trim(),
    body('description').optional().trim(),
    body('callToAction').optional().trim(),
    body('tags').optional().isArray(),
  ],
  asyncHandler(async (req, res) => {
    const creative = await prisma.creative.create({
      data: req.body
    });

    logger.info(`Creative created: ${creative.id}`);
    res.status(201).json({ data: creative });
  })
);

// PUT /api/creatives/:id - Update creative
router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim(),
    body('status').optional().isIn(['draft', 'pending', 'active', 'paused', 'archived']),
    body('primaryText').optional().trim(),
    body('headline').optional().trim(),
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const creative = await prisma.creative.update({
      where: { id },
      data: req.body
    });

    logger.info(`Creative updated: ${id}`);
    res.json({ data: creative });
  })
);

// DELETE /api/creatives/:id - Delete creative
router.delete(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await prisma.creative.delete({
      where: { id }
    });

    logger.info(`Creative deleted: ${id}`);
    res.status(204).send();
  })
);

// POST /api/creatives/:id/variations - Create variation
router.post(
  '/:id/variations',
  [
    param('id').isUUID(),
    body('variationType').isIn(['copy', 'image', 'combination']),
    body('primaryText').optional().trim(),
    body('headline').optional().trim(),
    body('description').optional().trim(),
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const variation = await prisma.creativeVariation.create({
      data: {
        ...req.body,
        creativeId: id
      }
    });

    logger.info(`Variation created for creative ${id}`);
    res.status(201).json({ data: variation });
  })
);

export { router as creativesRouter };
