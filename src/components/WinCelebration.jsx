import { useEffect, useMemo, useState } from 'react';

const EMOJIS = ['🎉', '🏆', '⭐', '🔥', '💀', '🎊', '✨', '🦅', '🍖', '💰'];

function randomEmoji() {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

export default function WinCelebration({ active, headline = 'Bingo!' }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return undefined;
    }

    const batch = Array.from({ length: 48 }, (_, i) => ({
      id: `${Date.now()}-${i}`,
      emoji: randomEmoji(),
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 0.8}s`,
      duration: `${2.4 + Math.random() * 1.6}s`,
      size: `${1.1 + Math.random() * 1.4}rem`,
    }));
    setParticles(batch);

    const timer = setTimeout(() => setParticles([]), 4500);
    return () => clearTimeout(timer);
  }, [active, headline]);

  const visible = active && particles.length > 0;

  const layer = useMemo(
    () =>
      visible ? (
        <div className="win-celebration" aria-live="polite">
          <p className="win-celebration-headline">{headline}</p>
          {particles.map((p) => (
            <span
              key={p.id}
              className="win-celebration-particle"
              style={{
                left: p.left,
                animationDelay: p.delay,
                animationDuration: p.duration,
                fontSize: p.size,
              }}
            >
              {p.emoji}
            </span>
          ))}
        </div>
      ) : null,
    [visible, particles, headline]
  );

  return layer;
}
