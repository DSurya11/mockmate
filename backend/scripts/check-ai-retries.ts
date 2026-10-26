/**
 * Checks the two fixes for "resume analysis fails every time" against a real Redis, no AI keys:
 *   1. callAiService waits through 429 answers (seen from the sleeping AI service on Render).
 *   2. Retry on a failed analysis queues a new job (BullMQ used to ignore it: same jobId).
 *
 *   docker compose up -d redis
 *   REDIS_URL=redis://localhost:6379 npx ts-node scripts/check-ai-retries.ts
 */
import http from 'http';
import { AddressInfo } from 'net';

async function main() {
  // 1. A fake AI service: two 429s ("Too Many Requests", as Render sent), then the answer.
  let calls = 0;
  const server = http.createServer((_req, res) => {
    calls += 1;
    if (calls <= 2) { res.writeHead(429, { 'Content-Type': 'text/plain' }); res.end('Too Many Requests\n'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ atsScore: 80 }));
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  process.env.AI_SERVICE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const { callAiService } = await import('../src/config/aiService');
  const started = Date.now();
  const response = await callAiService('/api/resume/upload-analyze', { method: 'POST', body: 'x' }, 5000);
  server.close();
  const waited = ((Date.now() - started) / 1000).toFixed(1);
  if (response.status !== 200 || calls !== 3) throw new Error(`1 failed: status ${response.status} after ${calls} calls`);
  console.log(`1 ok: two 429s, then 200 on call ${calls} (${waited} s)`);

  // 2. A failed analysis job, then Retry.
  const { Worker, UnrecoverableError } = await import('bullmq');
  const { resumeQueue, redisConnection, addResumeJob } = await import('../src/queues');
  const data = { resumeId: `check-${Date.now()}`, fileUrl: 'x', fileName: 'x.pdf' };
  const jobId = `resume-${data.resumeId}`;
  const failing = new Worker('resume-analysis', async () => { throw new UnrecoverableError('AI service returned 429'); },
    { connection: redisConnection });
  await addResumeJob(data);
  for (let i = 0; i < 50 && !(await (await resumeQueue.getJob(jobId))?.isFailed()); i++) await new Promise((r) => setTimeout(r, 100));
  await failing.close();
  if (!(await (await resumeQueue.getJob(jobId))?.isFailed())) throw new Error('2 setup: the job did not fail');

  const plainAdd = await resumeQueue.add('analyze', data, { jobId });   // what Retry did before the fix
  console.log(`   before the fix, Retry got back the old job: state ${await plainAdd.getState()}`);
  await addResumeJob(data);                                            // Retry now
  const state = await (await resumeQueue.getJob(jobId))!.getState();
  if (state !== 'waiting' && state !== 'delayed') throw new Error(`2 failed: state ${state}`);
  console.log(`2 ok: after Retry the job is ${state}, so the worker will run it again`);
  await (await resumeQueue.getJob(jobId))!.remove();
  await resumeQueue.close();
  process.exit(0);
}

main().catch((error) => { console.error(error); process.exit(1); });
