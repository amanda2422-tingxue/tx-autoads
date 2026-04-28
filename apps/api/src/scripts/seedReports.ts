import { prisma } from '@autoads/database';

async function main() {
  const exists = await prisma.savedReport.findFirst({ where: { isSystem: true } });
  if (exists) {
    console.log('系统默认报表已存在，跳过');
    await prisma.$disconnect();
    return;
  }

  await prisma.savedReport.createMany({
    data: [
      {
        name: '国家日报',
        isSystem: true,
        description: '每天必看，各国盈亏状态一览',
        config: {
          dimensions: ['date', 'country'],
          metrics: ['spend', 'conversions', 'clicks', 'impressions', 'ctr', 'cvr', 'cpc', 'cpa'],
          filters: {},
          sortBy: 'date',
          sortOrder: 'desc',
        },
      },
      {
        name: '素材效果排行',
        isSystem: true,
        description: '找出头部素材，驱动迭代决策',
        config: {
          dimensions: ['creative', 'country'],
          metrics: ['spend', 'conversions', 'clicks', 'impressions', 'ctr', 'cvr', 'cpc', 'frequency'],
          filters: {},
          sortBy: 'conversions',
          sortOrder: 'desc',
        },
      },
      {
        name: '广告活动总览',
        isSystem: true,
        description: 'Campaign 级整体表现',
        config: {
          dimensions: ['campaign', 'country'],
          metrics: ['spend', 'conversions', 'clicks', 'impressions', 'ctr', 'cvr', 'cpc', 'cpa'],
          filters: {},
          sortBy: 'spend',
          sortOrder: 'desc',
        },
      },
      {
        name: '受众模板对比',
        isSystem: true,
        description: '对比不同受众策略的 ROAS 差异',
        config: {
          dimensions: ['audienceTemplate', 'country'],
          metrics: ['spend', 'conversions', 'clicks', 'cvr', 'cpc'],
          filters: {},
          sortBy: 'cvr',
          sortOrder: 'desc',
        },
      },
      {
        name: '国家雷达监控',
        isSystem: true,
        description: 'M7 监测组 vs 跑量组表现对比',
        config: {
          dimensions: ['radarType', 'country', 'date'],
          metrics: ['spend', 'conversions', 'clicks', 'cvr', 'cpc'],
          filters: { radarTypes: ['monitor', 'scaling'] },
          sortBy: 'date',
          sortOrder: 'desc',
        },
      },
    ],
  });

  console.log('✅ 已创建 5 个系统默认报表');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
