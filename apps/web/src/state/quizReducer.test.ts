import { describe, expect, it } from "vitest";
import type { QuizAnswerResponse, QuizStartResponse } from "@abc-game/protocol";
import { initialQuizState, quizReducer } from "./quizReducer";

const prompt = (index: number) => ({
  index,
  total: 10,
  remainingMs: 15_000,
  question: {
    questionId: `q${index}`,
    statement: `Pergunta ${index}?`,
    options: [
      { key: "A" as const, text: "alfa" },
      { key: "B" as const, text: "beta" },
      { key: "C" as const, text: "gama" },
      { key: "D" as const, text: "delta" },
    ],
  },
});

const started: QuizStartResponse = { quizId: "z1", prompt: prompt(0) };

describe("quizReducer", () => {
  it("começa na primeira pergunta, com o prazo no relógio do celular", () => {
    const s = quizReducer(initialQuizState, { type: "started", response: started, at: 1000 });
    expect(s.phase).toBe("playing");
    expect(s.prompt?.index).toBe(0);
    expect(s.deadlineAt).toBe(16_000);
  });

  it("ao responder, a próxima pergunta aparece na hora e o aviso mostra a resposta certa", () => {
    let s = quizReducer(initialQuizState, { type: "started", response: started, at: 0 });
    s = quizReducer(s, { type: "sending", choice: "A" });
    expect(s.sending).toBe(true);
    expect(s.selected).toBe("A");

    const response: QuizAnswerResponse = { correct: false, timedOut: false, correctKey: "B", next: prompt(1), result: null };
    s = quizReducer(s, { type: "answered", response, at: 3000 });
    expect(s.prompt?.index).toBe(1);
    expect(s.deadlineAt).toBe(18_000);
    expect(s.sending).toBe(false);
    expect(s.selected).toBeNull();
    expect(s.notice).toEqual({ correct: false, timedOut: false, correctKey: "B", correctText: "beta" });
  });

  it("estouro do tempo (sem alternativa) também gera aviso", () => {
    let s = quizReducer(initialQuizState, { type: "started", response: started, at: 0 });
    s = quizReducer(s, { type: "sending", choice: null });
    s = quizReducer(s, { type: "answered", response: { correct: false, timedOut: true, correctKey: "C", next: prompt(1), result: null }, at: 15_100 });
    expect(s.notice).toMatchObject({ timedOut: true, correctText: "gama" });
  });

  it("na última resposta termina e guarda o resultado", () => {
    let s = quizReducer(initialQuizState, { type: "started", response: { quizId: "z", prompt: prompt(9) }, at: 0 });
    const result = { correctCount: 8, total: 10, correctMs: 30_000, hardCorrectMs: 12_000, position: 2, players: 7 };
    s = quizReducer(s, { type: "answered", response: { correct: true, timedOut: false, correctKey: "A", next: null, result }, at: 5000 });
    expect(s.phase).toBe("finished");
    expect(s.prompt).toBeNull();
    expect(s.result).toEqual(result);
  });

  it("falha de rede leva ao erro, e 'reset' recomeça do zero", () => {
    let s = quizReducer(initialQuizState, { type: "started", response: started, at: 0 });
    s = quizReducer(s, { type: "failed", code: "network" });
    expect(s.phase).toBe("error");
    expect(quizReducer(s, { type: "reset" })).toEqual(initialQuizState);
  });
});
