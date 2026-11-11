import { describe, expect, it } from "vitest";
import { parseClientMessage } from "./parseClientMessage";

describe("parseClientMessage", () => {
  it("aceita as mensagens válidas", () => {
    expect(parseClientMessage('{"type":"answer","questionId":"q1","choice":"B"}')).toEqual({
      type: "answer",
      questionId: "q1",
      choice: "B",
    });
    expect(parseClientMessage('{"type":"race_answer","questionId":"q1","choice":null}')).toMatchObject({ choice: null });
    expect(parseClientMessage('{"type":"leave"}')).toEqual({ type: "leave" });
    expect(parseClientMessage('{"type":"rematch_request"}')).toEqual({ type: "rematch_request" });
    expect(parseClientMessage('{"type":"rematch_decline"}')).toEqual({ type: "rematch_decline" });
    expect(parseClientMessage('{"type":"ping","t":5}')).toEqual({ type: "ping", t: 5 });
  });

  it("rejeita lixo, letras fora de A–D e campos de tipo errado", () => {
    for (const bad of [
      "não é json",
      "null",
      "[]",
      '{"type":"answer","questionId":"q1","choice":"E"}',
      '{"type":"answer","questionId":7,"choice":"A"}',
      '{"type":"ping","t":"x"}',
      '{"type":"desconhecido"}',
    ]) {
      expect(parseClientMessage(bad)).toBeNull();
    }
    expect(parseClientMessage(123)).toBeNull();
    expect(parseClientMessage("x".repeat(3000))).toBeNull();
  });
});
