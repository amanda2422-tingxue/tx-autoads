import { Router } from 'express';
import { creativesRouter } from './creatives';
import { campaignsRouter } from './campaigns';
import { performanceRouter } from './performance';
import { rulesRouter } from './rules';
import { metaRouter } from './meta';
import { countryBenchmarksRouter } from './countryBenchmarks';
import reportsRouter from './reports';
import { authRouter } from './auth';
import { usersRouter } from './users';
import { metaCredentialsRouter } from './metaCredentials';
import { auditLogsRouter } from './auditLogs';
import { adminRouter } from './admin';
import { authenticate } from '../middleware/auth';

const router = Router();

// ====== 公开路由 (无需认证) ======
router.use('/auth', authRouter);

// ====== 需要认证的路由 ======
router.use('/users', usersRouter);
router.use('/meta-credentials', metaCredentialsRouter);
router.use('/audit-logs', auditLogsRouter);
router.use('/admin', adminRouter);

// 业务路由 — 添加全局认证中间件
router.use('/creatives', authenticate, creativesRouter);
router.use('/campaigns', authenticate, campaignsRouter);
router.use('/performance', authenticate, performanceRouter);
router.use('/rules', authenticate, rulesRouter);
router.use('/meta', metaRouter);
router.use('/country-benchmarks', authenticate, countryBenchmarksRouter);
router.use('/reports', authenticate, reportsRouter);

export { router as routes };
