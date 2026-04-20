import { prisma } from '@autoads/database';
import { logger } from '../utils/logger';

/**
 * Update creative scores based on performance data
 * This job runs daily at midnight
 */
export async function updateCreativeScores() {
  logger.info('Updating creative scores');

  try {
    // 1. Get all active creatives
    const creatives = await prisma.creative.findMany({
      where: { status: 'active' },
      include: {
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

    logger.info(`Found ${creatives.length} creatives to score`);

    // 2. Calculate score for each creative
    for (const creative of creatives) {
      await calculateCreativeScore(creative);
    }

    // 3. Update last run timestamp
    await prisma.scheduledJob.update({
      where: { name: 'update_creative_scores' },
      data: {
        lastRunAt: new Date(),
        runCount: { increment: 1 }
      }
    });

    logger.info('Creative score update completed');
  } catch (error) {
    logger.error('Failed to update creative scores:', error);
    throw error;
  }
}

async function calculateCreativeScore(creative: any) {
  try {
    // Get performance data for this creative's ads
    const adIds = creative.ads.map((ad: any) => ad.id);

    const performanceData = await prisma.adPerformance.findMany({
      where: {
        adId: { in: adIds },
        date: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    });

    if (performanceData.length === 0) {
      logger.debug(`No performance data for creative ${creative.id}`);
      return;
    }

    // Calculate aggregate metrics
    const totals = performanceData.reduce((acc, curr) => ({
      impressions: acc.impressions + curr.impressions,
      clicks: acc.clicks + curr.clicks,
      spend: acc.spend + curr.spend,
      conversions: acc.conversions + curr.conversions,
    }), {
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
    });

    // Calculate metrics
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;

    // Calculate score components (0-100 each)
    // CTR Score: Higher is better, benchmark 2%
    const ctrScore = Math.min(100, (ctr / 2) * 100);

    // CPA Score: Lower is better, benchmark $0.25
    const cpaScore = cpa > 0 ? Math.max(0, 100 - (cpa / 0.25) * 100) : 50;

    // Engagement Score based on impressions
    const engagementScore = Math.min(100, (totals.impressions / 10000) * 100);

    // Overall score (weighted average)
    const overallScore = (ctrScore * 0.4) + (cpaScore * 0.4) + (engagementScore * 0.2);

    // Update creative score
    await prisma.creative.update({
      where: { id: creative.id },
      data: {
        score: Math.round(overallScore * 100) / 100,
        scoreFactors: {
          ctrScore: Math.round(ctrScore * 100) / 100,
          cpaScore: Math.round(cpaScore * 100) / 100,
          engagementScore: Math.round(engagementScore * 100) / 100,
          ctr,
          cpa,
          totalImpressions: totals.impressions,
          totalConversions: totals.conversions,
        }
      }
    });

    logger.debug(`Updated score for creative ${creative.id}: ${overallScore.toFixed(2)}`);
  } catch (error) {
    logger.error(`Failed to calculate score for creative ${creative.id}:`, error);
  }
}
