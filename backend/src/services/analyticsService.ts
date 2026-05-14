import prisma from '../config/database';

export class AnalyticsService {
  static async getCandidateStats(userId: string) {
    const interviews = await prisma.interview.findMany({
      where: { candidateId: userId },
      include: { questions: { include: { answer: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const completed = interviews.filter(i => i.status === 'COMPLETED');
    const avgScore = completed.length > 0
      ? completed.reduce((s, i) => s + (i.totalScore || 0), 0) / completed.length : 0;

    const breakdowns = completed.filter(i => i.scoreBreakdown).map(i => {
      const value: any = i.scoreBreakdown as any;
      if (!value) return null;
      if (typeof value === 'object') return value;
      try { return JSON.parse(value); } catch { return null; }
    }).filter(Boolean);
    const avg = (field: string) => breakdowns.length > 0
      ? breakdowns.reduce((s: number, b: any) => s + (b[field] || 0), 0) / breakdowns.length : 0;

    const avgT = avg('technical'), avgC = avg('communication'), avgCo = avg('confidence');

    return {
      totalInterviews: interviews.length,
      completedInterviews: completed.length,
      averageScore: Math.round(avgScore * 100) / 100,
      scoreBreakdown: {
        technical: Math.round(avgT * 100) / 100,
        communication: Math.round(avgC * 100) / 100,
        confidence: Math.round(avgCo * 100) / 100,
      },
      scoreHistory: completed.map(i => ({
        date: i.endedAt || i.createdAt, score: i.totalScore || 0, jobRole: i.jobRole,
      })),
      weakAreas: [
        ...(avgT < 60 ? ['Technical Knowledge'] : []),
        ...(avgC < 60 ? ['Communication'] : []),
        ...(avgCo < 60 ? ['Confidence'] : []),
      ],
      strengths: [
        ...(avgT >= 75 ? ['Technical Knowledge'] : []),
        ...(avgC >= 75 ? ['Communication'] : []),
        ...(avgCo >= 75 ? ['Confidence'] : []),
      ],
      trend: completed.map(i => ({
        label: i.endedAt || i.createdAt,
        score: i.totalScore || 0,
      })),
      recentInterviews: interviews.slice(0, 5).map(i => ({
        id: i.id, jobRole: i.jobRole, status: i.status, score: i.totalScore, date: i.createdAt,
      })),
    };
  }

  static async getRecruiterStats(userId: string) {
    const interviews = await prisma.interview.findMany({
      where: { recruiterId: userId },
      include: { candidate: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const completed = interviews.filter(i => i.status === 'COMPLETED');
    const avgScore = completed.length > 0
      ? completed.reduce((s, i) => s + (i.totalScore || 0), 0) / completed.length : 0;

    return {
      totalInterviews: interviews.length,
      completedInterviews: completed.length,
      averageScore: Math.round(avgScore * 100) / 100,
      funnel: {
        total: interviews.length,
        inProgress: interviews.filter(i => i.status === 'IN_PROGRESS').length,
        completed: completed.length,
        hired: completed.filter(i => (i.totalScore || 0) >= 75).length,
      },
      topCandidates: completed.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0)).slice(0, 10).map(i => ({
        name: i.candidate.name, email: i.candidate.email,
        score: i.totalScore, jobRole: i.jobRole, date: i.endedAt,
      })),
    };
  }

  static async getAdminStats() {
    const [totalUsers, totalInterviews, totalResumes, completedInterviews] = await Promise.all([
      prisma.user.count(),
      prisma.interview.count(),
      prisma.resume.count(),
      prisma.interview.findMany({ where: { status: 'COMPLETED' }, select: { totalScore: true } }),
    ]);
    const usersByRole = await prisma.user.groupBy({ by: ['role'], _count: { id: true } });
    const interviewsByStatus = await prisma.interview.groupBy({ by: ['status'], _count: { id: true } });
    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    const avgScore = completedInterviews.length > 0
      ? completedInterviews.reduce((s, i) => s + (i.totalScore || 0), 0) / completedInterviews.length
      : 0;

    return {
      totalUsers, totalInterviews, totalResumes,
      averageScore: Math.round(avgScore * 100) / 100,
      usersByRole: usersByRole.map(u => ({ role: u.role, count: u._count.id })),
      interviewsByStatus: interviewsByStatus.map(i => ({ status: i.status, count: i._count.id })),
      recentUsers,
    };
  }
}
