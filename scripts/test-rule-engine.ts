import { checkAutomationRules } from '../apps/api/src/jobs/checkRules';
import { prisma } from '../packages/database/src/index';

async function testRuleExecution() {
  console.log('Testing Rule Engine Execution...');
  
  await checkAutomationRules();
  
  console.log('Fetching execution logs...');
  const logs = await prisma.ruleExecutionLog.findMany({
    orderBy: { executedAt: 'desc' },
    take: 5
  });
  
  console.log('Recent Logs:', JSON.stringify(logs, null, 2));
}

testRuleExecution()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
