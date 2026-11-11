import type { QuizRankingRow, TrailRankingRow } from "@abc-game/protocol";
import { formatSeconds } from "../format/formatSeconds";

export function QuizRankingTable({ rows }: { rows: QuizRankingRow[] }) {
  if (rows.length === 0) return <p className="hint">Ainda sem partidas. Seja o primeiro!</p>;
  return (
    <table className="ranking-table">
      <thead>
        <tr>
          <th scope="col">Pos.</th>
          <th scope="col">Jogador</th>
          <th scope="col">Acertos</th>
          <th scope="col">Tempo</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.position}-${row.nickname}`}>
            <td>{row.position}º</td>
            <td className="nick">{row.nickname}</td>
            <td>{row.correctCount}</td>
            <td>{formatSeconds(row.correctMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TrailRankingTable({ rows }: { rows: TrailRankingRow[] }) {
  if (rows.length === 0) return <p className="hint">Ainda sem partidas. Desafie alguém!</p>;
  return (
    <table className="ranking-table">
      <thead>
        <tr>
          <th scope="col">Pos.</th>
          <th scope="col">Vencedor</th>
          <th scope="col">Contra</th>
          <th scope="col">Tempo</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.position}-${row.winnerNickname}-${row.loserNickname}`}>
            <td>{row.position}º</td>
            <td className="nick winner">🏆 {row.winnerNickname}</td>
            <td className="nick">{row.loserNickname}</td>
            <td>{formatSeconds(row.winnerTotalAnswerMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
