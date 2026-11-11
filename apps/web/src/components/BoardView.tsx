import type { PlayerInfo, PlayerState } from "@abc-game/protocol";
import { stageForPosition, trailPath, trailPoint } from "../board/boardLayout";
import { EVENT_ICONS } from "../constants";
import { useSteppedPositions } from "../hooks/useSteppedPositions";
import { FarmBackground } from "./FarmBackground";
import { PawnImage } from "./PawnImage";

interface Props {
  boardSize: number;
  players: PlayerState[];
  you: PlayerInfo;
  opponent: PlayerInfo;
  currentPlayerId: string | null;
  /** Durante a pergunta o tabuleiro encolhe para sobrar espaço para ela. */
  compact?: boolean;
}

// O tabuleiro é uma trilha sinuosa desenhada pelo app sobre a cena da
// propriedade: começa embaixo, sobe em "S" e termina no alto. A cena muda
// conforme quem está na frente, e os peões andam casa por casa.
export function BoardView({ boardSize, players, you, opponent, currentPlayerId, compact = false }: Props) {
  const target: Record<string, number> = {
    [you.id]: players.find((p) => p.playerId === you.id)?.position ?? 0,
    [opponent.id]: players.find((p) => p.playerId === opponent.id)?.position ?? 0,
  };
  const shown = useSteppedPositions(target);
  const where = (id: string) => shown[id] ?? target[id] ?? 0;
  const stage = stageForPosition(Math.max(where(you.id), where(opponent.id)));
  const pawnSize = compact ? 34 : 44;
  const squares = Array.from({ length: boardSize }, (_, i) => i + 1);
  const together = where(you.id) === where(opponent.id);

  return (
    <div className={`trail ${compact ? "compact" : ""}`}>
      <FarmBackground stage={stage} />
      <svg className="trail-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path className="trail-edge" d={trailPath(boardSize)} vectorEffect="non-scaling-stroke" />
        <path className="trail-road" d={trailPath(boardSize)} vectorEffect="non-scaling-stroke" />
      </svg>

      <span className="trail-label start-label" style={{ left: `${trailPoint(0, boardSize).x}%`, top: `${trailPoint(0, boardSize).y}%` }}>
        Largada
      </span>

      {squares.map((square) => {
        const { x, y } = trailPoint(square, boardSize);
        const event = EVENT_ICONS[square];
        const finish = square === boardSize;
        return (
          <div key={square} className={`mark ${event ? "has-event" : ""} ${finish ? "finish" : ""}`} style={{ left: `${x}%`, top: `${y}%` }} title={event?.label}>
            {event && (
              <span className="event-tag">
                <img src={`/img/${event.icon}.webp`} alt={event.label} width={30} height={30} />
              </span>
            )}
            <span className="mark-number">{finish ? "🏁" : square}</span>
          </div>
        );
      })}

      {[you, opponent].map((p) => {
        const { x, y } = trailPoint(where(p.id), boardSize);
        const side = together ? (p.id === you.id ? -1 : 1) : 0;
        return (
          <span
            key={p.id}
            className={`trail-pawn ${p.id === currentPlayerId ? "active" : ""} ${p.id === you.id ? "mine" : ""}`}
            style={{ left: `calc(${x}% + ${side * (pawnSize / 2.4)}px)`, top: `${y}%` }}
          >
            <PawnImage pawn={p.pawn} size={pawnSize} />
          </span>
        );
      })}
    </div>
  );
}
