import { describe, expect, it } from "vitest";
import type { OptionKey } from "../questions/Question";
import { buildMatch, NO_EVENTS_TRAIL, RIGHT, WRONG } from "../testing/matchFixtures";
import type { Match } from "./Match";
import type { AnswerOutcome, TurnPrompt } from "./MatchTypes";

/** Faz a largada: A acerta e B erra, então A começa. Devolve a 1ª pergunta da vez. */
function startWithA(match: Match): TurnPrompt {
  const race = match.beginRace();
  const qid = race.question.questionId;
  match.submitRaceAnswer("B", qid, WRONG);
  const out = match.submitRaceAnswer("A", qid, RIGHT);
  if (!out.ok || out.value.status !== "decided") throw new Error("largada não decidida");
  return out.value.prompt;
}

/** Responde a vez atual e devolve o resultado (falha o teste se for rejeitada). */
function answer(match: Match, prompt: TurnPrompt, key: OptionKey | null): AnswerOutcome {
  const res = match.submitAnswer(prompt.playerId, prompt.question.questionId, key);
  if (!res.ok) throw new Error(`resposta rejeitada: ${res.reason}`);
  return res.value;
}

describe("Match: largada", () => {
  it("só um acerta: ele começa e recebe a primeira pergunta", () => {
    const { match } = buildMatch();
    const prompt = startWithA(match);
    expect(prompt.playerId).toBe("A");
    expect(match.phase).toBe("playing");
  });

  it("os dois erram: nova pergunta; após 3 tentativas o servidor sorteia", () => {
    const { match } = buildMatch();
    let race = match.beginRace();
    for (let attempt = 1; attempt <= 2; attempt++) {
      match.submitRaceAnswer("A", race.question.questionId, WRONG);
      const out = match.submitRaceAnswer("B", race.question.questionId, WRONG);
      if (!out.ok || out.value.status !== "retry") throw new Error("deveria pedir nova pergunta");
      race = out.value.prompt;
      expect(race.attempt).toBe(attempt + 1);
    }
    match.submitRaceAnswer("A", race.question.questionId, WRONG);
    const last = match.submitRaceAnswer("B", race.question.questionId, WRONG);
    expect(last.ok && last.value.status === "decided" && last.value.reason).toBe("max_attempts_random");
    expect(match.phase).toBe("playing");
  });

  it("os dois acertam: começa quem respondeu mais rápido", () => {
    const { match, clock } = buildMatch();
    const race = match.beginRace();
    clock.advance(1500);
    match.submitRaceAnswer("B", race.question.questionId, RIGHT);
    clock.advance(1000);
    const out = match.submitRaceAnswer("A", race.question.questionId, RIGHT);
    expect(out.ok && out.value.status === "decided" && out.value.starter).toBe("B");
  });

  it("resposta repetida na largada é rejeitada", () => {
    const { match } = buildMatch();
    const race = match.beginRace();
    match.submitRaceAnswer("A", race.question.questionId, RIGHT);
    const again = match.submitRaceAnswer("A", race.question.questionId, RIGHT);
    expect(again).toEqual({ ok: false, reason: "duplicate" });
  });

  it("quem não responde a largada em 12 s conta como erro (tick)", () => {
    const { match, clock } = buildMatch();
    const race = match.beginRace();
    match.submitRaceAnswer("A", race.question.questionId, RIGHT);
    clock.advance(13_000);
    const tick = match.tick();
    expect(tick?.kind).toBe("race_expired");
    expect(match.phase).toBe("playing");
    expect(match.snapshot().currentPlayerId).toBe("A");
  });
});

