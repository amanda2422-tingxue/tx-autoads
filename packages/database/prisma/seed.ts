import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化数据库...');

  // 1. 创建示例广告账户
  const adAccount = await prisma.adAccount.upsert({
    where: { metaAccountId: 'act_123456789' },
    update: {},
    create: {
      metaAccountId: 'act_123456789',
      name: 'Zeydoo 主账户',
      currency: 'USD',
      timezone: 'America/New_York',
    },
  });
  console.log('✓ 广告账户已创建:', adAccount.name);

  // 2. 创建示例素材
  const creative = await prisma.creative.create({
    data: {
      name: '示例图片素材',
      type: 'image',
      status: 'active',
      fileUrl: 'https://example.com/creative1.jpg',
      fileHash: 'abc123def456',
      width: 1200,
      height: 628,
      primaryText: '这是一个示例广告文案',
      headline: '示例标题',
      callToAction: 'LEARN_MORE',
      score: 85.5,
      scoreFactors: JSON.stringify({
        visualAppeal: 90,
        textClarity: 85,
        ctaProminence: 88,
      }),
      tags: ['survey', 'questionnaire'],
      labels: ['high-performer'],
    },
  });
  console.log('✓ 示例素材已创建:', creative.name);

  // 3. 关联素材到账户
  await prisma.adAccountCreative.create({
    data: {
      adAccountId: adAccount.id,
      creativeId: creative.id,
      metaAssetId: '1234567890',
    },
  });
  console.log('✓ 素材账户关联已创建');

  // 4. 创建示例自动化规则
  const rule = await prisma.automationRule.create({
    data: {
      name: '高 CPA 自动暂停',
      description: '当 CPA 超过 $0.50 时自动暂停广告',
      ruleType: 'status',
      status: 'active',
      isActive: true,
      applyTo: 'ad',
      targetIds: [],
      conditions: JSON.stringify({
        metric: 'cpa',
        operator: 'greater_than',
        value: 0.5,
        timeWindow: '3d',
      }),
      actions: JSON.stringify({
        action: 'pause',
      }),
      notifyEmails: ['admin@zeydoo.com'],
    },
  });
  console.log('✓ 示例规则已创建:', rule.name);

  // 5. 创建定时任务配置
  const jobs = [
    {
      name: 'sync_performance_data',
      description: '同步广告表现数据',
      jobType: 'sync_data',
      cronExpression: '0 */15 * * * *', // 每15分钟
    },
    {
      name: 'check_automation_rules',
      description: '检查并执行自动化规则',
      jobType: 'check_rules',
      cronExpression: '0 */5 * * * *', // 每5分钟
    },
    {
      name: 'update_creative_scores',
      description: '更新素材评分',
      jobType: 'update_scores',
      cronExpression: '0 0 * * *', // 每天凌晨
    },
  ];

  for (const job of jobs) {
    await prisma.scheduledJob.upsert({
      where: { name: job.name },
      update: {},
      create: job,
    });
    console.log('✓ 定时任务已创建:', job.name);
  }

  console.log('\n数据库初始化完成！');
}

main()
  .catch((e) => {
    console.error('初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
