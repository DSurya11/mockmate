import prisma from '../config/database';
import logger from '../config/logger';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';
import { addEvaluationJob, addReportJob } from '../queues';

type UserContext = { id: string; role: string };

interface CreateInterviewInput {
  candidateId: string;
  jobRole: string;
  type?: 'TECHNICAL' | 'HR' | 'DSA' | 'SYSTEM_DESIGN' | 'BEHAVIORAL' | 'MIXED';
  recruiterId?: string;
}

type ResumeEntitySummary = {
  projectNames: string[];
  technologies: string[];
  skills: string[];
  experienceHighlights: string[];
  scalingClaims: string[];
  deploymentTools: string[];
  monitoringTools: string[];
  queueTools: string[];
  databaseTools: string[];
  websocketTools: string[];
  aiTools: string[];
  rawTextSnippet?: string;
};

const TECH_KEYWORDS = [
  'redis', 'bullmq', 'postgresql', 'postgres', 'prisma', 'docker', 'kubernetes', 'socket.io', 'websocket',
  'websockets', 'prometheus', 'grafana', 'fastapi', 'express', 'typescript', 'node.js', 'nodejs', 'python',
  'jwt', 'bcrypt', 'nginx', 'aws', 'gcp', 'azure', 'vite', 'next.js', 'react', 'queues', 'queue', 'bull',
  'openai', 'groq', 'monitoring', 'metrics', 'retry', 'retries', 'idempotent', 'scaling', 'sharding', 'index',
  'indexes', 'indexing', 'pub/sub', 'pubsub', 'persistence', 'cron', 'worker', 'workers', 'latency', 'cache',
  'caching', 'web rtc', 'webrtc', 's3', 'rds', 'cloudflare', 'terraform', 'ansible', 'ci/cd', 'github actions',
];

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => (typeof item === 'string' ? [item] : []));
  }
  return [];
}

function cleanStrings(values: string[], max = 12): string[] {
  const unique = Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((value, index, array) => array.indexOf(value) === index)
    )
  );
  return unique.slice(0, max);
}

function extractResumeEntities(resume: {
  fileName: string;
  parsedData: unknown;
  rawText: string | null;
  aiFeedback: unknown;
} | null): ResumeEntitySummary | null {
  if (!resume) return null;

  const parsed = (resume.parsedData && typeof resume.parsedData === 'object' ? resume.parsedData : {}) as Record<string, unknown>;
  const rawText = resume.rawText || '';
  const rawLower = rawText.toLowerCase();

  const projectNames = cleanStrings(
    asArray(parsed.projects).flatMap((project) => {
      try {
        const projectObject = project as unknown as Record<string, unknown>;
        const name = typeof projectObject.name === 'string' ? projectObject.name : '';
        return name ? [name] : [];
      } catch {
        return [];
      }
    }),
  );

  const skills = cleanStrings([
    ...asArray(parsed.skills),
    ...asArray(parsed.tech_stack),
    ...asArray(parsed.techStack),
  ]);

  const experienceHighlights = cleanStrings(
    asArray(parsed.experience).flatMap((experience) => {
      const experienceObject = experience as unknown as Record<string, unknown>;
      const highlights = asArray(experienceObject.highlights);
      return highlights.length > 0 ? highlights : [];
    }),
  );

  const technologies = cleanStrings([
    ...skills,
    ...projectNames,
    ...TECH_KEYWORDS.filter((keyword) => rawLower.includes(keyword)),
  ]);

  const scalingClaims = cleanStrings(
    rawText
      .split(/[\n\.]/)
      .map((line) => line.trim())
      .filter((line) => /scale|latency|throughput|optimization|performance|high traffic|queue|cache|monitor/i.test(line)),
    6,
  );

  const deploymentTools = cleanStrings(TECH_KEYWORDS.filter((keyword) => /docker|kubernetes|github actions|ci\/cd|nginx|terraform|aws|gcp|azure|cloudflare/i.test(keyword) && rawLower.includes(keyword)));
  const monitoringTools = cleanStrings(TECH_KEYWORDS.filter((keyword) => /prometheus|grafana|metrics|observability/i.test(keyword) && rawLower.includes(keyword)));
  const queueTools = cleanStrings(TECH_KEYWORDS.filter((keyword) => /redis|bullmq|queue|worker|retries|idempotent|dead-letter/i.test(keyword) && rawLower.includes(keyword)));
  const databaseTools = cleanStrings(TECH_KEYWORDS.filter((keyword) => /postgres|prisma|index|indexing|persistence|sharding|rds/i.test(keyword) && rawLower.includes(keyword)));
  const websocketTools = cleanStrings(TECH_KEYWORDS.filter((keyword) => /socket.io|websocket|websockets|webrtc|pub\/sub/i.test(keyword) && rawLower.includes(keyword)));
  const aiTools = cleanStrings(TECH_KEYWORDS.filter((keyword) => /fastapi|openai|groq|python|llm|prompt|calibration|evaluation/i.test(keyword) && rawLower.includes(keyword)));

  return {
    projectNames,
    technologies,
    skills,
    experienceHighlights,
    scalingClaims,
    deploymentTools,
    monitoringTools,
    queueTools,
    databaseTools,
    websocketTools,
    aiTools,
    rawTextSnippet: rawText.slice(0, 1600),
  };
}

