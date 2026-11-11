import { fail, ok, type Result } from "../common/Result";
import type { Board } from "../board/Board";
import type { PlayerPiece } from "../board/PlayerPiece";
import type { TrailConfig } from "../config/GameConfig";
import type { OptionKey, Question } from "../questions/Question";
import type { QuestionDealer } from "../questions/QuestionDealer";
import type { QuestionPresenter } from "../questions/QuestionPresenter";
import type { RandomSource } from "../random/RandomSource";
import type { Clock } from "../time/Clock";
import { DisconnectPolicy } from "./DisconnectPolicy";
import type {
  AnswerOutcome,
  EndReason,
  MatchPhase,
  MatchRejection,
  MatchResult,
  MatchSnapshot,
  RaceOutcome,
  RacePrompt,
  TickResult,
  TurnPrompt,
} from "./MatchTypes";
import { StartRace, type RaceStatus } from "./StartRace";
import { TurnManager } from "./TurnManager";

export interface MatchDependencies {
  config: TrailConfig;
  board: Board;
  players: readonly [PlayerPiece, PlayerPiece];
  dealer: QuestionDealer;
  presenter: QuestionPresenter;
  random: RandomSource;
  clock: Clock;
  /** Revanche: a partida acontece normalmente, mas nunca entra no ranking. */
  isRematch?: boolean;
}

// Uma partida da Trilha, do começo ao fim. Orquestra as outras classes de
// regra (largada, vez, tabuleiro, queda de conexão) e NÃO conhece rede nem
// Cloudflare. Quem mede o tempo é o relógio injetado (servidor autoritativo).
export class Match {
  private currentPhase: MatchPhase = "race";
  private matchResult: MatchResult | null = null;
  private readonly startedAt: number;
  private readonly limitMs: number;
  private readonly playerIds: readonly [string, string];
  private readonly race: StartRace;
  private readonly disconnects: DisconnectPolicy;
  private turns: TurnManager | null = null;
  private readonly answerMs = new Map<string, number>();

  // Estado da pergunta da largada
  private raceQuestionId = "";
  private raceCorrectKey: OptionKey = "A";
  private raceStartedAt = 0;

  // Estado da pergunta da vez
  private question: Question | null = null;
  private correctKey: OptionKey = "A";
  private turnStartedAt = 0;

  constructor(private readonly deps: MatchDependencies) {
    const [a, b] = deps.players;
    this.playerIds = [a.playerId, b.playerId];
    this.startedAt = deps.clock.now();
    this.limitMs = deps.config.secondsPerAnswer * 1000;
    this.race = new StartRace(this.playerIds, deps.config.startRaceMaxAttempts, deps.random);
    this.disconnects = new DisconnectPolicy(deps.clock, deps.config.reconnectToleranceSeconds);
    for (const id of this.playerIds) this.answerMs.set(id, 0);
  }

  // ---------- consulta ----------

  get phase(): MatchPhase {
    return this.currentPhase;
  }

  get result(): MatchResult | null {
    return this.matchResult;
  }

  snapshot(): MatchSnapshot {
    return {
      phase: this.currentPhase,
      currentPlayerId: this.turns?.currentPlayerId ?? null,
      players: this.deps.players.map((p) => ({
        playerId: p.playerId,
        position: p.position,
        skipsNextTurn: p.skipsNextTurn,
      })),
    };
  }

  // ---------- largada ----------

  /** Sorteia e apresenta a pergunta da largada (e das novas tentativas). */
  beginRace(): RacePrompt {
    if (this.currentPhase !== "race") throw new Error("A largada já terminou");
    const question = this.deps.dealer.nextOfLevel(this.deps.config.startRaceDifficulty);
    const presented = this.deps.presenter.present(question);
    this.raceQuestionId = question.id;
    this.raceCorrectKey = presented.correctKey;
    this.raceStartedAt = this.deps.clock.now();
    return {
      question: presented.publicQuestion,
      attempt: this.race.attemptNumber,
      deadlineAt: this.raceStartedAt + this.limitMs,
    };
  }

  submitRaceAnswer(playerId: string, questionId: string, chosen: OptionKey | null): Result<RaceOutcome, MatchRejection> {
    if (this.guardFinished()) return fail("match_finished");
    if (this.currentPhase !== "race") return fail("not_in_race");
    if (!this.playerIds.includes(playerId)) return fail("unknown_player");
    if (questionId !== this.raceQuestionId) return fail("unexpected_question");
    if (this.race.hasAnswered(playerId)) return fail("duplicate");

    const elapsed = this.deps.clock.now() - this.raceStartedAt;
    const timedOut = elapsed > this.limitMs;
    const correct = !timedOut && chosen === this.raceCorrectKey;
    return ok(this.applyRace(this.race.submit(playerId, { correct, elapsedMs: Math.min(elapsed, this.limitMs) })));
  }

  private applyRace(status: RaceStatus): RaceOutcome {
    if (status.status === "waiting") return status;
    if (status.status === "retry") return { status: "retry", prompt: this.beginRace() };

    this.turns = new TurnManager(this.playerIds, this.deps.players, status.starter);
    this.currentPhase = "playing";
    return { status: "decided", starter: status.starter, reason: status.reason, prompt: this.beginTurn() };
  }

