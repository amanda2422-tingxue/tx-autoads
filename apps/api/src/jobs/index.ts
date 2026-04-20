import cron from 'node-cron';
import { logger } from '../utils/logger';
import { syncPerformanceData } from './syncPerformance';
import { checkAutomationRules } from './checkRules';
import { updateCreativeScores } from './updateScores';

export function initScheduledJobs() {
  logger.info('Initializing scheduled jobs...');

  // Job 1: Sync performance data every 15 minutes
  // Pattern: minute hour day month weekday
  cron.schedule('0 */15 * * * *', async () => {
    logger.info('[Job] Starting performance data sync');
    try {
      await syncPerformanceData();
      logger.info('[Job] Performance data sync completed');
    } catch (error) {
      logger.error('[Job] Performance data sync failed:', error);
    }
  });

  // Job 2: Check automation rules every 5 minutes
  cron.schedule('0 */5 * * * *', async () => {
    logger.info('[Job] Starting automation rules check');
    try {
      await checkAutomationRules();
      logger.info('[Job] Automation rules check completed');
    } catch (error) {
      logger.error('[Job] Automation rules check failed:', error);
    }
  });

  // Job 3: Update creative scores daily at midnight
  cron.schedule('0 0 0 * * *', async () => {
    logger.info('[Job] Starting creative score update');
    try {
      await updateCreativeScores();
      logger.info('[Job] Creative score update completed');
    } catch (error) {
      logger.error('[Job] Creative score update failed:', error);
    }
  });

  logger.info('Scheduled jobs initialized successfully');
}

export { syncPerformanceData, checkAutomationRules, updateCreativeScores };
