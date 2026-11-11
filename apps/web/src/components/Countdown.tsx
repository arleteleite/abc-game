import { useEffect, useState } from "react";

interface Props {
  /** Instante (relógio do celular) em que o tempo acaba. */
  deadlineAt: number | null;
  /** Duração total, só para calcular a largura da barra. */
  totalMs: number;
}

// Barra e número de segundos restantes. Só mostra: quem decide o estouro é o servidor.
export function Countdown({ deadlineAt, totalMs }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadlineAt === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [deadlineAt]);

  if (deadlineAt === null) return null;
  const remaining = Math.max(0, deadlineAt - now);
  const percent = Math.min(100, (remaining / totalMs) * 100);
  const urgent = remaining < 4000;

  return (
    <div className={`countdown ${urgent ? "urgent" : ""}`} role="timer" aria-label={`${Math.ceil(remaining / 1000)} segundos restantes`}>
      <div className="countdown-bar" style={{ width: `${percent}%` }} />
      <span className="countdown-number">{Math.ceil(remaining / 1000)} s</span>
    </div>
  );
}
