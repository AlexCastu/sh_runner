import { useState, useEffect, useRef } from 'react';

/**
 * Hook that returns a live elapsed time string, updating every second.
 * Returns null when startedAt is null/undefined.
 */
export function useElapsedTimer(startedAt: string | null | undefined): string | null {
  const [elapsed, setElapsed] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(null);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const startTime = new Date(startedAt).getTime();

    const update = () => {
      const diffMs = Date.now() - startTime;
      const totalSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setElapsed(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    update(); // immediate first update
    intervalRef.current = setInterval(update, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startedAt]);

  return elapsed;
}
