// O que fica registrado de uma partida da Trilha que vale para o ranking.
// Só apelidos e números: nenhum identificador de jogador (LGPD, PRD 10.5).
export interface TrailRecord {
  matchId: string;
  winnerNickname: string;
  loserNickname: string;
  /** Soma dos tempos de resposta do vencedor, em ms. */
  winnerTotalAnswerMs: number;
  /** Momento em que a partida terminou (ms desde 1970). */
  endedAt: number;
}
