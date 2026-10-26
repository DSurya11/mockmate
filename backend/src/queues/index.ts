import { Queue } from 'bullmq';
import crypto from 'crypto';
import { config } from '../config';

const redisUrl = new URL(config.redis.url);
export const redisConnection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379', 10),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
};

export const resumeQueue = new Queue('resume-analysis', { connection: redisConnection });
export const evaluationQueue = new Queue('answer-evaluation', { connection: redisConnection });
export const reportQueue = new Queue('report-generation', { connection: redisConnection });
export const deadLetterQueue = new Queue('dead-letter', { connection: redisConnection });

export async function addResumeJob(data: { resumeId: string; fileUrl: string; fileName: string }) {
  const jobId = `resume-${data.resumeId}`;
  // BullMQ ignores an add() whose jobId already exists, and a failed job is kept (removeOnFail),
  // so Retry on a failed analysis used to do nothing. A finished job is removed first; one that is
  // still waiting or running is left alone (the add below is then a no-op, as intended).
  const previous = await resumeQueue.getJob(jobId);
  if (previous && ((await previous.isFailed()) || (await previous.isCompleted()))) {
    await previous.remove();
  }
  return resumeQueue.add('analyze', data, {
    jobId,
    // The AI service itself is waited for inside each attempt (callAiService); these attempts
    // cover longer outages: 20 s, 40 s, 80 s, 160 s apart.
    attempts: 5,
    backoff: { type: 'exponential', delay: 20000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

export async function addEvaluationJob(data: { answerId: string; question: string; transcript: string; idealAnswer?: string | null }) {
  // Idempotent per (answerId, transcript). Allows re-scoring if transcript changes,
  // while preventing duplicate enqueues for identical content.
  const transcriptHash = crypto
    .createHash('sha1')
    .update(data.transcript || '', 'utf8')
    .digest('hex')
    .slice(0, 12);

  return evaluationQueue.add('evaluate', data, {
    jobId: `eval-${data.answerId}-${transcriptHash}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

export async function addReportJob(data: { interviewId: string }) {
  return reportQueue.add('generate', data, {
    jobId: `report-${data.interviewId}`,
    // Also retries conversation scoring after a rate limit: 20 s, 40 s, 80 s, 160 s apart.
    attempts: 5,
    backoff: { type: 'exponential', delay: 20000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}
