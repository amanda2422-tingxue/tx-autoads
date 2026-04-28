import { Router } from 'express';
import { body, param } from 'express-validator';
import { prisma } from '@autoads/database';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/country-benchmarks - List all country benchmarks
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const benchmarks = await prisma.countryBenchmark.findMany({
      orderBy: { countryCode: 'asc' },
    });
    res.json({ data: benchmarks });
  })
);

// GET /api/country-benchmarks/:countryCode - Get benchmark by country code
router.get(
  '/:countryCode',
  [param('countryCode').isLength({ min: 2, max: 2 }).isAlpha()],
  asyncHandler(async (req, res) => {
    const { countryCode } = req.params;
    const benchmark = await prisma.countryBenchmark.findUnique({
      where: { countryCode },
    });

    if (!benchmark) {
      return res.status(404).json({ error: 'Country benchmark not found' });
    }

    res.json({ data: benchmark });
  })
);

// POST /api/country-benchmarks - Create new benchmark
router.post(
  '/',
  [
    body('countryCode').isLength({ min: 2, max: 2 }).isAlpha(),
    body('countryName').notEmpty().trim(),
    body('payout').isFloat({ min: 0 }),
    body('breakEvenCvr').isFloat({ min: 0 }),
    body('targetCvr').isFloat({ min: 0 }),
    body('ctrThreshold').isFloat({ min: 0 }),
    body('cpcCeiling').isFloat({ min: 0 }),
    body('roasBuffer').optional().isFloat({ min: 0 }),
    body('isActive').optional().isBoolean(),
  ],
  asyncHandler(async (req, res) => {
    const benchmark = await prisma.countryBenchmark.create({
      data: req.body,
    });
    logger.info(`Country benchmark created: ${benchmark.countryCode}`);
    res.status(201).json({ data: benchmark });
  })
);

// PUT /api/country-benchmarks/:countryCode - Update benchmark
router.put(
  '/:countryCode',
  [
    param('countryCode').isLength({ min: 2, max: 2 }).isAlpha(),
    body('countryName').optional().trim(),
    body('payout').optional().isFloat({ min: 0 }),
    body('breakEvenCvr').optional().isFloat({ min: 0 }),
    body('targetCvr').optional().isFloat({ min: 0 }),
    body('ctrThreshold').optional().isFloat({ min: 0 }),
    body('cpcCeiling').optional().isFloat({ min: 0 }),
    body('roasBuffer').optional().isFloat({ min: 0 }),
    body('isActive').optional().isBoolean(),
  ],
  asyncHandler(async (req, res) => {
    const { countryCode } = req.params;

    const benchmark = await prisma.countryBenchmark.update({
      where: { countryCode },
      data: req.body,
    });

    logger.info(`Country benchmark updated: ${countryCode}`);
    res.json({ data: benchmark });
  })
);

// DELETE /api/country-benchmarks/:countryCode - Delete benchmark
router.delete(
  '/:countryCode',
  [param('countryCode').isLength({ min: 2, max: 2 }).isAlpha()],
  asyncHandler(async (req, res) => {
    const { countryCode } = req.params;

    await prisma.countryBenchmark.delete({
      where: { countryCode },
    });

    logger.info(`Country benchmark deleted: ${countryCode}`);
    res.status(204).send();
  })
);

// POST /api/country-benchmarks/seed - Seed default benchmarks (idempotent)
router.post(
  '/seed',
  asyncHandler(async (req, res) => {
    const defaultBenchmarks = [
      {
        countryCode: 'PH',
        countryName: 'Philippines',
        payout: 0.25,
        breakEvenCvr: 4.8,
        targetCvr: 6.0,
        ctrThreshold: 0.8,
        cpcCeiling: 0.015,
        roasBuffer: 0.9,
        isActive: true,
      },
      {
        countryCode: 'BD',
        countryName: 'Bangladesh',
        payout: 0.25,
        breakEvenCvr: 4.5,
        targetCvr: 5.5,
        ctrThreshold: 0.8,
        cpcCeiling: 0.015,
        roasBuffer: 0.9,
        isActive: true,
      },
      {
        countryCode: 'PK',
        countryName: 'Pakistan',
        payout: 0.08,
        breakEvenCvr: 10.0,
        targetCvr: 12.0,
        ctrThreshold: 0.8,
        cpcCeiling: 0.010,
        roasBuffer: 0.9,
        isActive: true,
      },
      {
        countryCode: 'BR',
        countryName: 'Brazil',
        payout: 0.25,
        breakEvenCvr: 4.0,
        targetCvr: 5.0,
        ctrThreshold: 0.8,
        cpcCeiling: 0.012,
        roasBuffer: 0.9,
        isActive: true,
      },
    ];

    const results = [];
    for (const data of defaultBenchmarks) {
      const benchmark = await prisma.countryBenchmark.upsert({
        where: { countryCode: data.countryCode },
        update: data,
        create: data,
      });
      results.push(benchmark);
    }

    logger.info(`Country benchmarks seeded: ${results.length} countries`);
    res.json({
      data: results,
      message: `Seeded ${results.length} country benchmarks`,
    });
  })
);

export { router as countryBenchmarksRouter };
