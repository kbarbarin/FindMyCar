import { useEffect, useRef, useState } from 'react';

// Anime un compteur de 0 vers `target` sur `duration` ms avec easing easeOutQuart.
// Utilise pour les KPI hero — visuel "tableau de bord qui s'allume au boot".
export function useCountUp(target, { duration = 1200, decimals = 0 } = {}) {
  const [value, setValue] = useState(0);
  const startedAt = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target == null || !Number.isFinite(target)) {
      setValue(target ?? 0);
      return;
    }
    startedAt.current = null;
    const tick = (ts) => {
      if (!startedAt.current) startedAt.current = ts;
      const elapsed = ts - startedAt.current;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      const next = target * eased;
      setValue(decimals === 0 ? Math.round(next) : Number(next.toFixed(decimals)));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, decimals]);

  return value;
}
