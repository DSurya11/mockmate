import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { InterviewService } from '../services/interviewService';
import { aiLimiter } from '../middleware/rateLimiter';
import { validateBody, validateParams } from '../middleware/validate';

const router = Router();

const createInterviewSchema = z.object({
  jobRole: z.string().min(1).max(200),
  type: z.enum(['TECHNICAL', 'HR', 'DSA', 'SYSTEM_DESIGN', 'BEHAVIORAL', 'MIXED']).optional(),
  recruiterId: z.string().uuid().optional(),
});

const idParamSchema = z.object({ id: z.string().uuid() });
const questionParamSchema = z.object({ questionId: z.string().uuid() });

const submitAnswerSchema = z.object({
  transcript: z.string().min(1).max(20000),
  durationSeconds: z.number().int().positive().max(60 * 60).optional(),
});

const conversationalInterviewSchema = z.object({
  phase: z.enum(['GREETING', 'SMALL_TALK', 'AGENDA', 'BACKGROUND', 'CORE_QUESTIONS', 'CLOSING']),
  interviewer_name: z.string().min(1),
  interviewer_title: z.string().min(1),
  interviewer_tone: z.string().min(1),
  interviewer_specialty: z.string().min(1),
  interview_type: z.string().min(1),
  job_role: z.string().min(1),
  candidate_name: z.string().optional(),
  resume_summary: z.string().optional(),
  candidate_field: z.string().optional(),
  session_duration: z.string().default('45'),
  generated_questions: z.array(z.string()).default([]),
  question_index: z.number().int().min(0).default(0),
  conversation_history: z.array(z.object({ role: z.string(), content: z.string() })).default([]),
  candidate_input: z.string().optional(),
  warmup_questions_asked: z.number().int().default(0),
  exchange_count: z.number().int().default(0),
});

router.post('/', authenticate, validateBody(createInterviewSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { jobRole, type, recruiterId } = req.body;
    if (req.user!.role !== 'CANDIDATE' && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Candidate access required' });
    }
    const interview = await InterviewService.create({
      candidateId: req.user!.id, jobRole, type, recruiterId,
    });
    res.status(201).json(interview);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const interviews = await InterviewService.getByUserId(req.user!.id, req.user!.role);
    res.json(interviews);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/:id', authenticate, validateParams(idParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const interview = await InterviewService.getByIdForUser(req.params.id as string, req.user!);
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    res.json(interview);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.patch('/:id/start', authenticate, validateParams(idParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const interview = await InterviewService.start(req.params.id as string, req.user!);
    res.json(interview);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.patch('/:id/cancel', authenticate, validateParams(idParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const interview = await InterviewService.cancel(req.params.id as string, req.user!);
    res.json(interview);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.patch('/:id/complete', authenticate, validateParams(idParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const interview = await InterviewService.complete(req.params.id as string, req.user!, req.body);
    res.json(interview);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/conversational', authenticate, aiLimiter, validateBody(conversationalInterviewSchema), async (req: AuthRequest, res: Response) => {
  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://mockmate-ai:8000';
    
    const response = await fetch(`${aiServiceUrl}/api/interview/conversational`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('Conversational interview error:', error);
    res.status(500).json({ error: 'Conversational interview failed' });
  }
});

router.post('/questions/:questionId/answer', authenticate, aiLimiter, validateParams(questionParamSchema), validateBody(submitAnswerSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { transcript, durationSeconds } = req.body;
    const answer = await InterviewService.submitAnswer(req.params.questionId as string, req.user!, { transcript, durationSeconds });
    res.status(201).json(answer);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

export default router;