  // ---------- turnos ----------

  submitAnswer(playerId: string, questionId: string, chosen: OptionKey | null): Result<AnswerOutcome, MatchRejection> {
    if (this.guardFinished()) return fail("match_finished");
    if (this.currentPhase !== "playing" || !this.turns) return fail("not_playing");

    const valid = this.turns.validate(playerId, questionId);
    if (!valid.ok) return fail(valid.reason);
    return ok(this.resolveTurn(chosen, false));
  }

  private beginTurn(): TurnPrompt {
    const turns = this.turns as TurnManager;
    const playerId = turns.currentPlayerId;
    const question = this.deps.dealer.next(playerId);
    const presented = this.deps.presenter.present(question);
    this.question = question;
    this.correctKey = presented.correctKey;
    this.turnStartedAt = this.deps.clock.now();
    turns.beginTurn(question.id);
    return { playerId, question: presented.publicQuestion, deadlineAt: this.turnStartedAt + this.limitMs };
  }

  private resolveTurn(chosen: OptionKey | null, forcedTimeout: boolean): AnswerOutcome {
    const turns = this.turns as TurnManager;
    const question = this.question as Question;
    const playerId = turns.currentPlayerId;
    const piece = this.deps.players.find((p) => p.playerId === playerId) as PlayerPiece;

    const elapsed = this.deps.clock.now() - this.turnStartedAt;
    const timedOut = forcedTimeout || elapsed > this.limitMs;
    this.answerMs.set(playerId, (this.answerMs.get(playerId) ?? 0) + (timedOut ? this.limitMs : elapsed));

    const correct = !timedOut && chosen === this.correctKey;
    const base = { playerId, correct, timedOut, correctKey: this.correctKey };

    if (correct) {
      const move = this.deps.board.moveAfterCorrectAnswer(piece.position, question.difficulty);
      piece.apply(move);
      if (move.finished) {
        this.finish("winner", { winnerId: playerId });
        return { ...base, move, skippedPlayerIds: [], finished: true, next: null };
      }
      const { skippedPlayerIds } = turns.endTurn(question.id);
      return { ...base, move, skippedPlayerIds, finished: false, next: this.beginTurn() };
    }

    const { skippedPlayerIds } = turns.endTurn(question.id);
    return { ...base, move: null, skippedPlayerIds, finished: false, next: this.beginTurn() };
  }

  // ---------- conexão, abandono e tempo ----------

  playerDisconnected(playerId: string): void {
    if (this.currentPhase !== "finished" && this.playerIds.includes(playerId)) {
      this.disconnects.markDisconnected(playerId);
    }
  }

  /** Devolve false se a tolerância já acabou (o jogador não volta à partida). */
  playerReconnected(playerId: string): boolean {
    if (this.currentPhase === "finished" || !this.playerIds.includes(playerId)) return false;
    return this.disconnects.markReconnected(playerId);
  }

  /** Botão "Sair": abandono imediato. */
  leave(playerId: string): MatchResult | null {
    if (this.currentPhase === "finished" || !this.playerIds.includes(playerId)) return this.matchResult;
    this.finish("abandoned", { abandonedBy: playerId });
    return this.matchResult;
  }

  /**
   * Chamado periodicamente pelo servidor (alarme). Encerra por limite de tempo
   * ou abandono e faz valer o estouro de tempo da largada e do turno,
   * inclusive de quem está desconectado.
   */
  tick(): TickResult | null {
    if (this.currentPhase === "finished") return null;
    if (this.guardFinished()) return { kind: "match_ended", result: this.matchResult as MatchResult };

    const abandoned = this.disconnects.abandonedPlayer();
    if (abandoned) {
      this.finish("abandoned", { abandonedBy: abandoned });
      return { kind: "match_ended", result: this.matchResult as MatchResult };
    }

    const now = this.deps.clock.now();
    if (this.currentPhase === "race" && now - this.raceStartedAt > this.limitMs) {
      let outcome: RaceOutcome = { status: "waiting" };
      for (const id of this.playerIds) {
        if (!this.race.hasAnswered(id)) {
          outcome = this.applyRace(this.race.submit(id, { correct: false, elapsedMs: this.limitMs }));
        }
      }
      return { kind: "race_expired", outcome };
    }
    if (this.currentPhase === "playing" && now - this.turnStartedAt > this.limitMs) {
      return { kind: "turn_expired", outcome: this.resolveTurn(null, true) };
    }
    return null;
  }

  /** Encerra por limite de segurança se o tempo da partida acabou. */
  private guardFinished(): boolean {
    if (this.currentPhase === "finished") return true;
    if (this.deps.clock.now() - this.startedAt >= this.deps.config.matchTimeLimitSeconds * 1000) {
      this.finish("time_limit", {});
      return true;
    }
    return false;
  }

  private finish(reason: EndReason, info: { winnerId?: string; abandonedBy?: string }): void {
    const winnerId = info.winnerId ?? null;
    this.currentPhase = "finished";
    this.matchResult = {
      endReason: reason,
      winnerId,
      abandonedBy: info.abandonedBy ?? null,
      winnerTotalAnswerMs: winnerId ? (this.answerMs.get(winnerId) ?? 0) : null,
      rankable: reason === "winner" && !this.deps.isRematch,
    };
  }
}
