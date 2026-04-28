import { prisma } from '@autoads/database';
import { logger } from '../utils/logger';
import {
  updateCampaignStatus,
  updateAdSetStatus,
  updateAdStatus,
} from './metaApi.service';

export type Condition = {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
  timeWindow?: string; // '1h', '24h', '7d', '30d'
};

export type Action = {
  type: 'pause' | 'unpause' | 'adjust_budget' | 'adjust_bid' | 'notify';
  params?: Record<string, any>;
};

export type PerformanceData = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpa: number;
  cpc: number;
  cpm: number;
  roas: number;
  reach: number;
  frequency: number;
  days: number;
  epc: number;           // earnings per click = conversions * payout / clicks
  payout: number;        // country payout from benchmark
  profitability: number; // epc / cpc ratio (>1 = profitable, <1 = losing)
  countryCode?: string;
};

export class RuleEngineService {
  // ======================== Utility Methods ========================

  /**
   * Parse time window string to hours
   */
  static parseTimeWindow(timeWindow?: string): number {
    if (!timeWindow) return 24;
    const match = timeWindow.match(/^(\d+)([hd])$/);
    if (!match) return 24;
    const [, num, unit] = match;
    return unit === 'd' ? parseInt(num) * 24 : parseInt(num);
  }

  /**
   * Get the maximum time window across all conditions in a rule
   * (fixes the bug of only using the first condition's timeWindow)
   */
  static getMaxTimeWindow(conditions: Condition[]): number {
    if (!conditions || conditions.length === 0) return 24;
    let maxHours = 0;
    for (const cond of conditions) {
      const hours = this.parseTimeWindow(cond.timeWindow);
      if (hours > maxHours) maxHours = hours;
    }
    return maxHours || 24;
  }

  // ======================== Data Methods ========================

  /**
   * Get aggregated performance data for a target object over a time window
   */
  static async getPerformanceData(
    applyTo: string,
    targetId: string,
    timeWindowHours: number = 24
  ): Promise<PerformanceData> {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - timeWindowHours);
    startDate.setHours(0, 0, 0, 0); // Align to day boundary for daily-aggregated Meta data

    let where: any = { date: { gte: startDate } };

    switch (applyTo) {
      case 'campaign':
        where.campaignId = targetId;
        break;
      case 'adset':
        where.adSetId = targetId;
        break;
      case 'ad':
        where.adId = targetId;
        break;
      default:
        logger.warn(`[RuleEngine] Unknown applyTo: ${applyTo}`);
        return this.getEmptyPerformanceData();
    }

    where.level = applyTo;

    const aggregates = await prisma.adPerformance.aggregate({
      where,
      _sum: {
        spend: true,
        impressions: true,
        clicks: true,
        conversions: true,
        reach: true,
      },
      _avg: {
        roas: true,
        frequency: true,
      },
      _count: { id: true },
    });

    const days = aggregates._count.id || 0;
    const spend = aggregates._sum.spend || 0;
    const impressions = aggregates._sum.impressions || 0;
    const clicks = aggregates._sum.clicks || 0;
    const conversions = aggregates._sum.conversions || 0;
    const reach = aggregates._sum.reach || 0;

    // Calculate derived metrics from aggregated sums (more accurate than averaging pre-computed ratios)
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpa = conversions > 0 ? spend / conversions : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;

    // Get country info and payout for EPC calculation
    const countryCode = await this.getTargetCountryCode(applyTo, targetId);
    const benchmark = countryCode ? await this.getCountryBenchmark(countryCode) : null;
    const payout = benchmark?.payout || 0;
    const epc = clicks > 0 && payout > 0 ? (conversions * payout) / clicks : 0;
    const profitability = cpc > 0 && epc > 0 ? epc / cpc : (conversions > 0 ? 999 : 0);