describe("Match: turnos e tabuleiro", () => {
  it("errar não avança e passa a vez", () => {
    const { match } = buildMatch({ trail: NO_EVENTS_TRAIL });
    const first = startWithA(match);
    const out = answer(match, first, WRONG);
    expect(out.correct).toBe(false);
    expect(out.move).toBeNull();
    expect(out.next?.playerId).toBe("B");
    expect(match.snapshot().players[0]?.position).toBe(0);
  });

  it("rejeita resposta fora de turno e resposta repetida", () => {
    const { match } = buildMatch({ trail: NO_EVENTS_TRAIL });
    const first = startWithA(match);
    expect(match.submitAnswer("B", first.question.questionId, RIGHT)).toEqual({ ok: false, reason: "not_your_turn" });

    answer(match, first, RIGHT);
    // O mesmo envio repetido (clique duplo ou reenvio após reconexão) não vale de novo.
    expect(match.submitAnswer("A", first.question.questionId, RIGHT)).toEqual({ ok: false, reason: "duplicate" });
    expect(match.snapshot().players[0]?.position).toBe(1);
  });

  it("rejeita resposta a uma pergunta que não é a atual", () => {
    const { match } = buildMatch({ trail: NO_EVENTS_TRAIL });
    startWithA(match);
    expect(match.submitAnswer("A", "outra-pergunta", RIGHT)).toEqual({ ok: false, reason: "unexpected_question" });
  });

  it("evento 'parado': o adversário joga duas vezes seguidas", () => {
    const { match } = buildMatch({ queues: { A: ["media", "facil"] } });
    let prompt = startWithA(match);
    prompt = answer(match, prompt, RIGHT).next as TurnPrompt; // A chegou à 2; vez de B
    expect(prompt.playerId).toBe("B");
    prompt = answer(match, prompt, WRONG).next as TurnPrompt; // B erra; vez de A
    expect(prompt.playerId).toBe("A");
    const landing = answer(match, prompt, RIGHT); // A: fácil -> casa 3 (Veranico)
    expect(landing.move?.event?.label).toBe("Veranico");
    expect(landing.next?.playerId).toBe("B");

    const bTurn = answer(match, landing.next as TurnPrompt, WRONG); // B joga e erra
    expect(bTurn.skippedPlayerIds).toEqual(["A"]); // A perdeu a vez
    expect(bTurn.next?.playerId).toBe("B"); // B joga de novo
  });

  it("vence quem chega à casa 15, com o tempo total do vencedor", () => {
    // A só recebe perguntas difíceis (3 casas): 3, 6, 9, 12, 15.
    const { match, clock } = buildMatch({
      trail: NO_EVENTS_TRAIL,
      queues: { A: ["dificil", "dificil", "dificil", "dificil", "dificil"] },
    });
    let prompt = startWithA(match);
    let last: AnswerOutcome | null = null;
    while (match.phase === "playing") {
      clock.advance(2000);
      last = answer(match, prompt, prompt.playerId === "A" ? RIGHT : WRONG);
      if (last.next) prompt = last.next;
    }
    expect(last?.finished).toBe(true);
    expect(match.result).toMatchObject({
      endReason: "winner",
      winnerId: "A",
      winnerTotalAnswerMs: 10_000, // 5 respostas de A × 2 s
      rankable: true,
    });
  });

  it("revanche vence normalmente, mas não pode entrar no ranking", () => {
    const { match } = buildMatch({
      trail: NO_EVENTS_TRAIL,
      isRematch: true,
      queues: { A: ["dificil", "dificil", "dificil", "dificil", "dificil"] },
    });
    let prompt = startWithA(match);
    while (match.phase === "playing") {
      const out = answer(match, prompt, prompt.playerId === "A" ? RIGHT : WRONG);
      if (out.next) prompt = out.next;
    }
    expect(match.result).toMatchObject({ endReason: "winner", winnerId: "A", rankable: false });
  });
});

describe("Match: tempo, queda e abandono", () => {
  it("resposta depois de 12 s conta como estouro (não avança)", () => {
    const { match, clock } = buildMatch({ trail: NO_EVENTS_TRAIL });
    const first = startWithA(match);
    clock.advance(12_500);
    const out = answer(match, first, RIGHT);
    expect(out.timedOut).toBe(true);
    expect(out.correct).toBe(false);
    expect(match.snapshot().players[0]?.position).toBe(0);
  });

  it("o servidor faz valer o estouro do turno pelo tick", () => {
    const { match, clock } = buildMatch({ trail: NO_EVENTS_TRAIL });
    startWithA(match);
    clock.advance(13_000);
    const tick = match.tick();
    expect(tick?.kind === "turn_expired" && tick.outcome.next?.playerId).toBe("B");
  });

  it("queda curta (10 s): volta e a partida continua; o relógio do turno não pára", () => {
    const { match, clock } = buildMatch({ trail: NO_EVENTS_TRAIL });
    startWithA(match);
    match.playerDisconnected("A");
    clock.advance(10_000);
    expect(match.tick()).toBeNull();
    expect(match.playerReconnected("A")).toBe(true);
    expect(match.phase).toBe("playing");

    // Se caísse na vez dele e o tempo estourasse, perderia a resposta.
    match.playerDisconnected("A");
    clock.advance(3000); // soma 13 s desde o início do turno
    expect(match.tick()?.kind).toBe("turn_expired");
  });

  it("queda longa (40 s) encerra como abandono, sem vencedor e fora do ranking", () => {
    const { match, clock } = buildMatch({ trail: NO_EVENTS_TRAIL });
    startWithA(match);
    match.playerDisconnected("B");
    clock.advance(40_000);
    const tick = match.tick();
    expect(tick).toMatchObject({ kind: "match_ended" });
    expect(match.result).toMatchObject({ endReason: "abandoned", abandonedBy: "B", winnerId: null, rankable: false });
    expect(match.playerReconnected("B")).toBe(false);
  });

  it("botão Sair encerra na hora", () => {
    const { match } = buildMatch();
    startWithA(match);
    match.leave("A");
    expect(match.result).toMatchObject({ endReason: "abandoned", abandonedBy: "A", rankable: false });
  });

  it("10 minutos encerram a partida sem vencedor, e nada mais é aceito", () => {
    const { match, clock } = buildMatch({ trail: NO_EVENTS_TRAIL });
    const first = startWithA(match);
    clock.advance(601_000);
    expect(match.tick()).toMatchObject({ kind: "match_ended" });
    expect(match.result).toMatchObject({ endReason: "time_limit", winnerId: null, rankable: false });
    expect(match.submitAnswer("A", first.question.questionId, RIGHT)).toEqual({ ok: false, reason: "match_finished" });
  });
});
