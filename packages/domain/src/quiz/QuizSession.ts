import { fail, ok, type Result } from "../common/Result";
import type { Question } from "../questions/Question";
import type { QuestionPresenter } from "../questions/QuestionPresenter";
import type { OptionKey } from "../questions/Question";
import type { Clock } from "../time/Clock";
import type { QuizAnswerOutcome, QuizAnswerRecord, QuizItem, QuizPrompt, QuizSnapshot, QuizSummary } from "./QuizTypes";

export type QuizRejection = "finished" | "unexpected_question";

// Uma partida de Quiz de UM jogador (PRD 6): 10 perguntas, uma de cada vez, com
// tempo por pergunta medido pelo relógio do servidor. Estourou o tempo = errou.
export class QuizSession {
  private readonly answers: QuizAnswerRecord[];
  private questionStartedAt: number | null;
  private readonly limitMs: number;

  constructor(
    private readonly items: readonly QuizItem[],
    private readonly clock: Clock,
    secondsPerQuestion: number,
    state?: { answers: QuizAnswerRecord[]; questionStartedAt: number | null },
  ) {
    this.limitMs = secondsPerQuestion * 1000;
    this.answers = state ? [...state.answers] : [];
    this.questionStartedAt = state ? state.questionStartedAt : null;
  }

  /** Cria a partida a partir das perguntas já sorteadas, embaralhando as alternativas. */
  static create(questions: readonly Question[], presenter: QuestionPresenter, clock: Clock, secondsPerQuestion: number): QuizSession {
    const items: QuizItem[] = questions.map((q) => ({
      questionId: q.id,
      difficulty: q.difficulty,
      presented: presenter.present(q),
    }));
    const session = new QuizSession(items, clock, secondsPerQuestion);
    session.questionStartedAt = clock.now();
    return session;
  }

  static restore(snapshot: QuizSnapshot, clock: Clock, secondsPerQuestion: number): QuizSession {
    return new QuizSession(snapshot.items, clock, secondsPerQuestion, snapshot);
  }

  snapshot(): QuizSnapshot {
    return { items: [...this.items], answers: [...this.answers], questionStartedAt: this.questionStartedAt };
  }

  get finished(): boolean {
    return this.answers.length >= this.items.length;
  }

  /** A pergunta atual (com o tempo que ainda resta), ou null se a partida acabou. */
  current(): QuizPrompt | null {
    if (this.finished) return null;
    const index = this.answers.length;
    const item = this.items[index] as QuizItem;
    const elapsed = this.clock.now() - (this.questionStartedAt ?? this.clock.now());
    return {
      index,
      total: this.items.length,
      question: item.presented.publicQuestion,
      remainingMs: Math.max(0, this.limitMs - elapsed),
    };
  }

  answer(questionId: string, choice: OptionKey | null): Result<QuizAnswerOutcome, QuizRejection> {
    if (this.finished) return fail("finished");
    const item = this.items[this.answers.length] as QuizItem;
    if (questionId !== item.questionId) return fail("unexpected_question");

    const now = this.clock.now();
    const elapsed = now - (this.questionStartedAt ?? now);
    const timedOut = elapsed > this.limitMs;
    const correct = !timedOut && choice === item.presented.correctKey;
    this.answers.push({
      questionId: item.questionId,
      difficulty: item.difficulty,
      correct,
      timedOut,
      elapsedMs: Math.min(elapsed, this.limitMs),
    });
    this.questionStartedAt = now;

    return ok({
      correct,
      timedOut,
      correctKey: item.presented.correctKey,
      next: this.current(),
      summary: this.finished ? this.summary() : null,
    });
  }

  summary(): QuizSummary {
    const correct = this.answers.filter((a) => a.correct);
    const sum = (list: QuizAnswerRecord[]) => list.reduce((total, a) => total + a.elapsedMs, 0);
    return {
      correctCount: correct.length,
      total: this.items.length,
      correctMs: sum(correct),
      hardCorrectMs: sum(correct.filter((a) => a.difficulty === "dificil")),
    };
  }
}
