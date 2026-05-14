import { Response } from 'express';
import { config } from '../config';
import { durationToMs } from './time';

const defaultAccessMs = 15 * 60 * 1000;
const defaultRefreshMs = 7 * 24 * 60 * 60 * 1000;

function getCookieOptions() {
  const secure = config.nodeEnv === 'production'
    ? (config.cookies.secure || true)
    : false;

  const sameSite = secure
    ? config.cookies.sameSite
    : 'lax';

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    domain: (config.cookies.domain && config.cookies.domain !== 'undefined') ? config.cookies.domain : undefined,
  } as const;
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const accessMaxAge = durationToMs(config.jwt.expiresIn, defaultAccessMs);
  const refreshMaxAge = durationToMs(config.jwt.refreshExpiresIn, defaultRefreshMs);
  const baseOptions = getCookieOptions();

  res.cookie(config.cookies.accessName, accessToken, {
    ...baseOptions,
    maxAge: accessMaxAge,
  });

  res.cookie(config.cookies.refreshName, refreshToken, {
    ...baseOptions,
    maxAge: refreshMaxAge,
  });
}

export function setAccessCookie(res: Response, accessToken: string) {
  const accessMaxAge = durationToMs(config.jwt.expiresIn, defaultAccessMs);
  const baseOptions = getCookieOptions();

  res.cookie(config.cookies.accessName, accessToken, {
    ...baseOptions,
    maxAge: accessMaxAge,
  });
}

export function clearAuthCookies(res: Response) {
  const baseOptions = getCookieOptions();

  res.clearCookie(config.cookies.accessName, baseOptions);
  res.clearCookie(config.cookies.refreshName, baseOptions);
}
