// Ranking público (somente leitura): GET /api/ranking. Só apelidos e números.

export interface QuizRankingRow {
  position: number;
  nickname: string;
  correctCount: number;
  /** Soma dos tempos das respostas corretas, em ms. */
  correctMs: number;
}

export interface TrailRankingRow {
  position: number;
  winnerNickname: string;
  loserNickname: string;
  /** Soma dos tempos de resposta do vencedor, em ms. */
  winnerTotalAnswerMs: number;
}

export interface RankingResponse {
  quiz: QuizRankingRow[];
  trail: TrailRankingRow[];
  /** Quando o servidor calculou este ranking (ms desde 1970). */
  updatedAt: number;
  /** Intervalos sugeridos de atualização, em segundos (vêm da configuração do servidor). */
  pollSeconds: number;
  telaoPollSeconds: number;
}
