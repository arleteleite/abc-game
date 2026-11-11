import type { Difficulty } from "../common/Difficulty";
import type { TrailConfig } from "../config/GameConfig";
import type { BoardEvent } from "./BoardEvent";
import { BoardEventFactory } from "./BoardEventFactory";
import type { MoveResult } from "./MoveResult";

// O tabuleiro: calcula o que acontece quando um jogador ACERTA.
// Não guarda posição de ninguém (isso é do PlayerPiece) e não sabe de rede.
export class Board {
  private readonly events = new Map<number, BoardEvent>();

  constructor(
    private readonly config: TrailConfig,
    factory: BoardEventFactory = new BoardEventFactory(),
  ) {
    for (const eventConfig of config.events) {
      this.events.set(eventConfig.square, factory.create(eventConfig));
    }
  }

  get size(): number {
    return this.config.boardSize;
  }

  moveAfterCorrectAnswer(from: number, difficulty: Difficulty): MoveResult {
    const answerAdvance = this.config.advance[difficulty];
    const landedOn = from + answerAdvance;

    // Chegou ou passou da última casa: vence, sem bônus e sem disparar evento.
    if (landedOn >= this.size) {
      return this.result(from, answerAdvance, landedOn, null, this.size, 0);
    }

    // Evento só dispara ao PARAR na casa pelo avanço da resposta.
    const event = this.events.get(landedOn) ?? null;
    if (!event) {
      return this.result(from, answerAdvance, landedOn, null, landedOn, 0);
    }

    // O avanço do evento NÃO dispara outro evento (eventos não encadeiam).
    const effect = event.apply();
    const finalPosition = Math.min(landedOn + effect.extraAdvance, this.size);
    return this.result(from, answerAdvance, landedOn, event, finalPosition, effect.skipTurns);
  }

  private result(
    from: number,
    answerAdvance: number,
    landedOn: number,
    event: BoardEvent | null,
    finalPosition: number,
    skipTurns: number,
  ): MoveResult {
    return {
      from,
      answerAdvance,
      landedOn,
      event: event ? { square: event.square, kind: event.kind, label: event.label } : null,
      finalPosition,
      finished: finalPosition >= this.size,
      skipTurns,
    };
  }
}
