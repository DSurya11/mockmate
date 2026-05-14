import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import prisma from '../config/database';
import { config } from '../config';
import logger from '../config/logger';
import { durationToMs } from '../utils/time';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role?: 'CANDIDATE' | 'RECRUITER';
}

interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  static async register(input: RegisterInput, userAgent?: string, ipAddress?: string) {
    const { name, email, password, role } = input;

    if (role && !['CANDIDATE', 'RECRUITER'].includes(role)) {
      throw Object.assign(new Error('Invalid role for registration'), { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw Object.assign(new Error('Email already registered'), { status: 409 });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: role || 'CANDIDATE',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    const tokens = await this.generateTokens(user, userAgent, ipAddress);
    logger.info({ userId: user.id }, 'User registered');

    return { user, ...tokens };
  }

  static async login(input: LoginInput, userAgent?: string, ipAddress?: string) {
    const { email, password } = input;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }

    if (!user.isActive) {
      throw Object.assign(new Error('Account disabled'), { status: 403 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }

    const tokens = await this.generateTokens(user, userAgent, ipAddress);
    logger.info({ userId: user.id }, 'User logged in');

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      ...tokens,
    };
  }

  static async refreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as { id: string; sessionId: string };

      const session = await prisma.session.findUnique({
        where: { id: decoded.sessionId },
        include: { user: true },
      });

      if (!session) {
        throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
      }

      if (session.userId !== decoded.id) {
        await prisma.session.delete({ where: { id: session.id } });
        throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
      }

      if (new Date() > session.expiresAt) {
        await prisma.session.delete({ where: { id: session.id } });
        throw Object.assign(new Error('Refresh token expired'), { status: 401 });
      }

      const tokenHash = this.hashToken(refreshToken);
      const graceMs = 30 * 1000;
      const now = new Date();

      if (session.refreshTokenHash !== tokenHash) {
        const withinGrace = session.previousRefreshTokenHash
          && session.previousRefreshTokenHash === tokenHash
          && session.rotatedAt
          && (now.getTime() - session.rotatedAt.getTime() <= graceMs);

        if (!withinGrace) {
          await prisma.session.delete({ where: { id: session.id } });
          throw Object.assign(new Error('Refresh token revoked'), { status: 401 });
        }

        const accessToken = this.generateAccessToken(session.user);
        logger.info({ sessionId: session.id, userId: session.userId }, 'Refresh grace token accepted');
        return { accessToken };
      }

      const accessToken = this.generateAccessToken(session.user);
      const newRefreshToken = this.generateRefreshToken(session.user.id, session.id);
      const newRefreshHash = this.hashToken(newRefreshToken);
      const refreshMs = durationToMs(config.jwt.refreshExpiresIn, 7 * 24 * 60 * 60 * 1000);
      const expiresAt = new Date(Date.now() + refreshMs);

      await prisma.session.update({
        where: { id: session.id },
        data: {
          previousRefreshTokenHash: tokenHash,
          refreshTokenHash: newRefreshHash,
          rotatedAt: now,
          expiresAt,
        },
      });

      return { accessToken, refreshToken: newRefreshToken };
    } catch (error: any) {
      if (error.status) throw error;
      throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
    }
  }

  static async logout(refreshToken: string) {
    if (!refreshToken) return;
    const tokenHash = this.hashToken(refreshToken);
    await prisma.session.deleteMany({ where: { refreshTokenHash: tokenHash } });
  }

  static async logoutAll(userId: string) {
    await prisma.session.deleteMany({ where: { userId } });
  }

  private static generateAccessToken(user: { id: string; email: string; role: string; name: string }) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as any }
    );
  }

  private static generateRefreshToken(userId: string, sessionId: string) {
    return jwt.sign(
      { id: userId, sessionId },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn as any }
    );
  }

  private static hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private static async generateTokens(
    user: { id: string; email: string; role: string; name: string },
    userAgent?: string,
    ipAddress?: string
  ) {
    const accessToken = this.generateAccessToken(user);
    const sessionId = uuidv4();

    const refreshToken = this.generateRefreshToken(user.id, sessionId);
    const refreshTokenHash = this.hashToken(refreshToken);
    const refreshMs = durationToMs(config.jwt.refreshExpiresIn, 7 * 24 * 60 * 60 * 1000);
    const expiresAt = new Date(Date.now() + refreshMs);

    await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
