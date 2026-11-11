import { describe, expect, it } from "vitest";
import { PlayerPiece } from "../board/PlayerPiece";
import { SeededRandom } from "../random/SeededRandom";
import { FakeClock } from "../time/FakeClock";
import { DisconnectPolicy } from "./DisconnectPolicy";
import { StartRace } from "./StartRace";
import { TurnManager } from "./TurnManager";

const raceFor = (seed = 1, maxAttempts = 3) => new StartRace(["A", "B"], maxAttempts, new SeededRandom(seed));

describe("StartRace", () => {
  it("só um acerta: ele começa", () => {
    const race = raceFor();
    race.submit("A", { correct: false, elapsedMs: 500 });
    expect(race.submit("B", { correct: true, elapsedMs: 9000 })).toEqual({
      status: "decided",
      starter: "B",
      reason: "only_one_correct",
    });
  });

  it("os dois acertam: o mais rápido começa", () => {
    const race = raceFor();
    race.submit("A", { correct: true, elapsedMs: 2000 });
    expect(race.submit("B", { correct: true, elapsedMs: 1500 })).toMatchObject({ starter: "B", reason: "faster" });
  });

  it("empate exato no tempo: o servidor sorteia (e os dois podem sair)", () => {
    const starters = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const race = raceFor(seed);
      race.submit("A", { correct: true, elapsedMs: 1000 });
      const out = race.submit("B", { correct: true, elapsedMs: 1000 });
      if (out.status === "decided") {
        expect(out.reason).toBe("tie_random");
        starters.add(out.starter);
      }
    }
    expect(starters).toEqual(new Set(["A", "B"]));
  });

  it("os dois erram: nova tentativa; na 3ª, sorteio", () => {
    const race = raceFor();
    race.submit("A", { correct: false, elapsedMs: 1 });
    expect(race.submit("B", { correct: false, elapsedMs: 1 })).toEqual({ status: "retry", attempt: 2 });
    race.submit("A", { correct: false, elapsedMs: 1 });
    expect(race.submit("B", { correct: false, elapsedMs: 1 })).toEqual({ status: "retry", attempt: 3 });
    race.submit("A", { correct: false, elapsedMs: 1 });
    expect(race.submit("B", { correct: false, elapsedMs: 1 })).toMatchObject({
      status: "decided",
      reason: "max_attempts_random",
    });
  });

  it("ignora a segunda resposta do mesmo jogador na tentativa", () => {
    const race = raceFor();
    race.submit("A", { correct: false, elapsedMs: 1 });
    expect(race.submit("A", { correct: true, elapsedMs: 1 })).toEqual({ status: "waiting" });
    expect(race.submit("B", { correct: true, elapsedMs: 5 })).toMatchObject({ starter: "B" });
  });
});

describe("TurnManager", () => {
  const setup = () => {
    const a = new PlayerPiece("A", "vaca");
    const b = new PlayerPiece("B", "ovelha");
    const turns = new TurnManager(["A", "B"], [a, b], "A");
    turns.beginTurn("q1");
    return { a, b, turns };
  };

  it("alterna a vez entre os jogadores", () => {
    const { turns } = setup();
    expect(turns.endTurn("q1")).toEqual({ next: "B", skippedPlayerIds: [] });
    turns.beginTurn("q2");
    expect(turns.endTurn("q2")).toEqual({ next: "A", skippedPlayerIds: [] });
  });

  it("rejeita duplicada, fora de turno e pergunta inesperada (nessa ordem de prioridade)", () => {
    const { turns } = setup();
    expect(turns.validate("B", "q1")).toEqual({ ok: false, reason: "not_your_turn" });
    expect(turns.validate("A", "zzz")).toEqual({ ok: false, reason: "unexpected_question" });
    expect(turns.validate("A", "q1").ok).toBe(true);
    turns.endTurn("q1");
    expect(turns.validate("A", "q1")).toEqual({ ok: false, reason: "duplicate" });
  });

  it("jogador parado perde exatamente uma vez e o outro joga de novo", () => {
    const { b, turns } = setup();
    b.apply({ from: 0, answerAdvance: 3, landedOn: 3, event: null, finalPosition: 3, finished: false, skipTurns: 1 });
    expect(turns.endTurn("q1")).toEqual({ next: "A", skippedPlayerIds: ["B"] });
    turns.beginTurn("q2");
    expect(turns.endTurn("q2")).toEqual({ next: "B", skippedPlayerIds: [] });
  });
});

describe("DisconnectPolicy", () => {
  it("dentro da tolerância o jogador volta; depois dela é abandono", () => {
    const clock = new FakeClock(0);
    const policy = new DisconnectPolicy(clock, 30);
    policy.markDisconnected("A");
    clock.advance(10_000);
    expect(policy.statusOf("A")).toEqual({ state: "grace", remainingMs: 20_000 });
    expect(policy.markReconnected("A")).toBe(true);
    expect(policy.statusOf("A")).toEqual({ state: "connected" });

    policy.markDisconnected("A");
    clock.advance(30_000);
    expect(policy.statusOf("A")).toEqual({ state: "abandoned" });
    expect(policy.abandonedPlayer()).toBe("A");
    expect(policy.markReconnected("A")).toBe(false);
  });

  it("queda repetida não reinicia a contagem", () => {
    const clock = new FakeClock(0);
    const policy = new DisconnectPolicy(clock, 30);
    policy.markDisconnected("A");
    clock.advance(20_000);
    policy.markDisconnected("A");
    clock.advance(10_000);
    expect(policy.abandonedPlayer()).toBe("A");
  });
});
