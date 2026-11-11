import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_CONFIG } from "../config/GameConfig";
import { ListShuffler } from "../random/ListShuffler";
import { SeededRandom } from "../random/SeededRandom";
import { AnswerShuffler } from "../questions/AnswerShuffler";
import { QuestionSelector } from "../questions/QuestionSelector";
import { QuizQuestionPlanner } from "../questions/QuizQuestionPlanner";
import type { QuizRecord } from "../results/QuizRecord";
import { InMemoryQuizResultRepository } from "../results/InMemoryQuizResultRepository";
import { identityPresenter } from "../testing/matchFixtures";
import { makeBank } from "../testing/questionFixtures";
import { FakeClock } from "../time/FakeClock";
import { QuizRanking } from "./QuizRanking";
import { QuizSession } from "./QuizSession";
import type { QuizPrompt } from "./QuizTypes";

const config = DEFAULT_GAME_CONFIG.quiz;

function newSession(seed = 1, presenter = identityPresenter) {
  const clock = new FakeClock(0);
  const shuffler = new ListShuffler(new SeededRandom(seed));
  const questions = new QuizQuestionPlanner(new QuestionSelector(makeBank({ facil: 30, media: 30, dificil: 30 }), shuffler), shuffler, config).plan();
  return { clock, questions, session: QuizSession.create(questions, presenter, clock, config.secondsPerQuestion) };
}

const RIGHT = "B"; // nas perguntas de teste a correta é sempre B (e o presenter não embaralha)

describe("QuizSession", () => {
  it("apresenta 10 perguntas, uma por vez, na ordem sorteada", () => {
    const { session, questions } = newSession();
    expect(session.current()).toMatchObject({ index: 0, total: 10, remainingMs: 15_000 });
    expect(session.current()?.question.questionId).toBe(questions[0]?.id);
  });

  it("acertar 10 de 10: soma só os tempos das corretas", () => {
    const { session, clock } = newSession();
    let prompt: QuizPrompt | null = session.current();
    while (prompt) {
      clock.advance(2000);
      const out = session.answer(prompt.question.questionId, RIGHT);
      if (!out.ok) throw new Error(out.reason);
      expect(out.value.correct).toBe(true);
      prompt = out.value.next;
    }
    expect(session.finished).toBe(true);
    expect(session.summary()).toMatchObject({ correctCount: 10, total: 10, correctMs: 20_000 });
  });

  it("errar não soma tempo; o tempo das difíceis corretas é contado à parte", () => {
    const { session, clock, questions } = newSession(3);
    let prompt = session.current();
    let i = 0;
    while (prompt) {
      clock.advance(1000);
      const answeredWrong = i === 0; // erra só a primeira
      const out = session.answer(prompt.question.questionId, answeredWrong ? "A" : RIGHT);
      if (!out.ok) throw new Error(out.reason);
      prompt = out.value.next;
      i++;
    }
    const hardCorrect = questions.slice(1).filter((q) => q.difficulty === "dificil").length;
    expect(session.summary()).toMatchObject({ correctCount: 9, correctMs: 9000, hardCorrectMs: hardCorrect * 1000 });
  });

  it("responder depois de 15 s conta como estouro: errou e o tempo conta o limite", () => {
    const { session, clock } = newSession();
    const prompt = session.current() as QuizPrompt;
    clock.advance(15_500);
    const out = session.answer(prompt.question.questionId, RIGHT);
    expect(out.ok && out.value.timedOut).toBe(true);
    expect(out.ok && out.value.correct).toBe(false);
    expect(session.summary()).toMatchObject({ correctCount: 0, correctMs: 0 });
  });

  it("sem resposta (null) também é erro", () => {
    const { session } = newSession();
    const prompt = session.current() as QuizPrompt;
    const out = session.answer(prompt.question.questionId, null);
    expect(out.ok && out.value.correct).toBe(false);
  });

  it("a resposta correta só aparece no resultado, nunca na pergunta", () => {
    const { session } = newSession();
    const prompt = session.current() as QuizPrompt;
    expect(JSON.stringify(prompt)).not.toContain("correct");
    expect(JSON.stringify(prompt)).not.toContain("explanation");
    const out = session.answer(prompt.question.questionId, RIGHT);
    expect(out.ok && out.value.correctKey).toBe("B");
  });

  it("rejeita resposta a pergunta que não é a atual, repetida ou depois do fim", () => {
    const { session } = newSession();
    const prompt = session.current() as QuizPrompt;
    expect(session.answer("outra", RIGHT)).toEqual({ ok: false, reason: "unexpected_question" });
    session.answer(prompt.question.questionId, RIGHT);
    expect(session.answer(prompt.question.questionId, RIGHT)).toEqual({ ok: false, reason: "unexpected_question" }); // duplicada
    let next = session.current();
    while (next) {
      session.answer(next.question.questionId, RIGHT);
      next = session.current();
    }
    expect(session.answer("qualquer", RIGHT)).toEqual({ ok: false, reason: "finished" });
  });

  it("guarda e restaura o estado (o servidor pode ser descarregado no meio)", () => {
    const { session, clock } = newSession();
    clock.advance(3000);
    const first = session.current() as QuizPrompt;
    session.answer(first.question.questionId, RIGHT);

    const restored = QuizSession.restore(JSON.parse(JSON.stringify(session.snapshot())), clock, config.secondsPerQuestion);
    expect(restored.current()?.index).toBe(1);
    clock.advance(4000);
    expect(restored.current()?.remainingMs).toBe(11_000);
  });

  it("com o presenter real, embaralha as alternativas e o gabarito acompanha", () => {
    const presenter = new AnswerShuffler(new ListShuffler(new SeededRandom(9)));
    const { session, questions } = newSession(1, presenter);
    const prompt = session.current() as QuizPrompt;
    const original = questions[0]!;
    const rightText = original.options[original.correct];
    const rightKey = prompt.question.options.find((o) => o.text === rightText)!.key;
    const out = session.answer(prompt.question.questionId, rightKey);
    expect(out.ok && out.value.correct).toBe(true);
  });
});

