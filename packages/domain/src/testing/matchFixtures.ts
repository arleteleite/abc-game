import { Board } from "../board/Board";
import { PlayerPiece } from "../board/PlayerPiece";
import type { Difficulty } from "../common/Difficulty";
import { DEFAULT_GAME_CONFIG, type TrailConfig } from "../config/GameConfig";
import { Match } from "../match/Match";
import { OPTION_KEYS, type Question } from "../questions/Question";
import type { QuestionDealer } from "../questions/QuestionDealer";
import type { QuestionPresenter } from "../questions/QuestionPresenter";
import { SeededRandom } from "../random/SeededRandom";
import { FakeClock } from "../time/FakeClock";
import { makeQuestion } from "./questionFixtures";

// Apoio dos testes de partida: perguntas previsíveis (a correta é sempre "B"),
// sem embaralhar, para o teste saber a resposta.

/** Entrega perguntas com nível definido por jogador; o que faltar na fila é "facil". */
export class ScriptedDealer implements QuestionDealer {
  private counter = 0;

  constructor(private readonly queues: Record<string, Difficulty[]> = {}) {}

  next(playerId: string): Question {
    const level = this.queues[playerId]?.shift() ?? "facil";
    return makeQuestion(level, ++this.counter);
  }

  nextOfLevel(level: Difficulty): Question {
    return makeQuestion(level, ++this.counter);
  }
}

export const identityPresenter: QuestionPresenter = {
  present: (q) => ({
    publicQuestion: {
      questionId: q.id,
      statement: q.statement,
      options: OPTION_KEYS.map((key) => ({ key, text: q.options[key] })),
    },
    correctKey: q.correct,
  }),
};

export const RIGHT = "B" as const; // alternativa correta das perguntas de teste
export const WRONG = "A" as const;

export const NO_EVENTS_TRAIL: TrailConfig = { ...DEFAULT_GAME_CONFIG.trail, events: [] };

export interface BuiltMatch {
  match: Match;
  clock: FakeClock;
  config: TrailConfig;
}

export function buildMatch(options: { trail?: TrailConfig; queues?: Record<string, Difficulty[]>; isRematch?: boolean; seed?: number } = {}): BuiltMatch {
  const config = options.trail ?? DEFAULT_GAME_CONFIG.trail;
  const clock = new FakeClock(1_000_000);
  const match = new Match({
    config,
    board: new Board(config),
    players: [new PlayerPiece("A", "vaca"), new PlayerPiece("B", "ovelha")],
    dealer: new ScriptedDealer(options.queues),
    presenter: identityPresenter,
    random: new SeededRandom(options.seed ?? 1),
    clock,
    ...(options.isRematch !== undefined ? { isRematch: options.isRematch } : {}),
  });
  return { match, clock, config };
}
