'use client';

import React from 'react';

interface ScoreStarsProps {
  score: number | null | undefined;
  max?: number;
  showNumber?: boolean;
  size?: 'sm' | 'md' | 'lg';
  evalCount?: number;
}

/**
 * ScoreStars — reusable score display with full/half/empty stars.
 * Sizes: sm (table/shortlist), md (profile card), lg (featured)
 */
export default function ScoreStars({
  score,
  max = 5,
  showNumber = true,
  size = 'sm',
  evalCount,
}: ScoreStarsProps) {
  const hasScore = score !== null && score !== undefined && score > 0;

  const starSize = size === 'lg' ? 'text-lg' : size === 'md' ? 'text-sm' : 'text-[10px]';
  const numSize = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-xs';
  const labelSize = size === 'lg' ? 'text-xs' : 'text-[9px]';

  if (!hasScore) {
    return (
      <span className={`text-text-secondary italic ${labelSize}`}>
        Sem score
      </span>
    );
  }

  const numericScore = Number(score);

  /**
   * Render stars: rounds to nearest 0.5.
   * Full star: ★ (filled), Half star: ⯨ (or use split visual), Empty: ☆
   */
  const renderStars = () => {
    const stars: React.ReactNode[] = [];
    const rounded = Math.round(numericScore * 2) / 2; // round to nearest 0.5

    for (let i = 1; i <= max; i++) {
      if (i <= Math.floor(rounded)) {
        // Full star
        stars.push(
          <span key={i} className="text-amber-400 leading-none">★</span>
        );
      } else if (i - 0.5 === rounded) {
        // Half star — use a Unicode half-star or split color trick
        stars.push(
          <span key={i} className="relative leading-none" aria-hidden="true">
            <span className="text-[var(--text-muted)]">★</span>
            <span
              className="absolute inset-0 overflow-hidden text-amber-400"
              style={{ width: '50%' }}
            >
              ★
            </span>
          </span>
        );
      } else {
        // Empty star
        stars.push(
          <span key={i} className="text-[var(--text-muted)] leading-none">★</span>
        );
      }
    }
    return stars;
  };

  return (
    <div
      className="flex flex-col"
      aria-label={`Score ${numericScore.toFixed(1)} de ${max}`}
    >
      <div className="flex items-center gap-1">
        {showNumber && (
          <span className={`font-bold text-text-primary tabular-nums ${numSize}`}>
            {numericScore.toFixed(1)}
          </span>
        )}
        <span className={`flex items-center gap-0.5 ${starSize}`}>
          {renderStars()}
        </span>
      </div>
      {evalCount !== undefined && size !== 'sm' && (
        <span className={`text-text-secondary mt-0.5 ${labelSize}`}>
          {evalCount} {evalCount === 1 ? 'avaliação' : 'avaliações'}
        </span>
      )}
    </div>
  );
}