const rec = (over: Partial<QuizRecord>): QuizRecord => ({
  sessionId: "s",
  playerId: "p",
  nickname: "x",
  correctCount: 5,
  correctMs: 30_000,
  hardCorrectMs: 10_000,
  endedAt: 100,
  ...over,
});

describe("QuizRanking", () => {
  const ranking = new QuizRanking();

  it("mais acertos ficam à frente", () => {
    const top = ranking.top([rec({ sessionId: "a", playerId: "A", correctCount: 7 }), rec({ sessionId: "b", playerId: "B", correctCount: 9 })], 5);
    expect(top.map((s) => s.record.playerId)).toEqual(["B", "A"]);
  });

  it("empate em acertos: menor soma dos tempos das corretas", () => {
    const top = ranking.top([rec({ sessionId: "a", playerId: "A", correctMs: 40_000 }), rec({ sessionId: "b", playerId: "B", correctMs: 35_000 })], 5);
    expect(top[0]?.record.playerId).toBe("B");
  });

  it("empate nos dois: menor tempo nas corretas difíceis", () => {
    const top = ranking.top([rec({ sessionId: "a", playerId: "A", hardCorrectMs: 9000 }), rec({ sessionId: "b", playerId: "B", hardCorrectMs: 7000 })], 5);
    expect(top[0]?.record.playerId).toBe("B");
  });

  it("empate total: a partida mais antiga fica à frente", () => {
    const top = ranking.top([rec({ sessionId: "a", playerId: "A", endedAt: 200 }), rec({ sessionId: "b", playerId: "B", endedAt: 100 })], 5);
    expect(top[0]?.record.playerId).toBe("B");
  });

  it("vale só a melhor partida de cada jogador", () => {
    const records = [
      rec({ sessionId: "a1", playerId: "A", correctCount: 4 }),
      rec({ sessionId: "a2", playerId: "A", correctCount: 8 }),
      rec({ sessionId: "b1", playerId: "B", correctCount: 6 }),
    ];
    const standings = ranking.standings(records);
    expect(standings.map((s) => [s.record.playerId, s.record.correctCount])).toEqual([["A", 8], ["B", 6]]);
    expect(ranking.positionOf(records, "B")).toBe(2);
    expect(ranking.positionOf(records, "ninguem")).toBeNull();
  });

  it("mostra só o top 5", () => {
    const records = Array.from({ length: 8 }, (_, i) => rec({ sessionId: `s${i}`, playerId: `P${i}`, correctCount: i }));
    const top = ranking.top(records, 5);
    expect(top).toHaveLength(5);
    expect(top[0]?.record.correctCount).toBe(7);
  });
});

describe("InMemoryQuizResultRepository", () => {
  it("gravar a mesma partida duas vezes não duplica", async () => {
    const repo = new InMemoryQuizResultRepository();
    await repo.save(rec({ sessionId: "s1" }));
    await repo.save(rec({ sessionId: "s1", correctCount: 9 }));
    expect(await repo.all()).toHaveLength(1);
  });
});
