import { describe, expect, it } from "vitest";
import type { ServerMessage } from "@abc-game/protocol";
import { initialMatchState, matchReducer, type MatchAction, type MatchViewState } from "./matchReducer";

const send = (state: MatchViewState, message: ServerMessage, at = 1000): MatchViewState =>
  matchReducer(state, { type: "message", message, at } satisfies MatchAction);

const question = {
  questionId: "q1",
  statement: "Pergunta?",
  options: [
    { key: "A" as const, text: "a" },
    { key: "B" as const, text: "b" },
    { key: "C" as const, text: "c" },
    { key: "D" as const, text: "d" },
  ],
};

const welcome: ServerMessage = {
  type: "welcome",
  you: { id: "me", nickname: "Ana", pawn: "vaca" },
  opponent: { id: "op", nickname: "Beto", pawn: "ovelha" },
  boardSize: 15,
};

describe("matchReducer", () => {
  it("começa conectando e passa a esperar o adversário depois do 'welcome'", () => {
    expect(initialMatchState.phase).toBe("connecting");
    const s = send(initialMatchState, welcome);
    expect(s.phase).toBe("waiting");
    expect(s.you?.nickname).toBe("Ana");
    expect(s.opponent?.pawn).toBe("ovelha");
  });

  it("pergunta da largada: guarda o prazo no relógio do celular", () => {
    const s = send(send(initialMatchState, welcome), { type: "race_question", question, attempt: 1, remainingMs: 12000 }, 5000);
    expect(s.phase).toBe("race");
    expect(s.questionKind).toBe("race");
    expect(s.deadlineAt).toBe(17000);
  });

  it("na minha vez mostra a pergunta; na do adversário, só de quem é a vez", () => {
    const base = send(initialMatchState, welcome);
    const mine = send(base, { type: "turn_question", question, remainingMs: 12000 }, 2000);
    expect(mine.phase).toBe("playing");
    expect(mine.question?.questionId).toBe("q1");

    const theirs = send(mine, { type: "opponent_turn", playerId: "op", remainingMs: 12000 }, 3000);
    expect(theirs.question).toBeNull();
    expect(theirs.currentPlayerId).toBe("op");
    expect(theirs.opponentDeadlineAt).toBe(15000);
  });

  it("a resposta escolhida fica marcada, e a resposta certa chega só no resultado", () => {
    const withQuestion = send(send(initialMatchState, welcome), { type: "turn_question", question, remainingMs: 12000 });
    expect(JSON.stringify(withQuestion)).not.toContain("correctKey");

    const picked = matchReducer(withQuestion, { type: "local_answer", choice: "C" });
    expect(picked.selected).toBe("C");

    const result = send(picked, {
      type: "answer_result",
      playerId: "me",
      correct: false,
      timedOut: false,
      correctKey: "B",
      move: null,
      skippedPlayerIds: [],
    });
    expect(result.feedback).toMatchObject({ correct: false, correctKey: "B" });
    expect(matchReducer(result, { type: "clear_feedback" }).feedback).toBeNull();
  });

  it("atualiza as posições", () => {
    const s = send(initialMatchState, {
      type: "state",
      currentPlayerId: "me",
      players: [{ playerId: "me", position: 4, skipsNextTurn: false }],
    });
    expect(s.players[0]?.position).toBe(4);
  });

  it("fim da partida limpa a pergunta e guarda o vencedor", () => {
    const playing = send(send(initialMatchState, welcome), { type: "turn_question", question, remainingMs: 12000 });
    const ended = send(playing, {
      type: "match_ended",
      result: { endReason: "winner", winnerId: "me", abandonedBy: null, winnerTotalAnswerMs: 9000, rankable: true },
      winnerNickname: "Ana",
      finalStats: [
        { playerId: "me", position: 15, asked: 7, correct: 5 },
        { playerId: "op", position: 9, asked: 6, correct: 3 },
      ],
    });
    expect(ended.phase).toBe("ended");
    expect(ended.question).toBeNull();
    expect(ended.ended).toMatchObject({ winnerNickname: "Ana", rankable: true });
    expect(ended.ended?.finalStats[0]).toEqual({ playerId: "me", position: 15, asked: 7, correct: 5 });
    expect(ended.players.map((p) => p.position)).toEqual([15, 9]);
    expect(ended.ended?.finalStats[0]).toEqual({ playerId: "me", position: 15, asked: 7, correct: 5 });
    expect(ended.players.map((p) => p.position)).toEqual([15, 9]);
  });

  it("registra o estado da conexão e do adversário", () => {
    expect(matchReducer(initialMatchState, { type: "connection", status: "reconnecting" }).connection).toBe("reconnecting");
    const s = send(initialMatchState, { type: "opponent_status", connected: false, graceMs: 30000 });
    expect(s.opponentConnected).toBe(false);
  });

  it("revanche: guarda quem pediu e, quando os dois aceitam, a partida nova", () => {
    let s = send(initialMatchState, { type: "rematch_status", state: "pending", requestedBy: "op", expiresInMs: 180000 });
    expect(s.rematch).toEqual({ state: "pending", requestedBy: "op" });
    expect(s.nextMatchId).toBeNull();

    s = send(s, { type: "rematch_status", state: "agreed", requestedBy: null, expiresInMs: 100000 });
    expect(s.rematch?.state).toBe("agreed");
    s = send(s, { type: "rematch_started", matchId: "nova-partida" });
    expect(s.nextMatchId).toBe("nova-partida");
  });

  it("revanche indisponível (por exemplo, abandono) também é registrada", () => {
    const s = send(initialMatchState, { type: "rematch_status", state: "unavailable", requestedBy: null, expiresInMs: null });
    expect(s.rematch?.state).toBe("unavailable");
  });
});
