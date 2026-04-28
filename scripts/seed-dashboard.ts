import { prisma } from '../packages/database/src/index';

async function seedDashboardData() {
  console.log('Seeding mock data for dashboard testing...');

  // 0. Create account
  const account = await prisma.adAccount.upsert({
    where: { metaAccountId: 'acc_dashboard_test' },
    update: {},
    create: {
      metaAccountId: 'acc_dashboard_test',
      name: 'Main Advertising Account',
      status: 'active',
    }
  });

  // 1. Create 3 campaigns
  const campaigns = [];
  for (let i = 1; i <= 3; i++) {
    const camp = await prisma.adCampaign.upsert({
      where: { metaCampaignId: `camp_test_${i}` },
      update: {},
      create: {
        name: `Performance Campaign ${i}`,
        metaCampaignId: `camp_test_${i}`,
        objective: 'CONVERSIONS',
        status: 'active',
        budgetType: 'daily',
        budgetAmount: 100 * i,
        startDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        adAccountId: account.id
      }
    });
    campaigns.push(camp);
  }

  // 2. Generate daily data for last 30 days
  console.log('Generating 30 days of performance data...');
  for (let d = 0; d < 30; d++) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    date.setHours(0, 0, 0, 0);

    for (const camp of campaigns) {
      // Randomize data based on campaign index
      const spend = Math.random() * 50 + 20 * (campaigns.indexOf(camp) + 1);
      const impressions = Math.floor(spend * (Math.random() * 50 + 100));
      const clicks = Math.floor(impressions * (Math.random() * 0.05 + 0.01));
      const conversions = Math.floor(clicks * (Math.random() * 0.1 + 0.02));
      const cpa = conversions > 0 ? spend / conversions : spend;

      await prisma.adPerformance.upsert({
        where: {
          level_metaObjectId_date_hour: {
            level: 'campaign',
            metaObjectId: camp.metaCampaignId!,
            date: date,
            hour: 0
          }
        },
        update: {
          spend,
          impressions,
          clicks,
          conversions,
          cpa,
          ctr: impressions > 0 ? clicks / impressions : 0
        },
        create: {
          level: 'campaign',
          metaObjectId: camp.metaCampaignId!,
          date: date,
          hour: 0,
          spend,
          impressions,
          clicks,
          conversions,
          cpa,
          ctr: impressions > 0 ? clicks / impressions : 0,
          campaignId: camp.id
        }
      });
    }
  }

  console.log('Dashboard data seeded successfully.');
}

seedDashboardData()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
