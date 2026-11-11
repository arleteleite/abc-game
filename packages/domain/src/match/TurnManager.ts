import { fail, ok, type Result } from "../common/Result";
import type { PlayerPiece } from "../board/PlayerPiece";

export type AnswerRejection = "duplicate" | "not_your_turn" | "unexpected_question";

// De quem é a vez. Resolve vez perdida (casas "parado"), rejeita resposta fora
// de turno, resposta repetida e resposta a pergunta que não é a atual.
export class TurnManager {
  private current: string;
  private expectedQuestionId: string | null = null;
  private readonly answered = new Set<string>();
  private readonly pieces: ReadonlyMap<string, PlayerPiece>;

  constructor(
    private readonly playerIds: readonly [string, string],
    pieces: readonly [PlayerPiece, PlayerPiece],
    firstPlayerId: string,
  ) {
    this.pieces = new Map(pieces.map((p) => [p.playerId, p]));
    this.current = firstPlayerId;
  }

  get currentPlayerId(): string {
    return this.current;
  }

  beginTurn(questionId: string): void {
    this.expectedQuestionId = questionId;
  }

  validate(playerId: string, questionId: string): Result<void, AnswerRejection> {
    if (this.answered.has(questionId)) return fail("duplicate");
    if (playerId !== this.current) return fail("not_your_turn");
    if (questionId !== this.expectedQuestionId) return fail("unexpected_question");
    return ok(undefined);
  }

  /**
   * Encerra a vez atual e define quem joga a seguir. Quem está "parado" perde
   * a vez e o adversário joga de novo (PRD 7.3).
   */
  endTurn(questionId: string): { next: string; skippedPlayerIds: string[] } {
    this.answered.add(questionId);
    this.expectedQuestionId = null;

    const skipped: string[] = [];
    let candidate = this.opponentOf(this.current);
    // Cada vez perdida é consumida; o laço termina porque os contadores são finitos.
    while ((this.pieces.get(candidate) as PlayerPiece).consumeSkippedTurn()) {
      skipped.push(candidate);
      candidate = this.opponentOf(candidate);
    }
    this.current = candidate;
    return { next: candidate, skippedPlayerIds: skipped };
  }

  private opponentOf(playerId: string): string {
    return (this.playerIds[0] === playerId ? this.playerIds[1] : this.playerIds[0]) as string;
  }
}
