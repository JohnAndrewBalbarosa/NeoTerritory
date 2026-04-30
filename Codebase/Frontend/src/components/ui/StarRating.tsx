import { useState, KeyboardEvent } from 'react';

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  max?: number;
  disabled?: boolean;
}

const DEFAULT_MAX = 5;

export default function StarRating({ value, onChange, label, max = DEFAULT_MAX, disabled }: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  function clamp(n: number): number {
    if (n < 1) return 1;
    if (n > max) return max;
    return n;
  }

  function handleKey(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(clamp((value || 0) + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(clamp((value || 1) - 1));
    } else if (e.key >= '1' && e.key <= String(max)) {
      e.preventDefault();
      onChange(Number(e.key));
    }
  }

  return (
    <div
      className="star-rating"
      role="radiogroup"
      aria-label={label || `Rating: ${value} out of ${max}`}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKey}
      onMouseLeave={() => setHover(null)}
    >
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1;
        const filled = n <= display;
        return (
          <button
            key={n}
            type="button"
            className={`star ${filled ? 'star-filled' : 'star-empty'}`}
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} out of ${max}`}
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(null)}
            onClick={() => onChange(n)}
          >
            {filled ? '★' : '☆'}
          </button>
        );
      })}
      <span className="star-rating-value" aria-hidden="true">
        {value > 0 ? `${value}/${max}` : ''}
      </span>
    </div>
  );
}
