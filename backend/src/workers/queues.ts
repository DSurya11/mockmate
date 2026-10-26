import { Worker, Job } from 'bullmq';
import prisma from '../config/database';
import { callAiService } from '../config/aiService';
import logger from '../config/logger';
import { downloadFromSupabase } from '../config/supabaseStorage';
import {
  resumeQueue,
  evaluationQueue,
  reportQueue,
  deadLetterQueue,
  redisConnection,
} from '../queues';
import { startWorkerMetricsServer, workerMetrics } from './workerMetrics';

const aiTimeoutMs = parseInt(process.env.AI_TIMEOUT_MS || '30000', 10);

function isFinalFailure(job: Job) {
  const attempts = job.opts.attempts ?? 1;
  return job.attemptsMade >= attempts;
}


// Resume Analysis Worker
const resumeWorker = new Worker('resume-analysis', async (job: Job) => {
  workerMetrics.activeJobs.inc({ queue: 'resume-analysis' });
  logger.info({ jobId: job.id, resumeId: job.data.resumeId }, 'Processing resume analysis');

  try {
    const resume = await prisma.resume.findUnique({ where: { id: job.data.resumeId } });
    if (!resume) throw new Error('Resume not found');

    // Download file buffer from Supabase Storage (fileUrl is the Supabase public URL)
    const fileBuffer = await downloadFromSupabase(resume.fileUrl);
    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' }), resume.fileName);

    // Waits for a sleeping AI service like the interview does (it used to give up after 6 s).
    const response = await callAiService(
      '/api/resume/upload-analyze',
      { method: 'POST', body: formData },
      aiTimeoutMs * 2,
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`AI service returned ${response.status}: ${body}`);
    }

    const result: any = await response.json();

    if (typeof result.atsScore !== 'number') {
      throw new Error('AI response missing atsScore');
    }

    await prisma.resume.update({
      where: { id: job.data.resumeId },
      data: {
        parsedData: result.parsedData,
        rawText: result.rawText,
        atsScore: result.atsScore,
        aiFeedback: result.aiFeedback,
      },
    });

    workerMetrics.completedJobs.inc({ queue: 'resume-analysis' });
    logger.info({ jobId: job.id, resumeId: job.data.resumeId, atsScore: result.atsScore }, 'Resume analysis completed');
    return result;
  } finally {
    workerMetrics.activeJobs.dec({ queue: 'resume-analysis' });
  }
}, {
  connection: redisConnection,
  concurrency: 3,
  limiter: { max: 10, duration: 60000 },
});

// Answer Evaluation Worker
const evaluationWorker = new Worker('answer-evaluation', async (job: Job) => {
  workerMetrics.activeJobs.inc({ queue: 'answer-evaluation' });
  logger.info({ jobId: job.id, answerId: job.data.answerId }, 'Processing answer evaluation');

  try {
    const response = await callAiService(
      '/api/evaluate/answer',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job.data),
      },
      aiTimeoutMs,
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`AI service returned ${response.status}: ${body}`);
    }

    const result: any = await response.json();

    if (typeof result.technicalScore !== 'number' || typeof result.overallScore !== 'number') {
      throw new Error('AI response missing required score fields');
    }

    await prisma.answer.update({
      where: { id: job.data.answerId },
      data: {
        technicalScore: result.technicalScore,
        communicationScore: result.communicationScore,
        confidenceScore: result.confidenceScore,
        overallScore: result.overallScore,
        aiFeedback: result.feedback,
      },
    });

    workerMetrics.completedJobs.inc({ queue: 'answer-evaluation' });
    logger.info({ jobId: job.id, answerId: job.data.answerId, overallScore: result.overallScore }, 'Answer evaluation completed');
    return result;
  } finally {
    workerMetrics.activeJobs.dec({ queue: 'answer-evaluation' });
  }
}, {
  connection: redisConnection,
  concurrency: 5,
  limiter: { max: 20, duration: 60000 },
});

