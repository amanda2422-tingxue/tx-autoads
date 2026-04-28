import { prisma } from '@autoads/database';
import { logger } from '../utils/logger';
import { syncInsightsFromMeta } from '../services/metaApi.service';
import dayjs from 'dayjs';

/**
 * Sync performance data from Meta API to local database
 * This job runs every 15 minutes
 */
export async function syncPerformanceData() {
  logger.info('Syncing performance data from Meta API');

  try {
    // Use the real Meta API insights sync implementation
    // Sync last 2 days to cover any gaps (Meta API may have delayed data)
    const startDate = dayjs().subtract(2, 'day').format('YYYY-MM-DD');
    const endDate = dayjs().format('YYYY-MM-DD');

    const result = await syncInsightsFromMeta({
      startDate,
      endDate,
    });

    logger.info(`Performance data sync completed: ${result.synced} records, ${result.errors.length} errors`);

    if (result.errors.length > 0) {
      logger.warn(`Sync errors: ${result.errors.join('; ')}`);
    }

    // Update last sync timestamp
    await prisma.scheduledJob.upsert({
      where: { name: 'sync_performance_data' },
      update: {
        lastRunAt: new Date(),
        runCount: { increment: 1 },
      },
      create: {
        name: 'sync_performance_data',
        jobType: 'sync_data',
        cronExpression: '0 */15 * * * *',
        isActive: true,
        lastRunAt: new Date(),
        runCount: 1,
      },
    });
  } catch (error) {
    logger.error('Failed to sync performance data:', error);
    throw error;
  }
}
