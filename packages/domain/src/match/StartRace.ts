import type { RandomSource } from "../random/RandomSource";

export interface RaceAnswer {
  correct: boolean;
  /** Tempo medido no servidor, em ms. */
  elapsedMs: number;
}

export type RaceDecision = "only_one_correct" | "faster" | "tie_random" | "max_attempts_random";

export type RaceStatus =
  | { status: "waiting" }
  | { status: "retry"; attempt: number }
  | { status: "decided"; starter: string; reason: RaceDecision };

// A largada (PRD 7.2): os dois respondem a mesma pergunta; decide quem começa.
//  - só um acerta: ele começa;
//  - os dois acertam: o mais rápido (empate exato: sorteio);
//  - os dois erram: nova pergunta, até o máximo de tentativas; depois, sorteio.
export class StartRace {
  private attempt = 1;
  private answers = new Map<string, RaceAnswer>();
  private decided = false;

  constructor(
    private readonly playerIds: readonly [string, string],
    private readonly maxAttempts: number,
    private readonly random: RandomSource,
  ) {}

  get attemptNumber(): number {
    return this.attempt;
  }

  hasAnswered(playerId: string): boolean {
    return this.answers.has(playerId);
  }

  /** Registra a resposta de um jogador na tentativa atual. Respostas repetidas são ignoradas. */
  submit(playerId: string, answer: RaceAnswer): RaceStatus {
    if (this.decided) throw new Error("A largada já foi decidida");
    if (!this.playerIds.includes(playerId)) throw new Error("Jogador não participa desta largada");
    if (this.answers.has(playerId)) return { status: "waiting" };

    this.answers.set(playerId, answer);
    if (this.answers.size < 2) return { status: "waiting" };
    return this.resolve();
  }

  private resolve(): RaceStatus {
    const [first, second] = this.playerIds;
    const a = this.answers.get(first) as RaceAnswer;
    const b = this.answers.get(second) as RaceAnswer;

    if (a.correct !== b.correct) {
      return this.decide(a.correct ? first : second, "only_one_correct");
    }
    if (a.correct && b.correct) {
      if (a.elapsedMs !== b.elapsedMs) return this.decide(a.elapsedMs < b.elapsedMs ? first : second, "faster");
      return this.decide(this.randomPlayer(), "tie_random");
    }
    // Os dois erraram (ou estouraram o tempo).
    if (this.attempt >= this.maxAttempts) return this.decide(this.randomPlayer(), "max_attempts_random");
    this.attempt += 1;
    this.answers = new Map();
    return { status: "retry", attempt: this.attempt };
  }

  private randomPlayer(): string {
    return this.playerIds[this.random.nextInt(2)] as string;
  }

  private decide(starter: string, reason: RaceDecision): RaceStatus {
    this.decided = true;
    return { status: "decided", starter, reason };
  }
}
