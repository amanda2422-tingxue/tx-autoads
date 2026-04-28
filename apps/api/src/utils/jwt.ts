/**
 * JWT 工具模块
 * 签发与验证 JSON Web Token
 */
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'your_jwt_secret_key_here') {
    throw new Error('JWT_SECRET is not configured. Please set a strong secret in .env');
  }
  return secret;
}

/**
 * 签发 JWT Token
 * @param payload 载荷数据
 * @param expiresIn 过期时间 (默认 24h)
 */
export function signToken(payload: JwtPayload, expiresIn: string = '24h'): string {
  return jwt.sign(payload, getSecret(), {
    expiresIn,
    issuer: 'autoads-platform',
    audience: 'autoads-users',
  });
}

/**
 * 验证并解析 JWT Token
 */
export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, getSecret(), {
    issuer: 'autoads-platform',
    audience: 'autoads-users',
  });
  return decoded as JwtPayload;
}

/**
 * 签发刷新 Token (7天过期)
 */
export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret() + '_refresh', {
    expiresIn: '7d',
    issuer: 'autoads-platform',
  });
}

/**
 * 验证刷新 Token
 */
export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, getSecret() + '_refresh', {
    issuer: 'autoads-platform',
  });
  return decoded as JwtPayload;
}