export class InterviewService {
  static async create(input: CreateInterviewInput) {
    const roomId = uuidv4();
    const interview = await prisma.interview.create({
      data: {
        candidateId: input.candidateId,
        recruiterId: input.recruiterId,
        jobRole: input.jobRole,
        type: input.type || 'MIXED',
        roomId,
      },
      include: {
        candidate: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Generate questions via AI synchronously so the frontend has them immediately
    try {
      await this.generateQuestions(interview.id, input.candidateId, input.jobRole, input.type || 'MIXED');
    } catch (err) {
      logger.error({ error: err, interviewId: interview.id }, 'Question generation failed');
    }

    logger.info({ interviewId: interview.id }, 'Interview created');
    return interview;
  }

  static async getById(id: string) {
    return prisma.interview.findUnique({
      where: { id },
      include: {
        candidate: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        recruiter: {
          select: { id: true, name: true, email: true },
        },
        questions: {
          orderBy: { orderNum: 'asc' },
          include: { answer: true },
        },
      },
    });
  }

  static async getByIdForUser(id: string, user: UserContext) {
    const interview = await this.getById(id);
    if (!interview) return null;
    if (user.role === 'ADMIN') return interview;
    if (interview.candidateId !== user.id && interview.recruiterId !== user.id) {
      throw Object.assign(new Error('Access denied'), { status: 403 });
    }
    return interview;
  }

  static async getByUserId(userId: string, role: string) {
    const where = role === 'RECRUITER'
      ? { recruiterId: userId }
      : { candidateId: userId };

    return prisma.interview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        candidate: {
          select: { id: true, name: true, email: true },
        },
        questions: {
          select: { id: true },
        },
      },
    });
  }

