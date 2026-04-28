import cron from 'node-cron';
import { logger } from '../utils/logger';
import { syncPerformanceData } from './syncPerformance';
import { checkAutomationRules } from './checkRules';
import { updateCreativeScores } from './updateScores';
import { checkTokenExpiry } from './checkTokenExpiry';

export function initScheduledJobs() {
  logger.info('Initializing scheduled jobs...');

  // Job 1: Sync performance data every 15 minutes, then check rules
  // Rules check is chained AFTER sync to ensure decisions are based on fresh data
  cron.schedule('0 */15 * * * *', async () => {
    logger.info('[Job] Starting performance data sync + rules check cycle');
    try {
      // Step 1: Sync data from Meta
      await syncPerformanceData();
      logger.info('[Job] Performance data sync completed, starting rules check...');

      // Step 2: Check automation rules (with fresh data)
      await checkAutomationRules();
      logger.info('[Job] Sync + rules check cycle completed');
    } catch (error) {
      logger.error('[Job] Sync + rules check cycle failed:', error);
    }
  });

  // Job 2: Update creative scores daily at midnight
  cron.schedule('0 0 0 * * *', async () => {
    logger.info('[Job] Starting creative score update');
    try {
      await updateCreativeScores();
      logger.info('[Job] Creative score update completed');
    } catch (error) {
      logger.error('[Job] Creative score update failed:', error);
    }
  });

  // Job 3: Check Meta token expiry daily at 09:00 AM
  cron.schedule('0 0 9 * * *', async () => {
    logger.info('[Job] Starting token expiry check');
    try {
      const result = await checkTokenExpiry();
      logger.info(`[Job] Token expiry check completed: ${JSON.stringify(result)}`);
    } catch (error) {
      logger.error('[Job] Token expiry check failed:', error);
    }
  });

  logger.info('Scheduled jobs initialized successfully');
}

export { syncPerformanceData, checkAutomationRules, updateCreativeScores };