// Report Generation Worker
const reportWorker = new Worker('report-generation', async (job: Job) => {
  workerMetrics.activeJobs.inc({ queue: 'report-generation' });
  logger.info({ jobId: job.id, interviewId: job.data.interviewId }, 'Generating report');

  try {
    const interview = await prisma.interview.findUnique({
      where: { id: job.data.interviewId },
      include: { questions: { include: { answer: true } }, candidate: true },
    });
    if (!interview) throw new Error('Interview not found');

    const answers = interview.questions.map(q => q.answer).filter(Boolean) as any[];
    const scored = answers.filter(a => typeof a.overallScore === 'number');
    const avg = (arr: any[], key: string) => {
      if (arr.length === 0) return null;
      return Math.round((arr.reduce((s, a) => s + (a[key] ?? 0), 0) / arr.length) * 100) / 100;
    };

    const report = {
      generatedAt: new Date().toISOString(),
      candidateId: interview.candidateId,
      interviewId: interview.id,
      jobRole: interview.jobRole,
      overallScore: avg(scored, 'overallScore'),
      breakdown: {
        technical: avg(scored, 'technicalScore'),
        communication: avg(scored, 'communicationScore'),
        confidence: avg(scored, 'confidenceScore'),
      },
      questions: interview.questions.map(q => ({
        id: q.id,
        text: q.questionText,
        category: q.category,
        difficulty: q.difficulty,
        answered: !!q.answer,
        scores: q.answer ? {
          technical: q.answer.technicalScore,
          communication: q.answer.communicationScore,
          confidence: q.answer.confidenceScore,
          overall: q.answer.overallScore,
        } : null,
        feedback: q.answer?.aiFeedback ?? null,
      })),
      answeredCount: answers.length,
      scoredCount: scored.length,
      totalQuestions: interview.questions.length,
      // Preserve conversation history saved during completion — do not overwrite
      conversationHistory: (interview.report as any)?.conversationHistory || [],
      // Saved by complete() with the conversation; this rebuild must not drop it.
      evaluation: (interview.report as any)?.evaluation ?? null,
    };

    await prisma.interview.update({
      where: { id: interview.id },
      data: { report },
    });

    // complete() scores the conversation once, straight away. When every free model was
    // rate-limited at that moment the interview has no score: score it here, and throw on
    // failure so BullMQ tries again later (the backoff spans the providers' per-minute limits).
    if (report.evaluation === null && report.conversationHistory.length > 0) {
      const res = await callAiService('/api/interview/evaluate-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_history: report.conversationHistory,
          job_role: interview.jobRole,
          interview_type: interview.type,
        }),
      }, aiTimeoutMs * 3);
      if (!res.ok) throw new Error(`Conversation scoring failed: AI service returned ${res.status}`);
      const evaluation = await res.json() as { overallScore: number | null; scoredExchanges: number };
      const score = typeof evaluation.overallScore === 'number'
        ? Math.round(evaluation.overallScore * 100) / 100
        : null;
      await prisma.interview.update({
        where: { id: interview.id },
        data: {
          report: { ...report, evaluation },
          ...(score !== null ? {
            totalScore: score,
            scoreBreakdown: {
              ...((interview.scoreBreakdown as any) ?? {}),
              scoredExchanges: evaluation.scoredExchanges,
              scoringStatus: 'complete',
            },
          } : {}),
        },
      });
      logger.info({ interviewId: interview.id, score }, 'Conversation scored by the report worker');
    }

    workerMetrics.completedJobs.inc({ queue: 'report-generation' });
    logger.info({ jobId: job.id, interviewId: job.data.interviewId }, 'Report generated');
    return report;
  } finally {
    workerMetrics.activeJobs.dec({ queue: 'report-generation' });
  }
}, { connection: redisConnection, concurrency: 2 });

// Dead-letter failure handler
async function handleFinalFailure(job: Job, err: Error, queueName: string) {
  await deadLetterQueue.add('failed', {
    queue: queueName,
    jobId: job.id,
    data: job.data,
    error: err.message,
    failedAt: new Date().toISOString(),
  });

  if (queueName === 'resume-analysis') {
    await prisma.resume.update({
      where: { id: job.data.resumeId },
      data: {
        atsScore: null,
        aiFeedback: {
          status: 'error',
          message: 'Resume analysis failed after all retries',
          error: err.message,
        },
      },
    });
  }

  if (queueName === 'answer-evaluation') {
    await prisma.answer.update({
      where: { id: job.data.answerId },
      data: {
        technicalScore: null,
        communicationScore: null,
        confidenceScore: null,
        overallScore: null,
        aiFeedback: {
          status: 'error',
          message: 'AI evaluation failed after all retries',
          error: err.message,
        },
      },
    });
  }

  logger.error({ queue: queueName, jobId: job.id, error: err.message }, 'Job moved to dead-letter queue');
}

// Wire up event handlers
[resumeWorker, evaluationWorker, reportWorker].forEach((worker) => {
  worker.on('completed', (job) => {
    logger.info({ queue: worker.name, jobId: job?.id }, 'Job completed');
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;
    logger.error({ queue: worker.name, jobId: job.id, error: err.message, attempt: job.attemptsMade }, 'Job failed');
    workerMetrics.failedJobs.inc({ queue: worker.name });
    if (isFinalFailure(job)) {
      await handleFinalFailure(job, err, worker.name);
    }
  });
});

startWorkerMetricsServer();
logger.info('Background workers initialized — listening for jobs');
