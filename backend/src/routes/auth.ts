import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/authService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validate';
import { clearAuthCookies, setAccessCookie, setAuthCookies } from '../utils/authCookies';
import { config } from '../config';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: z.enum(['CANDIDATE', 'RECRUITER']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

router.post('/register', authLimiter, validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;
    const userAgent = req.headers['user-agent'];
    const ip = req.ip;
    const result = await AuthService.register({ name, email, password, role }, userAgent, ip);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.status(201).json({ 
      user: result.user,
      accessToken: result.accessToken 
    });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/login', authLimiter, validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const userAgent = req.headers['user-agent'];
    const ip = req.ip;
    const result = await AuthService.login({ email, password }, userAgent, ip);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({ 
      user: result.user,
      accessToken: result.accessToken
    });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/refresh', authLimiter, async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.[config.cookies.refreshName];
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
    const result = await AuthService.refreshToken(refreshToken);
    if (result.refreshToken) {
      setAuthCookies(res, result.accessToken as string, result.refreshToken as string);
    } else {
      setAccessCookie(res, result.accessToken as string);
    }
    res.json({ ok: true });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.[config.cookies.refreshName];
    if (refreshToken) await AuthService.logout(refreshToken);
    clearAuthCookies(res);
    res.json({ message: 'Logged out' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router;
