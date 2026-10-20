import { useMemo } from 'react';
import type { CharState } from '../hooks/useTyping';

interface Props {
  text: string;
  typed: string;
  states: CharState[];
}

export default function TypingText({ text, typed, states }: Props) {
  const chars = useMemo(() => Array.from(text), [text]);
  const cursorIndex = typed.length;

  return (
    <div className="text">
      {chars.map((ch, i) => {
        const state: CharState = states[i] ?? 'pending';
        const isCursor = i === cursorIndex;
        const cls = [
          'char',
          `char--${state}`,
          isCursor ? 'char--cursor' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <span key={i} className={cls}>
            {ch}
          </span>
        );
      })}
      {chars.length === 0 && <span className="muted">Текст не сгенерирован</span>}
    </div>
  );
}
