import { useCallback, useRef, useState } from 'react';

const CELEBRATION_COOLDOWN_MS = 5000;

export function useWinCelebration() {
  const [celebrate, setCelebrate] = useState(false);
  const [headline, setHeadline] = useState('Bingo!');
  const lastCelebrationAt = useRef(0);

  const triggerCelebration = useCallback((displayName) => {
    const now = Date.now();
    if (now - lastCelebrationAt.current < CELEBRATION_COOLDOWN_MS) return false;
    lastCelebrationAt.current = now;
    setHeadline(displayName ? `${displayName} got Bingo!` : 'Bingo!');
    setCelebrate(true);
    return true;
  }, []);

  const handleGameEvent = useCallback(
    (event) => {
      if (!event) return;
      if (event.event_type === 'bingo_win') {
        triggerCelebration(event.payload?.display_name ?? 'Someone');
      }
    },
    [triggerCelebration]
  );

  return { celebrate, headline, triggerCelebration, handleGameEvent, setCelebrate };
}

export const WIN_REPORT_COOLDOWN_MS = CELEBRATION_COOLDOWN_MS;
