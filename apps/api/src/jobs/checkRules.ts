import { prisma } from '@autoads/database';
import { logger } from '../utils/logger';
import { RuleEngineService } from '../services/ruleEngine.service';

/**
 * Check and execute all active automation rules.
 * This is the sole entry point for scheduled rule execution.
 * All logic is delegated to RuleEngineService.runAllActiveRules().
 */
export async function checkAutomationRules() {
  logger.info('[Job:CheckRules] Starting automation rules check');

  try {
    const result = await RuleEngineService.runAllActiveRules();

    // Update job tracking record
    await prisma.scheduledJob.upsert({
      where: { name: 'check_automation_rules' },
      update: {
        lastRunAt: new Date(),
        runCount: { increment: 1 },
        lastResult: {
          totalRules: result.totalRules,
          executedRules: result.executedRules,
          skippedRules: result.skippedRules,
          totalTriggers: result.totalTriggers,
          totalActions: result.totalActions,
          errors: result.errors,
        },
        lastError: result.errors.length > 0 ? result.errors.join('; ') : null,
      },
      create: {
        name: 'check_automation_rules',
        jobType: 'check_rules',
        cronExpression: '*/15 * * * *',
        isActive: true,
        lastRunAt: new Date(),
        runCount: 1,
        lastResult: {
          totalRules: result.totalRules,
          executedRules: result.executedRules,
          totalTriggers: result.totalTriggers,
        },
      },
    });

    logger.info(
      `[Job:CheckRules] Completed: ${result.executedRules}/${result.totalRules} rules executed, ` +
      `${result.totalTriggers} triggers, ${result.totalActions} actions`
    );

    return result;
  } catch (error) {
    logger.error('[Job:CheckRules] Failed:', error);
    throw error;
  }
}
