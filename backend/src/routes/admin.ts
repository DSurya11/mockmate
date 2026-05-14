import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { validateParams, validateQuery } from '../middleware/validate';

const router = Router();

// All admin routes require ADMIN role
router.use(authenticate, authorize('ADMIN'));

const idParamSchema = z.object({ id: z.string().uuid() });
const paginationSchema = z.object({
  page: z.preprocess((value) => Number(value), z.number().int().min(1).max(100000)).optional(),
  limit: z.preprocess((value) => Number(value), z.number().int().min(1).max(200)).optional(),
});

router.get('/users', validateQuery(paginationSchema), async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip, take: limit, orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      }),
      prisma.user.count(),
    ]);

    res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/users/:id/role', validateParams(idParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.body;
    if (!['CANDIDATE', 'RECRUITER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const user = await prisma.user.update({
      where: { id: req.params.id as string }, data: { role },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/users/:id/toggle', validateParams(idParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id as string } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updated = await prisma.user.update({
      where: { id: req.params.id as string }, data: { isActive: !user.isActive },
      select: { id: true, name: true, isActive: true },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/users/:id', validateParams(idParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'User deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/interviews', validateQuery(paginationSchema), async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const [interviews, total] = await Promise.all([
      prisma.interview.findMany({
        skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: { candidate: { select: { name: true, email: true } } },
      }),
      prisma.interview.count(),
    ]);
    res.json({ interviews, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit-logs', async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
