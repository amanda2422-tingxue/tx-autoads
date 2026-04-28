import { prisma } from '../packages/database/src/index';

async function seedMockData() {
  console.log('Seeding mock data for rule engine testing...');

  // 0. Create a mock ad account
  const account = await prisma.adAccount.upsert({
    where: { metaAccountId: 'acc_123' },
    update: {},
    create: {
      metaAccountId: 'acc_123',
      name: 'Test Account',
      status: 'active',
      currency: 'USD',
      timezone: 'America/New_York'
    }
  });

  // 1. Create a mock campaign
  const campaign = await prisma.adCampaign.upsert({
    where: { metaCampaignId: 'meta_camp_123' },
    update: {},
    create: {
      name: 'Test Campaign for Rules',
      metaCampaignId: 'meta_camp_123',
      objective: 'CONVERSIONS',
      status: 'active',
      budgetType: 'daily',
      budgetAmount: 100,
      startDate: new Date(),
      adAccountId: account.id
    }
  });

  // 2. Create mock performance data (High CPA scenario)
  // Use a unique combination for upsert
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  await prisma.adPerformance.upsert({
    where: {
      level_metaObjectId_date_hour: {
        level: 'campaign',
        metaObjectId: 'meta_camp_123',
        date: today,
        hour: 12
      }
    },
    update: {
      spend: 50,
      conversions: 1,
      cpa: 50 // High CPA
    },
    create: {
      level: 'campaign',
      metaObjectId: 'meta_camp_123',
      date: today,
      hour: 12,
      spend: 50,
      impressions: 1000,
      clicks: 50,
      conversions: 1,
      cpa: 50,
      campaignId: campaign.id
    }
  });

  // 3. Create an active rule
  await prisma.automationRule.create({
    data: {
      name: 'High CPA Auto Pause (Test)',
      ruleType: 'status',
      applyTo: 'campaign',
      targetIds: ['meta_camp_123'],
      conditions: [
        { metric: 'cpa', operator: '>', value: 40 }
      ],
      actions: [
        { type: 'pause', params: {} }
      ],
      isActive: true,
      status: 'active',
      cooldownMinutes: 1
    }
  });

  console.log('Mock data seeded successfully.');
}

seedMockData()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
