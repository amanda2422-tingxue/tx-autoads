/**
 * 数据迁移脚本：修复历史 Campaign/Creative 缺少 ownerId 的问题
 * 
 * 问题背景：
 *   V4.2 引入凭据隔离架构后，resolveCredentialConfig() 依赖 Campaign.ownerId
 *   来查找对应用户的个人 Meta 凭据。历史记录（V4.2 之前创建的）缺少 ownerId，
 *   导致 Meta Insights 同步和 re-push 操作失败。
 * 
 * 策略：
 *   1. 查找所有 ownerId 为 null 的 Campaign 和 Creative
 *   2. 尝试通过 AuditLog 匹配创建者（creator heuristic）
 *   3. 通过 Campaign 名称中的用户名关键词智能匹配（name heuristic）
 *   4. 通过 Creative 设计师字段匹配对应 designer 用户
 *   5. 无法匹配的，分配给第一个拥有 Meta 凭据的 admin 用户
 * 
 * 用法：
 *   npx ts-node scripts/fix-missing-owner.ts --dry     # 预览模式
 *   npx ts-node scripts/fix-missing-owner.ts            # 执行修复
 */

import { prisma } from '../packages/database/src/index';
const DRY_RUN = process.argv.includes('--dry');

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  AutoAds 数据迁移：修复缺失 ownerId`);
  console.log(`  模式: ${DRY_RUN ? '🔍 预览 (DRY RUN)' : '⚡ 执行'}`);
  console.log(`  时间: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  // ==================== Phase 1: 数据审计 ====================
  console.log('--- Phase 1: 数据审计 ---\n');

  const orphanCampaigns = await prisma.adCampaign.findMany({
    where: { ownerId: null },
    select: { id: true, name: true, status: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const orphanCreatives = await prisma.creative.findMany({
    where: { ownerId: null },
    select: { id: true, name: true, status: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`  Campaigns 缺少 ownerId: ${orphanCampaigns.length}`);
  console.log(`  Creatives 缺少 ownerId: ${orphanCreatives.length}`);

  if (orphanCampaigns.length === 0 && orphanCreatives.length === 0) {
    console.log('\n✅ 无需修复，所有记录已有 ownerId。');
    return;
  }

  // 列出受影响的记录
  if (orphanCampaigns.length > 0) {
    console.log('\n  受影响的 Campaigns:');
    orphanCampaigns.forEach((c, i) => {
      console.log(`    ${i + 1}. [${c.status}] ${c.name} (${c.id.slice(0, 8)}...) - 创建于 ${c.createdAt.toISOString().slice(0, 10)}`);
    });
  }

  if (orphanCreatives.length > 0) {
    console.log('\n  受影响的 Creatives:');
    orphanCreatives.slice(0, 20).forEach((c, i) => {
      console.log(`    ${i + 1}. [${c.status}] ${c.name} (${c.id.slice(0, 8)}...) - 创建于 ${c.createdAt.toISOString().slice(0, 10)}`);
    });
    if (orphanCreatives.length > 20) {
      console.log(`    ... 及其他 ${orphanCreatives.length - 20} 条`);
    }
  }

  // ==================== Phase 2: 确定分配策略 ====================
  console.log('\n--- Phase 2: 确定分配策略 ---\n');

  // 获取所有用户及其凭据状态
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      metaCredentials: { select: { id: true, isDefault: true, tokenStatus: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`  系统用户数: ${users.length}`);
  users.forEach(u => {
    const credCount = u.metaCredentials.length;
    const hasValid = u.metaCredentials.some(c => c.tokenStatus !== 'expired');
    console.log(`    - ${u.username} / ${u.displayName} (${u.role}, ${u.isActive ? '活跃' : '禁用'}, 凭据: ${credCount}${hasValid ? '✓' : ''}) [${u.id.slice(0, 8)}...]`);
  });

  // 构建名称匹配表：Campaign 名称中常见的用户标识 → userId
  // 例如 "FB_Zeydoo_BD_Amanda_20260423_G1" 中 "Amanda" 可匹配 "Amanda Wang"
  const nameMatches = new Map<string, string>(); // campaignId -> userId

  for (const campaign of orphanCampaigns) {
    const campaignName = campaign.name.toLowerCase();
    // 尝试匹配每个用户的 displayName 或 username
    for (const user of users) {
      if (!user.isActive) continue;
      const names = [
        user.displayName?.toLowerCase(),
        user.username?.toLowerCase(),
        // 也检查 displayName 的各个部分（如 "Amanda Wang" → "amanda"、"wang"）
        ...(user.displayName || '').toLowerCase().split(/\s+/),
      ].filter(Boolean);

      for (const name of names) {
        // 避免太短的名字误匹配（至少 3 个字符）
        if (name && name.length >= 3 && campaignName.includes(name)) {
          nameMatches.set(campaign.id, user.id);
          break;
        }
      }
      if (nameMatches.has(campaign.id)) break;
    }
  }

  if (nameMatches.size > 0) {
    console.log(`\n  通过 Campaign 名称智能匹配到 ${nameMatches.size} 条:`);
    for (const [campId, userId] of nameMatches) {
      const camp = orphanCampaigns.find(c => c.id === campId);
      const user = users.find(u => u.id === userId);
      console.log(`    "${camp?.name}" → ${user?.username} (名称匹配)`);
    }
  }

  // 构建 Creative 设计师匹配表
  // 例如 "XZH-BN-0320-8.png" 中前缀 "XZH" 匹配设计师用户
  const orphanCreativesWithDesigner = await prisma.creative.findMany({
    where: { ownerId: null },
    select: { id: true, name: true, designer: true },
  });

  const designerMatches = new Map<string, string>(); // creativeId -> userId
  const designerUsers = users.filter(u => u.role === 'designer' && u.isActive);

  for (const creative of orphanCreativesWithDesigner) {
    // 尝试通过 designer 字段匹配
    if (creative.designer) {
      const designerName = creative.designer.toLowerCase();
      for (const user of designerUsers) {
        if (
          user.username.toLowerCase().includes(designerName) ||
          (user.displayName && user.displayName.toLowerCase().includes(designerName))
        ) {
          designerMatches.set(creative.id, user.id);
          break;
        }
      }
    }

    // 若 designer 字段无法匹配，尝试从文件名前缀推断
    if (!designerMatches.has(creative.id) && creative.name) {
      const prefix = creative.name.split('-')[0]?.toUpperCase();
      if (prefix && prefix.length >= 2 && prefix.length <= 5) {
        for (const user of designerUsers) {
          // 匹配用户名拼音缩写（如 向中华 → XZH, 裴云溪 → PYX）
          const userInitials = user.username
            .split('')
            .filter(c => c.match(/[A-Z]/))
            .join('');
          if (userInitials === prefix) {
            designerMatches.set(creative.id, user.id);
            break;
          }
        }
      }
    }
  }

  if (designerMatches.size > 0) {
    console.log(`\n  通过设计师标识匹配到 ${designerMatches.size} 条 Creative`);
  }

  // 确定兜底用户：优先选择有 Meta 凭据的 admin
  const adminWithCredentials = users.find(
    u => u.role === 'admin' && u.isActive && u.metaCredentials.length > 0
  );
  const anyAdmin = users.find(u => u.role === 'admin' && u.isActive);
  const fallbackUser = users.find(u => u.isActive);
  const targetUser = adminWithCredentials || anyAdmin || fallbackUser;

  if (!targetUser) {
    console.error('\n❌ 错误：系统中无可用的活跃用户，无法分配 ownerId。');
    console.error('   请先创建至少一个活跃用户后再运行此脚本。');
    return;
  }

  console.log(`\n  兜底分配用户: ${targetUser.username} / ${targetUser.displayName} (${targetUser.role}${targetUser.metaCredentials.length > 0 ? ', 有凭据' : ''}) [${targetUser.id.slice(0, 8)}...]`);

  // 尝试通过 AuditLog 匹配（如果有记录的话）
  const auditMatches = new Map<string, string>(); // campaignId -> userId

  try {
    const createLogs = await prisma.auditLog.findMany({
      where: {
        action: 'create',
        resourceType: { in: ['campaign', 'adCampaign'] },
        resourceId: { in: orphanCampaigns.map(c => c.id) },
        userId: { not: null },
      },
      select: { resourceId: true, userId: true },
    });

    createLogs.forEach(log => {
      if (log.resourceId && log.userId) {
        auditMatches.set(log.resourceId, log.userId);
      }
    });

    if (auditMatches.size > 0) {
      console.log(`  通过审计日志匹配到 ${auditMatches.size} 条创建者记录`);
    }
  } catch (e) {
    console.log('  审计日志查询跳过（表可能不存在或为空）');
  }

  // ==================== Phase 3: 执行修复 ====================
  console.log('\n--- Phase 3: 执行修复 ---\n');

  // 合并所有匹配结果（优先级：审计日志 > 名称匹配 > 兜底用户）
  const campaignAssignments = new Map<string, { userId: string; source: string }>();
  for (const c of orphanCampaigns) {
    if (auditMatches.has(c.id)) {
      campaignAssignments.set(c.id, { userId: auditMatches.get(c.id)!, source: '审计日志' });
    } else if (nameMatches.has(c.id)) {
      campaignAssignments.set(c.id, { userId: nameMatches.get(c.id)!, source: '名称匹配' });
    } else {
      campaignAssignments.set(c.id, { userId: targetUser.id, source: '兜底分配' });
    }
  }

  const creativeAssignments = new Map<string, { userId: string; source: string }>();
  for (const c of orphanCreatives) {
    if (designerMatches.has(c.id)) {
      creativeAssignments.set(c.id, { userId: designerMatches.get(c.id)!, source: '设计师匹配' });
    } else {
      creativeAssignments.set(c.id, { userId: targetUser.id, source: '兜底分配' });
    }
  }

  if (DRY_RUN) {
    console.log('  🔍 DRY RUN - 以下操作不会实际执行:\n');

    // Campaign 修复预览
    const sourceCounts: Record<string, number> = {};
    for (const [campId, assignment] of campaignAssignments) {
      const camp = orphanCampaigns.find(c => c.id === campId);
      const user = users.find(u => u.id === assignment.userId);
      console.log(`    Campaign "${camp?.name}" → ${user?.username} (${assignment.source})`);
      sourceCounts[assignment.source] = (sourceCounts[assignment.source] || 0) + 1;
    }

    // Creative 修复预览（限显示前 10 条）
    let shown = 0;
    for (const [crId, assignment] of creativeAssignments) {
      if (shown >= 10) break;
      const cr = orphanCreatives.find(c => c.id === crId);
      const user = users.find(u => u.id === assignment.userId);
      console.log(`    Creative "${cr?.name}" → ${user?.username} (${assignment.source})`);
      shown++;
    }
    if (orphanCreatives.length > 10) {
      console.log(`    ... 及其他 ${orphanCreatives.length - 10} 条 Creative`);
    }

    console.log(`\n  Campaign 分配汇总:`);
    for (const [source, count] of Object.entries(sourceCounts)) {
      console.log(`    ${source}: ${count} 条`);
    }

    const creativeSourceCounts: Record<string, number> = {};
    for (const [, assignment] of creativeAssignments) {
      creativeSourceCounts[assignment.source] = (creativeSourceCounts[assignment.source] || 0) + 1;
    }
    console.log(`  Creative 分配汇总:`);
    for (const [source, count] of Object.entries(creativeSourceCounts)) {
      console.log(`    ${source}: ${count} 条`);
    }

    console.log('\n  ℹ️  去掉 --dry 参数以执行实际修复。');
    return;
  }

  // 实际执行
  let campaignFixed = 0;
  let creativeFixed = 0;

  // 3a. 修复 Campaign ownerId（逐条执行以支持不同用户分配）
  for (const [campaignId, assignment] of campaignAssignments) {
    await prisma.adCampaign.update({
      where: { id: campaignId },
      data: { ownerId: assignment.userId },
    });
    campaignFixed++;
    const camp = orphanCampaigns.find(c => c.id === campaignId);
    const user = users.find(u => u.id === assignment.userId);
    console.log(`  ✓ Campaign "${camp?.name}" → ${user?.username} (${assignment.source})`);
  }

  console.log(`\n  ✅ Campaigns 修复: ${campaignFixed}/${orphanCampaigns.length}`);

  // 3b. 修复 Creative ownerId
  // 按 userId 分组批量更新，提高效率
  const creativesByUser = new Map<string, string[]>();
  for (const [crId, assignment] of creativeAssignments) {
    if (!creativesByUser.has(assignment.userId)) {
      creativesByUser.set(assignment.userId, []);
    }
    creativesByUser.get(assignment.userId)!.push(crId);
  }

  for (const [userId, creativeIds] of creativesByUser) {
    const result = await prisma.creative.updateMany({
      where: { id: { in: creativeIds } },
      data: { ownerId: userId },
    });
    creativeFixed += result.count;
    const user = users.find(u => u.id === userId);
    console.log(`  ✓ ${result.count} 条 Creative → ${user?.username}`);
  }

  console.log(`\n  ✅ Creatives 修复: ${creativeFixed}/${orphanCreatives.length}`);

  // ==================== Phase 4: 验证 ====================
  console.log('\n--- Phase 4: 验证 ---\n');

  const remainingOrphanCampaigns = await prisma.adCampaign.count({ where: { ownerId: null } });
  const remainingOrphanCreatives = await prisma.creative.count({ where: { ownerId: null } });

  console.log(`  剩余无 ownerId 的 Campaigns: ${remainingOrphanCampaigns}`);
  console.log(`  剩余无 ownerId 的 Creatives: ${remainingOrphanCreatives}`);

  if (remainingOrphanCampaigns === 0 && remainingOrphanCreatives === 0) {
    console.log('\n✅ 数据迁移完成！所有记录已分配 ownerId。');
  } else {
    console.warn('\n⚠️  仍有部分记录未修复，请检查原因。');
  }

  // 汇总报告
  console.log(`\n${'='.repeat(60)}`);
  console.log('  迁移报告');
  console.log(`${'='.repeat(60)}`);
  console.log(`  Campaigns 修复: ${campaignFixed}`);
  console.log(`  Creatives 修复: ${creativeFixed}`);
  console.log(`  Campaign 匹配来源: 审计${auditMatches.size} + 名称${nameMatches.size} + 兜底${orphanCampaigns.length - auditMatches.size - nameMatches.size}`);
  console.log(`  Creative 匹配来源: 设计师${designerMatches.size} + 兜底${orphanCreatives.length - designerMatches.size}`);
  console.log(`  兜底用户: ${targetUser.username}`);
  console.log(`  剩余未修复: ${remainingOrphanCampaigns + remainingOrphanCreatives}`);
  console.log(`${'='.repeat(60)}\n`);
}

main()
  .catch((error) => {
    console.error('\n❌ 迁移失败:', error.message);
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
