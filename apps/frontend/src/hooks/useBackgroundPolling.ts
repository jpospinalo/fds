import { useEffect, useRef, useCallback } from "react";

const LS_KEY = "rag_polling_jobs";

interface PollingJob {
  id: string;
  startedAt: number;
}

function loadJobs(): PollingJob[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveJobs(jobs: PollingJob[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(jobs));
}

export function registerPollingJob(id: string) {
  const jobs = loadJobs().filter((j) => j.id !== id);
  jobs.push({ id, startedAt: Date.now() });
  saveJobs(jobs);
}

export function unregisterPollingJob(id: string) {
  saveJobs(loadJobs().filter((j) => j.id !== id));
}

export function getPendingJobs(): string[] {
  // Limpiar jobs de más de 30 minutos
  const cutoff = Date.now() - 30 * 60 * 1000;
  const valid = loadJobs().filter((j) => j.startedAt > cutoff);
  saveJobs(valid);
  return valid.map((j) => j.id);
}

/**
 * Hook que hace polling resistente a cambios de pestaña.
 * Usa visibilitychange para re-activarse inmediatamente cuando
 * el usuario vuelve a la pestaña.
 */
export function useBackgroundPolling(
  id: string | null,
  fetcher: (id: string) => Promise<{ status: string }>,
  onResult: (data: { status: string }) => void,
  intervalMs = 3000
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  const poll = useCallback(async () => {
    if (!id || !activeRef.current) return;
    try {
      const data = await fetcher(id);
      onResult(data);
      if (data.status === "running") {
        timerRef.current = setTimeout(poll, intervalMs);
      } else {
        activeRef.current = false;
        unregisterPollingJob(id);
      }
    } catch {
      timerRef.current = setTimeout(poll, intervalMs * 2);
    }
  }, [id, fetcher, onResult, intervalMs]);

  useEffect(() => {
    if (!id) return;
    activeRef.current = true;
    registerPollingJob(id);
    poll();

    const onVisible = () => {
      if (document.visibilityState === "visible" && activeRef.current) {
        if (timerRef.current) clearTimeout(timerRef.current);
        poll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      activeRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id, poll]);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (id) unregisterPollingJob(id);
  }, [id]);

  return { stop };
}