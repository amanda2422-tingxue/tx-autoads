import { PrismaClient } from '@prisma/client';

// 导出 Prisma Client
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// 导出类型
export * from '@prisma/client';

// 数据库连接测试
export async function testConnection(): Promise<boolean> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('✓ 数据库连接成功');
    return true;
  } catch (error) {
    console.error('✗ 数据库连接失败:', error);
    return false;
  }
}

// 优雅关闭连接
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