  static async start(id: string, user: UserContext) {
    const interview = await this.getByIdForUser(id, user);
    if (!interview) throw Object.assign(new Error('Interview not found'), { status: 404 });
    if (interview.status !== 'SCHEDULED') {
      throw Object.assign(new Error('Interview cannot be started'), { status: 409 });
    }
    return prisma.interview.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });
  }

  static async cancel(id: string, user: UserContext) {
    const interview = await this.getByIdForUser(id, user);
    if (!interview) throw Object.assign(new Error('Interview not found'), { status: 404 });
    if (interview.status !== 'IN_PROGRESS') {
      throw Object.assign(new Error('Interview cannot be cancelled'), { status: 409 });
    }

    const result = await prisma.interview.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        endedAt: new Date(),
      },
    });

    logger.info({ interviewId: id }, 'Interview cancelled');
    return result;
  }

  static async complete(id: string, user: UserContext, body?: {
    conversationHistory?: Array<{ role: string; content: string }>;
    jobRole?: string;
    interviewType?: string;
  }) {
    await this.getByIdForUser(id, user);
    const interview = await prisma.interview.findUnique({
      where: { id },
      include: {
        questions: {
          include: { answer: true },
        },
      },
    });

    if (!interview) {
      throw Object.assign(new Error('Interview not found'), { status: 404 });
    }

    if (interview.status !== 'IN_PROGRESS') {
      throw Object.assign(new Error('Interview cannot be completed'), { status: 409 });
    }

    // Calculate total score from answers with real scores only (Q&A interview path)
    const answers = interview.questions
      .map(q => q.answer)
      .filter((a): a is NonNullable<typeof a> => Boolean(a));

    const scoredOverall = answers.filter(a => typeof a.overallScore === 'number');
    const avg = (arr: typeof answers, field: keyof typeof answers[number]) => {
      if (arr.length === 0) return null;
      const sum = arr.reduce((s, a) => s + (a[field] as number), 0);
      return sum / arr.length;
    };

    const avgOverall = avg(scoredOverall, 'overallScore');
    const avgTechnical = avg(answers.filter(a => typeof a.technicalScore === 'number'), 'technicalScore');
    const avgComm = avg(answers.filter(a => typeof a.communicationScore === 'number'), 'communicationScore');
    const avgConfidence = avg(answers.filter(a => typeof a.confidenceScore === 'number'), 'confidenceScore');

    // Conversational interview scoring path — call AI service if conversation history is provided
    let conversationalScore: number | null = null;
    let scoredExchanges = 0;
    if (body?.conversationHistory && body.conversationHistory.length > 0) {
      try {
        const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://mockmate-ai:8000';
        const evalRes = await fetch(`${aiServiceUrl}/api/interview/evaluate-conversation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_history: body.conversationHistory,
            job_role: body.jobRole || interview.jobRole,
            interview_type: body.interviewType || interview.type,
          }),
        });
        if (evalRes.ok) {
          const evalData = await evalRes.json() as { overallScore: number | null; scoredExchanges: number };
          if (typeof evalData.overallScore === 'number') {
            conversationalScore = Math.round(evalData.overallScore * 100) / 100;
            scoredExchanges = evalData.scoredExchanges;
          }
        }
      } catch (err) {
        logger.warn({ interviewId: id, err }, 'Conversation evaluation failed — falling back to Q&A score');
      }
    }

    // Use conversational score if available, otherwise fall back to Q&A average
    const totalScore = conversationalScore !== null
      ? conversationalScore
      : (avgOverall === null ? null : Math.round(avgOverall * 100) / 100);

    const result = await prisma.interview.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
        totalScore,
        scoreBreakdown: {
          technical: avgTechnical,
          communication: avgComm,
          confidence: avgConfidence,
          questionsAnswered: answers.length,
          scoredAnswers: scoredOverall.length,
          totalQuestions: interview.questions.length,
          scoredExchanges,
          scoringStatus: totalScore !== null
            ? 'complete'
            : (scoredOverall.length === 0 ? 'pending' : 'partial'),
        },
      },
    });

    // Enqueue report generation via BullMQ (non-blocking)
    addReportJob({ interviewId: id }).catch(err =>
      logger.error({ error: err, interviewId: id }, 'Failed to enqueue report generation')
    );

    logger.info({ interviewId: id, totalScore }, 'Interview completed');
    return result;
  }

  static async submitAnswer(questionId: string, user: UserContext, data: {
    transcript: string;
    durationSeconds?: number;
  }) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { interview: true },
    });

    if (!question) {
      throw Object.assign(new Error('Question not found'), { status: 404 });
    }

    if (user.role !== 'ADMIN' && question.interview.candidateId !== user.id) {
      throw Object.assign(new Error('Access denied'), { status: 403 });
    }

    if (question.interview.status !== 'IN_PROGRESS') {
      throw Object.assign(new Error('Interview is not in progress'), { status: 409 });
    }

    // Count filler words
    const fillerWords = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally', 'so', 'well'];
    const transcript = data.transcript.toLowerCase();
    const fillerWordCount = fillerWords.reduce((count, word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      return count + (transcript.match(regex) || []).length;
    }, 0);

    // Create or update answer
    const answer = await prisma.answer.upsert({
      where: { questionId },
      create: {
        questionId,
        transcript: data.transcript,
        durationSeconds: data.durationSeconds,
        fillerWordCount,
      },
      update: {
        transcript: data.transcript,
        durationSeconds: data.durationSeconds,
        fillerWordCount,
      },
    });

    // Enqueue AI evaluation via BullMQ (non-blocking, with retries)
    addEvaluationJob({
      answerId: answer.id,
      question: question.questionText,
      transcript: data.transcript,
      idealAnswer: question.idealAnswer,
    }).catch(err =>
      logger.error({ error: err, answerId: answer.id }, 'Failed to enqueue answer evaluation')
    );

    try {
      const allQuestions = await prisma.question.findMany({
        where: { interviewId: question.interviewId, orderNum: { lte: question.orderNum } },
        orderBy: { orderNum: 'asc' },
        include: { answer: true }
      });
      
      const history = allQuestions.map(q => ({
        question: q.questionText,
        answer: q.answer?.transcript || ""
      }));

      const totalQuestions = await prisma.question.count({ where: { interviewId: question.interviewId } });
      const currentFollowups = totalQuestions - 8;
      
      // Limit to 4 follow-ups maximum (12 total questions), and only if answer is substantial
      if (totalQuestions < 12 && data.transcript.trim().length > 15 && currentFollowups < 4) {
        const response = await fetch(`${config.aiService.url}/api/interview/followup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: question.questionText,
            transcript: data.transcript,
            history: history
          }),
        });

        if (response.ok) {
          const { followupText } = await response.json();
          if (followupText) {
            await prisma.$transaction([
              prisma.question.updateMany({
                where: { interviewId: question.interviewId, orderNum: { gt: question.orderNum } },
                data: { orderNum: { increment: 1 } },
              }),
              prisma.question.create({
                data: {
                  interviewId: question.interviewId,
                  questionText: followupText,
                  category: question.category,
                  difficulty: 'HARD',
                  orderNum: question.orderNum + 1,
                },
              }),
            ]);
            logger.info({ interviewId: question.interviewId }, 'Followup question injected');
          }
        }
      }
    } catch (err) {
      logger.error({ error: err, interviewId: question.interviewId }, 'Failed to generate adaptive followup');
    }

    return answer;
  }

  static async generateQuestions(interviewId: string, candidateId: string, jobRole: string, type: string) {
    try {
      const latestResume = await prisma.resume.findFirst({
        where: { userId: candidateId },
        orderBy: { uploadedAt: 'desc' },
      });
      const resumeContext = extractResumeEntities(latestResume);

      const response = await fetch(`${config.aiService.url}/api/interview/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId,
          jobRole,
          type,
          resumeText: resumeContext ? JSON.stringify(resumeContext) : null,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI service returned ${response.status}`);
      }

      const data: any = await response.json();
      const questions = data.questions;
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('AI returned no questions');
      }

      const allowedCategories = new Set(['TECHNICAL', 'HR', 'DSA', 'SYSTEM_DESIGN', 'BEHAVIORAL']);
      const allowedDifficulties = new Set(['EASY', 'MEDIUM', 'HARD']);

      const payload = questions.map((q: any, index: number) => {
        if (!q?.text || typeof q.text !== 'string') {
          throw new Error('Invalid question text');
        }
        const category = q.category || 'TECHNICAL';
        const difficulty = q.difficulty || 'MEDIUM';
        if (!allowedCategories.has(category)) {
          throw new Error(`Invalid question category: ${category}`);
        }
        if (!allowedDifficulties.has(difficulty)) {
          throw new Error(`Invalid question difficulty: ${difficulty}`);
        }
        return {
          interviewId,
          questionText: q.text,
          category,
          difficulty,
          orderNum: index + 1,
          idealAnswer: q.idealAnswer || null,
        };
      });

      await prisma.$transaction(async (tx) => {
        await tx.question.createMany({ data: payload });
      });

      logger.info({ interviewId, count: payload.length, hasResumeContext: Boolean(resumeContext) }, 'Questions generated');
    } catch (error) {
      logger.error({ error, interviewId }, 'Failed to generate questions via AI');
      // Fallback: create default questions
      await this.createDefaultQuestions(interviewId, jobRole, type);
    }
  }

  private static async createDefaultQuestions(interviewId: string, jobRole: string, type: string) {
    const defaultQuestions = [
      { text: `Tell me about a project on your resume and the most important tradeoff you made.`, category: 'BEHAVIORAL' as const, difficulty: 'EASY' as const },
      { text: `You mentioned ${jobRole}. Which part of that work would you defend most strongly in a design review?`, category: 'TECHNICAL' as const, difficulty: 'EASY' as const },
      { text: `Walk me through one architecture decision from your resume and what would break if it were removed.`, category: 'BEHAVIORAL' as const, difficulty: 'MEDIUM' as const },
      { text: `If I pushed on the queueing, database, or websocket layer in your project, what bottleneck would show up first?`, category: 'TECHNICAL' as const, difficulty: 'MEDIUM' as const },
      { text: `How would you debug a production issue where your AI evaluation jobs are delayed but still completing?`, category: 'TECHNICAL' as const, difficulty: 'MEDIUM' as const },
      { text: `Design the weakest part of your current interview platform so it survives a 10x traffic spike.`, category: 'SYSTEM_DESIGN' as const, difficulty: 'HARD' as const },
      { text: `Tell me about a time a technical choice you made turned out to be wrong, and how you proved it.`, category: 'BEHAVIORAL' as const, difficulty: 'MEDIUM' as const },
      { text: `What would be the first thing you would rewrite if you had to take this project to production next week?`, category: 'TECHNICAL' as const, difficulty: 'HARD' as const },
    ];

    for (let i = 0; i < defaultQuestions.length; i++) {
      await prisma.question.create({
        data: {
          interviewId,
          questionText: defaultQuestions[i].text,
          category: defaultQuestions[i].category,
          difficulty: defaultQuestions[i].difficulty,
          orderNum: i + 1,
        },
      });
    }
  }
}
