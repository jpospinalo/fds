import { useEffect, useRef, useCallback } from "react";

// ── Store en memoria (no localStorage) ────────────────────────────────────────
// Motivo: localStorage puede fallar en contextos de iframe, modo privado
// o entornos donde no está disponible.
const _jobs = new Map<string, number>(); // jobId → timestamp de inicio

export function registerPollingJob(id: string) {
  _jobs.set(id, Date.now());
}

export function unregisterPollingJob(id: string) {
  _jobs.delete(id);
}

export function getPendingJobs(): string[] {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 min máximo
  const expired: string[] = [];
  _jobs.forEach((ts, id) => {
    if (ts < cutoff) expired.push(id);
  });
  expired.forEach((id) => _jobs.delete(id));
  return Array.from(_jobs.keys());
}

/**
 * Hook de polling resistente a cambios de pestaña.
 *
 * - Cuando el usuario vuelve a la pestaña (visibilitychange) hace un poll
 *   inmediato en lugar de esperar el siguiente intervalo.
 * - Para automáticamente cuando status !== "running".
 * - No usa localStorage.
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
      // En caso de error de red, reintenta con doble intervalo
      if (activeRef.current) {
        timerRef.current = setTimeout(poll, intervalMs * 2);
      }
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
      unregisterPollingJob(id);
    };
  }, [id, poll]);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (id) unregisterPollingJob(id);
  }, [id]);

  return { stop };
}