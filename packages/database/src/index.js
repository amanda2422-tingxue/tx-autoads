"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.testConnection = testConnection;
exports.disconnect = disconnect;
const client_1 = require("@prisma/client");
// 导出 Prisma Client
exports.prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});
// 导出类型
__exportStar(require("@prisma/client"), exports);
// 数据库连接测试
async function testConnection() {
    try {
        await exports.prisma.$connect();
        await exports.prisma.$queryRaw `SELECT 1`;
        console.log('✓ 数据库连接成功');
        return true;
    }
    catch (error) {
        console.error('✗ 数据库连接失败:', error);
        return false;
    }
}
// 优雅关闭连接
async function disconnect() {
    await exports.prisma.$disconnect();
}
//# sourceMappingURL=index.js.map