    return {
      spend,
      impressions,
      clicks,
      conversions,
      ctr,
      cpa,
      cpc,
      cpm,
      roas: aggregates._avg.roas || 0,
      reach,
      frequency: aggregates._avg.frequency || 0,
      days,
      epc,
      payout,
      profitability,
      countryCode: countryCode || undefined,
    };
  }

  static getEmptyPerformanceData(): PerformanceData {
    return {
      spend: 0, impressions: 0, clicks: 0, conversions: 0,
      ctr: 0, cpa: 0, cpc: 0, cpm: 0, roas: 0, reach: 0, frequency: 0,
      days: 0, epc: 0, payout: 0, profitability: 0, countryCode: undefined,
    };
  }

  /**
   * Get payout for a target object's country
   */
  static async getPayoutForTarget(applyTo: string, targetId: string): Promise<number> {
    const countryCode = await this.getTargetCountryCode(applyTo, targetId);
    if (!countryCode) return 0;
    const benchmark = await this.getCountryBenchmark(countryCode);
    return benchmark?.payout || 0;
  }

  /**
   * Get country code for a target object by traversing ad -> adset -> campaign
   * Fixed: Now checks adSet.countryCode first (populated by campaign builder),
   * falls back to campaign.countryRadarConfig.countryCode
   */
  static async getTargetCountryCode(
    applyTo: string,
    targetId: string
  ): Promise<string | null> {
    try {
      if (applyTo === 'ad') {
        const ad = await prisma.ad.findUnique({
          where: { id: targetId },
          include: {
            adSet: {
              select: {
                countryCode: true,
                campaign: { select: { countryRadarConfig: true } },
              },
            },
          },
        });
        return ad?.adSet?.countryCode
          || (ad?.adSet?.campaign?.countryRadarConfig as any)?.countryCode
          || null;
      }

      if (applyTo === 'adset') {
        const adSet = await prisma.adSet.findUnique({
          where: { id: targetId },
          include: {
            campaign: { select: { countryRadarConfig: true } },
          },
        });
        return adSet?.countryCode
          || (adSet?.campaign?.countryRadarConfig as any)?.countryCode
          || null;
      }

      if (applyTo === 'campaign') {
        const campaign = await prisma.adCampaign.findUnique({
          where: { id: targetId },
          select: { countryRadarConfig: true },
        });
        return (campaign?.countryRadarConfig as any)?.countryCode || null;
      }

      return null;
    } catch (err) {
      logger.warn(`[RuleEngine] Failed to get country code for ${applyTo} ${targetId}:`, err);
      return null;
    }
  }

  /**
   * Get country benchmark by country code
   */
  static async getCountryBenchmark(countryCode: string) {
    return prisma.countryBenchmark.findUnique({
      where: { countryCode: countryCode.toUpperCase() },
    });
  }

  /**
   * Get all active country benchmarks
   */
  static async getAllCountryBenchmarks() {
    return prisma.countryBenchmark.findMany({ where: { isActive: true } });
  }

  /**
   * Auto-discover all active target IDs (local UUIDs) for a given level.
   * Used when rule.targetIds is empty → apply to all active objects.
   */
  static async getAllActiveTargetIds(applyTo: string): Promise<string[]> {
    switch (applyTo) {
      case 'campaign': {
        const records = await prisma.adCampaign.findMany({
          where: { status: 'active' },
          select: { id: true },
        });
        return records.map(r => r.id);
      }
      case 'adset': {
        const records = await prisma.adSet.findMany({
          where: { status: 'active' },
          select: { id: true },
        });
        return records.map(r => r.id);
      }
      case 'ad': {
        const records = await prisma.ad.findMany({
          where: { status: 'active' },
          select: { id: true },
        });
        return records.map(r => r.id);
      }
      default:
        return [];
    }
  }

  // ======================== Condition Evaluation ========================

  /**
   * Evaluate if a rule's conditions are met for given performance data
   */
  static evaluateConditions(rule: any, performanceData: PerformanceData): boolean {
    let conditions = (rule.conditions as Condition[]) || [];
    if (typeof conditions === 'string') {
      try { conditions = JSON.parse(conditions); } catch { conditions = []; }
    }
    if (!Array.isArray(conditions)) {
      conditions = conditions ? [conditions as any] : [];
    }
    const logic = rule.conditionLogic || 'AND';

    if (conditions.length === 0) return false;

    const results = conditions.map(condition => {
      const actualValue = performanceData[condition.metric as keyof PerformanceData];
      if (actualValue === undefined) {
        logger.debug(`[RuleEngine] Metric ${condition.metric} not found in performance data`);
        return false;
      }

      const numValue = typeof actualValue === 'number' ? actualValue : parseFloat(actualValue as any);
      if (isNaN(numValue)) return false;

      switch (condition.operator) {
        case '>':  return numValue > condition.value;
        case '<':  return numValue < condition.value;
        case '>=': return numValue >= condition.value;
        case '<=': return numValue <= condition.value;
        case '==': return numValue === condition.value;
        case '!=': return numValue !== condition.value;
        default: return false;
      }
    });

    if (logic === 'OR') {
      return results.some(r => r === true);
    }
    return results.every(r => r === true);
  }

  // ======================== Rule Execution ========================

  /**
   * Execute a single rule against its targets.
   * If targetIds is empty, auto-discovers all active objects of the rule's level.
   */
  static async executeRule(rule: any): Promise<{
    ruleId: string;
    executedAt: string;
    targetsChecked: number;
    targetsTriggered: number;
    actionsExecuted: number;
    errors: string[];
    logs: any[];
  }> {
    const errors: string[] = [];
    const logs: any[] = [];
    let targetsChecked = 0;
    let targetsTriggered = 0;
    let actionsExecuted = 0;

    // Auto-discover targets if none specified
    let targetIds = rule.targetIds || [];
    if (targetIds.length === 0) {
      targetIds = await this.getAllActiveTargetIds(rule.applyTo);
      if (targetIds.length === 0) {
        logger.info(`[RuleEngine] No active ${rule.applyTo} targets found for rule ${rule.id}`);
        return {
          ruleId: rule.id,
          executedAt: new Date().toISOString(),
          targetsChecked: 0, targetsTriggered: 0, actionsExecuted: 0,
          errors: [], logs: [],
        };
      }
      logger.info(`[RuleEngine] Auto-discovered ${targetIds.length} active ${rule.applyTo} targets`);
    }

    // Use max time window across all conditions
    let conditions = rule.conditions as Condition[] || [];
    if (typeof conditions === 'string') {
      try { conditions = JSON.parse(conditions); } catch { conditions = []; }
    }
    if (!Array.isArray(conditions)) conditions = conditions ? [conditions as any] : [];
    const timeWindowHours = this.getMaxTimeWindow(conditions);

    for (const targetId of targetIds) {
      targetsChecked++;

      try {
        const perfData = await this.getPerformanceData(
          rule.applyTo, targetId, timeWindowHours
        );

        // Skip targets with no data (spend = 0, impressions = 0)
        if (perfData.spend === 0 && perfData.impressions === 0) {
          logs.push({ targetId, triggered: false, skipped: true, reason: 'no_data' });
          continue;
        }

        const conditionsMet = this.evaluateConditions(rule, perfData);

        if (conditionsMet) {
          targetsTriggered++;
          const actionResults = await this.executeActions(rule, targetId, perfData);
          actionsExecuted += actionResults.filter(r => r.status === 'success').length;

          logs.push({
            targetId,
            triggered: true,
            performanceData: perfData,
            actions: actionResults,
          });

          logger.info(
            `[RuleEngine] Rule "${rule.name}" TRIGGERED for ${rule.applyTo} ${targetId} ` +
            `(spend=$${perfData.spend.toFixed(2)}, conv=${perfData.conversions}, ` +
            `cpc=$${perfData.cpc.toFixed(4)}, epc=$${perfData.epc.toFixed(4)}, ` +
            `country=${perfData.countryCode || 'unknown'})`
          );
        } else {
          logs.push({
            targetId,
            triggered: false,
            performanceData: perfData,
          });
        }
      } catch (err: any) {
        errors.push(`Target ${targetId}: ${err.message}`);
        logger.error(`[RuleEngine] Error processing target ${targetId}:`, err);
      }
    }

    return {
      ruleId: rule.id,
      executedAt: new Date().toISOString(),
      targetsChecked, targetsTriggered, actionsExecuted,
      errors, logs,
    };
  }

  // ======================== Action Execution ========================

  /**
   * Execute actions defined in the rule
   */
  static async executeActions(
    rule: any,
    targetId: string,
    performanceData: PerformanceData
  ): Promise<any[]> {
    const actions = (rule.actions as Action[]) || [];
    const results = [];

    for (const action of actions) {
      try {
        let result: any;

        switch (action.type) {
          case 'pause':
            result = await this.executePause(rule.applyTo, targetId);
            break;
          case 'unpause':
            result = await this.executeUnpause(rule.applyTo, targetId);
            break;
          case 'adjust_budget':
            result = await this.executeAdjustBudget(rule.applyTo, targetId, action.params);
            break;
          case 'adjust_bid':
            result = await this.executeAdjustBid(rule.applyTo, targetId, action.params);
            break;
          case 'notify':
            result = await this.executeNotify(rule, targetId, performanceData);
            break;
          default:
            result = { type: action.type, status: 'failed', error: `Unknown action type: ${action.type}` };
        }

        results.push(result);
      } catch (err: any) {
        results.push({ type: action.type, status: 'failed', error: err.message });
        logger.error(`[RuleEngine] Action ${action.type} failed:`, err);
      }
    }

    return results;
  }

  /**
   * Execute pause action — updates local DB + pushes PAUSED to Meta API
   */
  static async executePause(applyTo: string, targetId: string): Promise<any> {
    const model = this.getModelByApplyTo(applyTo);
    if (!model) return { type: 'pause', status: 'failed', error: 'Invalid target type' };

    const metaFieldMap: Record<string, string> = {
      adCampaign: 'metaCampaignId',
      adSet: 'metaAdSetId',
      ad: 'metaAdId',
    };
    const metaField = metaFieldMap[model];
    const record = await (prisma as any)[model].findUnique({
      where: { id: targetId },
      select: { [metaField]: true, status: true },
    });

    // Skip if already paused
    if (record?.status === 'paused') {
      return {
        type: 'pause', status: 'skipped', targetId,
        detail: `${applyTo} ${targetId} is already paused`,
      };
    }

    const metaId = record?.[metaField];
    let metaResult: any = null;

    // Push status change to Meta API
    if (metaId) {
      try {
        switch (applyTo) {
          case 'campaign':
            metaResult = await updateCampaignStatus(metaId, 'PAUSED');
            break;
          case 'adset':
            metaResult = await updateAdSetStatus(metaId, 'PAUSED');
            break;
          case 'ad':
            metaResult = await updateAdStatus(metaId, 'PAUSED');
            break;
        }
        logger.info(`[RuleEngine] Paused ${applyTo} on Meta: ${metaId}`);
      } catch (metaErr: any) {
        logger.error(`[RuleEngine] Meta pause failed for ${applyTo} ${metaId}:`, metaErr.message);
        metaResult = { status: 'failed', error: metaErr.message };
        // Continue to update local DB even if Meta call fails
      }
    }

    // Update local database
    await (prisma as any)[model].update({
      where: { id: targetId },
      data: { status: 'paused' },
    });

    return {
      type: 'pause',
      status: 'success',
      targetId,
      metaId,
      metaResult,
      detail: `Paused ${applyTo} ${targetId}` + (metaId ? ` (Meta: ${metaId})` : ' (no Meta ID)'),
    };
  }

  /**
   * Execute unpause action — updates local DB + pushes ACTIVE to Meta API
   */
  static async executeUnpause(applyTo: string, targetId: string): Promise<any> {
    const model = this.getModelByApplyTo(applyTo);
    if (!model) return { type: 'unpause', status: 'failed', error: 'Invalid target type' };

    const metaFieldMap: Record<string, string> = {
      adCampaign: 'metaCampaignId',
      adSet: 'metaAdSetId',
      ad: 'metaAdId',
    };
    const metaField = metaFieldMap[model];
    const record = await (prisma as any)[model].findUnique({
      where: { id: targetId },
      select: { [metaField]: true },
    });
    const metaId = record?.[metaField];

    let metaResult: any = null;
    if (metaId) {
      try {
        switch (applyTo) {
          case 'campaign':
            metaResult = await updateCampaignStatus(metaId, 'ACTIVE');
            break;
          case 'adset':
            metaResult = await updateAdSetStatus(metaId, 'ACTIVE');
            break;
          case 'ad':
            metaResult = await updateAdStatus(metaId, 'ACTIVE');
            break;
        }
        logger.info(`[RuleEngine] Unpaused ${applyTo} on Meta: ${metaId}`);
      } catch (metaErr: any) {
        logger.error(`[RuleEngine] Meta unpause failed for ${applyTo} ${metaId}:`, metaErr.message);
        metaResult = { status: 'failed', error: metaErr.message };
      }
    }

    await (prisma as any)[model].update({
      where: { id: targetId },
      data: { status: 'active' },
    });

    return {
      type: 'unpause', status: 'success', targetId, metaId, metaResult,
      detail: `Unpaused ${applyTo} ${targetId}` + (metaId ? ` (Meta: ${metaId})` : ''),
    };
  }

  /**
   * Execute budget adjustment (local DB only in MVP)
   */
  static async executeAdjustBudget(
    applyTo: string,
    targetId: string,
    params?: Record<string, any>
  ): Promise<any> {
    const model = this.getModelByApplyTo(applyTo);
    if (!model) return { type: 'adjust_budget', status: 'failed', error: 'Invalid target type' };

    const changePercent = params?.changePercent || 0;
    const changeAmount = params?.changeAmount || 0;

    const current = await (prisma as any)[model].findUnique({
      where: { id: targetId },
      select: { budgetAmount: true },
    });

    if (!current) return { type: 'adjust_budget', status: 'failed', error: 'Target not found' };

    let newBudget = current.budgetAmount || 0;
    if (changePercent !== 0) {
      newBudget = newBudget * (1 + changePercent / 100);
    } else if (changeAmount !== 0) {
      newBudget = newBudget + changeAmount;
    }
    newBudget = Math.max(newBudget, 1);

    await (prisma as any)[model].update({
      where: { id: targetId },
      data: { budgetAmount: Math.round(newBudget * 100) / 100 },
    });

    return {
      type: 'adjust_budget', status: 'success', targetId,
      detail: `Budget adjusted from ${current.budgetAmount} to ${newBudget.toFixed(2)}`,
    };
  }

  /**
   * Execute bid adjustment (adset only, local DB only in MVP)
   */
  static async executeAdjustBid(
    applyTo: string,
    targetId: string,
    params?: Record<string, any>
  ): Promise<any> {
    if (applyTo !== 'adset') {
      return { type: 'adjust_bid', status: 'failed', error: 'Bid adjustment only applies to adset' };
    }

    const changePercent = params?.changePercent || 0;
    const current = await prisma.adSet.findUnique({
      where: { id: targetId },
      select: { budgetAmount: true },
    });
    if (!current) return { type: 'adjust_bid', status: 'failed', error: 'AdSet not found' };

    let newAmount = current.budgetAmount || 0;
    if (changePercent !== 0) {
      newAmount = newAmount * (1 + changePercent / 100);
    }
    newAmount = Math.max(newAmount, 1);

    await prisma.adSet.update({
      where: { id: targetId },
      data: { budgetAmount: Math.round(newAmount * 100) / 100 },
    });

    return { type: 'adjust_bid', status: 'success', targetId, detail: `Bid adjusted by ${changePercent}%` };
  }

  /**
   * Execute notification (log-only in MVP)
   */
  static async executeNotify(
    rule: any,
    targetId: string,
    performanceData: PerformanceData
  ): Promise<any> {
    const emails = rule.notifyEmails || [];
    logger.info(`[RuleEngine] ALERT for rule "${rule.name}":`, {
      targetId,
      country: performanceData.countryCode,
      spend: performanceData.spend,
      conversions: performanceData.conversions,
      cpc: performanceData.cpc,
      epc: performanceData.epc,
      emails,
    });

    return {
      type: 'notify', status: 'success', targetId,
      detail: `Alert logged for ${targetId} (country=${performanceData.countryCode}, spend=$${performanceData.spend.toFixed(2)})`,
    };
  }

  // ======================== Helper Methods ========================

  static getModelByApplyTo(applyTo: string): string | null {
    switch (applyTo) {
      case 'campaign': return 'adCampaign';
      case 'adset':    return 'adSet';
      case 'ad':       return 'ad';
      default: return null;
    }
  }

  // ======================== Bulk Execution ========================

  /**
   * Run all active rules — single unified entry point.
   * Called by both the cron job and the /api/rules/run-all endpoint.
   */
  static async runAllActiveRules(): Promise<{
    totalRules: number;
    executedRules: number;
    skippedRules: number;
    totalTriggers: number;
    totalActions: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let executedRules = 0;
    let skippedRules = 0;
    let totalTriggers = 0;
    let totalActions = 0;

    try {
      const activeRules = await prisma.automationRule.findMany({
        where: { isActive: true, status: 'active' },
        orderBy: { createdAt: 'asc' },
      });

      logger.info(`[RuleEngine] === Running ${activeRules.length} active rules ===`);

      for (const rule of activeRules) {
        try {
          // --- Cooldown check ---
          const lastExecution = await prisma.ruleExecutionLog.findFirst({
            where: { ruleId: rule.id, status: 'success' },
            orderBy: { executedAt: 'desc' },
          });

          if (lastExecution && rule.cooldownMinutes > 0) {
            const minutesSinceLastRun =
              (Date.now() - lastExecution.executedAt.getTime()) / (1000 * 60);
            if (minutesSinceLastRun < rule.cooldownMinutes) {
              logger.debug(`[RuleEngine] Rule "${rule.name}" in cooldown (${Math.round(minutesSinceLastRun)}/${rule.cooldownMinutes} min)`);
              skippedRules++;
              continue;
            }
          }

          // --- Max executions check ---
          if (rule.maxExecutions && rule.executionCount >= rule.maxExecutions) {
            logger.info(`[RuleEngine] Rule "${rule.name}" reached max executions (${rule.executionCount}/${rule.maxExecutions}), deactivating`);
            await prisma.automationRule.update({
              where: { id: rule.id },
              data: { isActive: false, status: 'paused' },
            });
            skippedRules++;
            continue;
          }

          // --- Execute the rule ---
          const result = await this.executeRule(rule);
          executedRules++;
          totalTriggers += result.targetsTriggered;
          totalActions += result.actionsExecuted;

          // --- Record execution log ---
          const logStatus = result.errors.length > 0 && result.targetsTriggered === 0
            ? 'failed'
            : result.targetsTriggered > 0 ? 'success' : 'skipped';

          await prisma.ruleExecutionLog.create({
            data: {
              ruleId: rule.id,
              status: logStatus,
              triggerData: {
                targetsChecked: result.targetsChecked,
                targetsTriggered: result.targetsTriggered,
                actionsExecuted: result.actionsExecuted,
              },
              actionsTaken: result.logs.filter(l => l.triggered),
              errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
            },
          });

          // --- Update execution count (only if triggered) ---
          if (result.targetsTriggered > 0) {
            await prisma.automationRule.update({
              where: { id: rule.id },
              data: { executionCount: { increment: 1 } },
            });
          }

          logger.info(
            `[RuleEngine] Rule "${rule.name}": checked=${result.targetsChecked}, ` +
            `triggered=${result.targetsTriggered}, actions=${result.actionsExecuted}`
          );
        } catch (err: any) {
          errors.push(`Rule "${rule.name}": ${err.message}`);
          logger.error(`[RuleEngine] Error executing rule "${rule.name}":`, err);

          await prisma.ruleExecutionLog.create({
            data: {
              ruleId: rule.id,
              status: 'failed',
              errorMessage: err.message,
            },
          });
        }
      }

      logger.info(
        `[RuleEngine] === Completed: ${executedRules} executed, ${skippedRules} skipped, ` +
        `${totalTriggers} triggers, ${totalActions} actions ===`
      );

      return { totalRules: activeRules.length, executedRules, skippedRules, totalTriggers, totalActions, errors };
    } catch (err: any) {
      errors.push(`Failed to load active rules: ${err.message}`);
      return { totalRules: 0, executedRules: 0, skippedRules: 0, totalTriggers: 0, totalActions: 0, errors };
    }
  }
}
