import { prisma } from '@autoads/database';

async function main() {
  // 1. 查找所有 campaign
  const campaigns = await prisma.adCampaign.findMany({ select: { id: true, name: true } });
  console.log(`总广告系列: ${campaigns.length}`);

  // 2. 找出 mock/unknown campaign
  const mockCampaigns = campaigns.filter(c => {
    const n = (c.name || '').toLowerCase();
    return n.startsWith('camp_test') || n.startsWith('meta_camp_') || n === 'unknown' || !c.name;
  });
  console.log(`\nMock/Unknown 广告系列: ${mockCampaigns.length}`);
  mockCampaigns.forEach(c => console.log(`  ${c.id} | ${c.name}`));

  if (mockCampaigns.length === 0) {
    // 检查孤儿 performance
    const allIds = campaigns.map(c => c.id);
    const orphanPerfs = await prisma.adPerformance.count({
      where: { OR: [{ campaignId: { notIn: allIds } }, { campaignId: null }] },
    });
    console.log(`\n孤儿 performance 记录: ${orphanPerfs}`);
    if (orphanPerfs > 0) {
      const del = await prisma.adPerformance.deleteMany({
        where: { OR: [{ campaignId: { notIn: allIds } }, { campaignId: null }] },
      });
      console.log(`已删除 ${del.count} 条孤儿 performance`);
    }
    console.log('\n清理完成');
    await prisma.$disconnect();
    return;
  }

  const mockIds = mockCampaigns.map(c => c.id);

  // 3. 统计关联数据
  const adSets = await prisma.adSet.findMany({ where: { campaignId: { in: mockIds } }, select: { id: true } });
  const adSetIds = adSets.map(a => a.id);
  const adCount = adSetIds.length > 0 ? await prisma.ad.count({ where: { adSetId: { in: adSetIds } } }) : 0;
  const perfCount = await prisma.adPerformance.count({ where: { campaignId: { in: mockIds } } });

  console.log(`\n将删除:`);
  console.log(`  - ${perfCount} 条 performance 记录`);
  console.log(`  - ${adCount} 条 ad 记录`);
  console.log(`  - ${adSetIds.length} 条 adSet 记录`);
  console.log(`  - ${mockIds.length} 条 campaign 记录`);

  // 4. 按顺序删除（先子后父）
  // 4a. 删 performance（按 campaignId）
  const delPerf = await prisma.adPerformance.deleteMany({ where: { campaignId: { in: mockIds } } });
  console.log(`\n✓ 删除 performance: ${delPerf.count}`);

  // 4b. 删 ad
  if (adSetIds.length > 0) {
    const delAds = await prisma.ad.deleteMany({ where: { adSetId: { in: adSetIds } } });
    console.log(`✓ 删除 ad: ${delAds.count}`);
  }

  // 4c. 删 adSet
  const delAdSets = await prisma.adSet.deleteMany({ where: { campaignId: { in: mockIds } } });
  console.log(`✓ 删除 adSet: ${delAdSets.count}`);

  // 4d. 删 campaign
  const delCamp = await prisma.adCampaign.deleteMany({ where: { id: { in: mockIds } } });
  console.log(`✓ 删除 campaign: ${delCamp.count}`);

  // 5. 清理孤儿 performance
  const allValidIds = campaigns.filter(c => !mockIds.includes(c.id)).map(c => c.id);
  const orphanDel = await prisma.adPerformance.deleteMany({
    where: { OR: [{ campaignId: { notIn: allValidIds } }, { campaignId: null }] },
  });
  if (orphanDel.count > 0) {
    console.log(`✓ 删除孤儿 performance: ${orphanDel.count}`);
  }

  console.log('\n🎉 清理完成！');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
