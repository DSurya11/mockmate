import { config } from './index';
import logger from './logger';

/**
 * Every call from the backend to the AI service. On Render's free tier the AI service sleeps
 * after 15 idle minutes and restarts on each deploy. While it wakes, requests either hang
 * (Render holds them, measured 33 s) or fail fast with 502/503/504 or a refused connection.
 * The first version gave up on the first failure; the second retried 5 times (~45 s) but
 * gave up on a request that hung past its own timeout, and the interview page showed
 * "could not reply". Now all of those are retried until a 100 s deadline. Any other answer,
 * including 4xx and 500, is returned to the caller as before.
 * 429 counts as waking too: resume analysis got a plain-text "Too Many Requests" (not from our
 * code: the AI service has no rate limiter, and it reports a model's rate limit as 502) three
 * times in 6 s on 2026-10-26, while the same file analysed in 7.5 s once the service was up.
 */
const DEADLINE_MS = 100_000;
const PAUSE_MS = [2000, 4000, 8000];
const WAKING = new Set([429, 502, 503, 504]);

export async function callAiService(path: string, init: RequestInit, timeoutMs = 60_000): Promise<Response> {
  const url = `${config.aiService.url}${path}`;
  const deadline = Date.now() + DEADLINE_MS;
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(timeoutMs, deadline - Date.now())));
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!WAKING.has(response.status) || Date.now() >= deadline) return response;
      logger.warn({ path, status: response.status, attempt }, 'AI service waking up; retrying');
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      logger.warn({ path, attempt, error: (error as Error).message }, 'AI service unreachable or slow; retrying');
    } finally {
      clearTimeout(timer);
    }
    const pause = PAUSE_MS[Math.min(attempt, PAUSE_MS.length - 1)];
    await new Promise((resolve) => setTimeout(resolve, Math.min(pause, Math.max(0, deadline - Date.now()))));
  }
}

/** True once the AI service answers its health check (waking it if it was asleep). */
export async function aiServiceReady(): Promise<boolean> {
  try {
    const response = await callAiService('/health', { method: 'GET' }, 60_000);
    return response.ok;
  } catch {
    return false;
  }
}
