// O que fica registrado de uma partida de Quiz. O `playerId` é o identificador
// interno de sessão (sorteado, não identifica a pessoa) e serve para valer só a
// melhor partida de cada jogador. Apagado ao fim do evento (PRD 10.5).
export interface QuizRecord {
  sessionId: string;
  playerId: string;
  nickname: string;
  correctCount: number;
  /** Soma dos tempos das respostas corretas, em ms. */
  correctMs: number;
  /** Soma dos tempos das respostas corretas de nível difícil, em ms. */
  hardCorrectMs: number;
  /** Momento em que a partida terminou (ms desde 1970). */
  endedAt: number;
}
