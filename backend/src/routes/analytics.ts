import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AnalyticsService } from '../services/analyticsService';

const router = Router();

router.get('/candidate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await AnalyticsService.getCandidateStats(req.user!.id);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recruiter', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'RECRUITER' && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Recruiter access required' });
    }
    const stats = await AnalyticsService.getRecruiterStats(req.user!.id);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const stats = await AnalyticsService.getAdminStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
