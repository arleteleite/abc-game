import type { PlayerInfo, PlayerState } from "@abc-game/protocol";
import { BOARD_COLUMNS, cellOfSquare, stageForPosition } from "../board/boardLayout";
import { EVENT_ICONS } from "../constants";
import { PawnImage } from "./PawnImage";

interface Props {
  boardSize: number;
  players: PlayerState[];
  you: PlayerInfo;
  opponent: PlayerInfo;
  currentPlayerId: string | null;
}

// O tabuleiro é desenhado pelo app (15 casas em cobrinha) sobre a cena da
// propriedade, que muda conforme quem está na frente.
export function BoardView({ boardSize, players, you, opponent, currentPlayerId }: Props) {
  const positionOf = (id: string) => players.find((p) => p.playerId === id)?.position ?? 0;
  const leader = Math.max(positionOf(you.id), positionOf(opponent.id));
  const stage = stageForPosition(leader);
  const rows = Math.ceil(boardSize / BOARD_COLUMNS);

  const squares = Array.from({ length: boardSize }, (_, i) => i + 1);
  const pawnsAt = (square: number) =>
    [you, opponent].filter((p) => positionOf(p.id) === square);
  const atStart = [you, opponent].filter((p) => positionOf(p.id) === 0);

  return (
    <div className="board-wrapper">
      <div className="board-start" aria-label="Largada">
        <span className="board-start-label">Largada</span>
        {atStart.map((p) => (
          <PawnImage key={p.id} pawn={p.pawn} size={44} />
        ))}
      </div>

      <div
        className="board"
        style={{
          backgroundImage: `url(/img/cena-fazenda-${stage}.webp)`,
          gridTemplateColumns: `repeat(${BOARD_COLUMNS}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {squares.map((square) => {
          const { row, col } = cellOfSquare(square);
          const event = EVENT_ICONS[square];
          const here = pawnsAt(square);
          return (
            <div
              key={square}
              className={`square ${square === boardSize ? "finish" : ""} ${event ? "has-event" : ""}`}
              style={{ gridRow: row + 1, gridColumn: col + 1 }}
              title={event?.label}
            >
              <span className="square-number">{square === boardSize ? "🏁" : square}</span>
              {event && <img className="event-icon" src={`/img/${event.icon}.webp`} alt={event.label} width={28} height={28} />}
              <div className="square-pawns">
                {here.map((p) => (
                  <span key={p.id} className={`pawn-wrap ${p.id === currentPlayerId ? "active" : ""} ${p.id === you.id ? "mine" : ""}`}>
                    <PawnImage pawn={p.pawn} size={36} />
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
