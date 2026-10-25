import { config } from './index';
import logger from './logger';

/**
 * Every call from the backend to the AI service. On Render's free tier the AI service sleeps
 * after 15 idle minutes and restarts on each deploy; while it wakes, requests fail fast with
 * 502/503/504 or a refused connection. The first version gave up on that first failure, and
 * the interview page sat on "…" with no greeting. Now those failures are retried for about
 * 45 seconds; any other answer (including 4xx and 500) is returned to the caller as before.
 */
const RETRY_DELAYS_MS = [2000, 4000, 8000, 12000, 16000];
const WAKING = new Set([502, 503, 504]);

export async function callAiService(path: string, init: RequestInit, timeoutMs = 60000): Promise<Response> {
  const url = `${config.aiService.url}${path}`;
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!WAKING.has(response.status) || attempt >= RETRY_DELAYS_MS.length) return response;
      logger.warn({ path, status: response.status, attempt }, 'AI service waking up; retrying');
    } catch (error) {
      if (controller.signal.aborted || attempt >= RETRY_DELAYS_MS.length) throw error;
      logger.warn({ path, attempt, error: (error as Error).message }, 'AI service unreachable; retrying');
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }
}
