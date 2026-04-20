import { Router } from 'express';
import { creativesRouter } from './creatives';
import { campaignsRouter } from './campaigns';
import { performanceRouter } from './performance';
import { rulesRouter } from './rules';
import { metaRouter } from './meta';

const router = Router();

// Mount routes
router.use('/creatives', creativesRouter);
router.use('/campaigns', campaignsRouter);
router.use('/performance', performanceRouter);
router.use('/rules', rulesRouter);
router.use('/meta', metaRouter);

export { router as routes };
