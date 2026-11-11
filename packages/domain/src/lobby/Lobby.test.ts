import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_CONFIG } from "../config/GameConfig";
import { SequentialIdGenerator } from "../ids/SequentialIdGenerator";
import { NicknameValidator } from "../players/NicknameValidator";
import { PlayerRegistry } from "../players/PlayerRegistry";
import { InMemoryTrailResultRepository } from "../results/InMemoryTrailResultRepository";
import { FakeClock } from "../time/FakeClock";
import { Lobby } from "./Lobby";

function setup() {
  const clock = new FakeClock(0);
  const registry = new PlayerRegistry(
    new NicknameValidator(DEFAULT_GAME_CONFIG.nickname),
    new SequentialIdGenerator("p"),
    new SequentialIdGenerator("tok"),
  );
  const lobby = new Lobby(registry, clock, new SequentialIdGenerator("x"), DEFAULT_GAME_CONFIG.lobby, 180);
  const join = (nick: string) => {
    const r = lobby.join(nick);
    if (!r.ok) throw new Error(`join falhou: ${r.reason}`);
    return r.value;
  };
  return { clock, lobby, join };
}

describe("Lobby: lista de disponíveis", () => {
  it("mostra os outros jogadores, nunca o próprio, e sem expor tokens", () => {
    const { lobby, join } = setup();
    const ana = join("Ana");
    join("Beto");
    const view = lobby.view(ana.player.id);
    expect(view.available.map((p) => p.nickname)).toEqual(["Beto"]);
    expect(JSON.stringify(view)).not.toContain("tok");
  });

  it("quem fica sem sinal de vida sai da lista; heartbeat mantém na lista", () => {
    const { lobby, join, clock } = setup();
    const ana = join("Ana");
    const beto = join("Beto");
    clock.advance(30_000);
    lobby.authenticate(beto.token); // Beto dá sinal
    clock.advance(20_000); // Ana: 50 s sem sinal; Beto: 20 s
    expect(lobby.view(beto.player.id).available).toEqual([]);
    expect(lobby.sweep()).toEqual([ana.player.id]);
    expect(lobby.authenticate(ana.token)).toBeUndefined();
  });
});

describe("Lobby: convites", () => {
  it("convida, aceita e forma a partida; os dois saem da lista", () => {
    const { lobby, join } = setup();
    const ana = join("Ana");
    const beto = join("Beto");
    const cris = join("Cris");

    const sent = lobby.invite(ana.player.id, beto.player.id, "vaca");
    expect(sent.ok).toBe(true);
    const incoming = lobby.view(beto.player.id).incoming;
    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toMatchObject({ fromNickname: "Ana", fromPawn: "vaca" });

    const accepted = lobby.accept(incoming[0]!.id, beto.player.id, "ovelha");
    if (!accepted.ok) throw new Error(accepted.reason);
    expect(accepted.value.players.map((p) => p.pawn)).toEqual(["vaca", "ovelha"]);
    expect(lobby.view(ana.player.id).matchId).toBe(accepted.value.matchId);
    expect(lobby.view(beto.player.id).matchId).toBe(accepted.value.matchId);
    expect(lobby.view(cris.player.id).available).toEqual([]); // Ana e Beto ocupados
  });

  it("jogador ocupado não recebe convite", () => {
    const { lobby, join } = setup();
    const [ana, beto, cris] = [join("Ana"), join("Beto"), join("Cris")];
    const inv = lobby.invite(ana.player.id, beto.player.id, "vaca");
    if (!inv.ok) throw new Error("falha");
    lobby.accept(inv.value.id, beto.player.id, "ovelha");
    expect(lobby.invite(cris.player.id, beto.player.id, "milho")).toEqual({ ok: false, reason: "target_unavailable" });
  });

  it("dois convidam o mesmo jogador: vale o primeiro aceito, o outro convite perde o sentido", () => {
    const { lobby, join } = setup();
    const [ana, beto, cris] = [join("Ana"), join("Beto"), join("Cris")];
    const fromAna = lobby.invite(ana.player.id, cris.player.id, "vaca");
    const fromBeto = lobby.invite(beto.player.id, cris.player.id, "ovelha");
    if (!fromAna.ok || !fromBeto.ok) throw new Error("falha");
    expect(lobby.accept(fromAna.value.id, cris.player.id, "milho").ok).toBe(true);
    const second = lobby.accept(fromBeto.value.id, cris.player.id, "milho");
    expect(second.ok).toBe(false);
  });

  it("um novo convite cancela o anterior do mesmo jogador", () => {
    const { lobby, join } = setup();
    const [ana, beto, cris] = [join("Ana"), join("Beto"), join("Cris")];
    const first = lobby.invite(ana.player.id, beto.player.id, "vaca");
    lobby.invite(ana.player.id, cris.player.id, "vaca");
    if (!first.ok) throw new Error("falha");
    expect(lobby.view(beto.player.id).incoming).toEqual([]);
    expect(lobby.accept(first.value.id, beto.player.id, "ovelha")).toMatchObject({ ok: false, reason: "not_available" });
  });

  it("recusa e expiração chegam ao remetente uma única vez", () => {
    const { lobby, join, clock } = setup();
    const [ana, beto] = [join("Ana"), join("Beto")];
    const inv = lobby.invite(ana.player.id, beto.player.id, "vaca");
    if (!inv.ok) throw new Error("falha");
    lobby.decline(inv.value.id, beto.player.id);
    expect(lobby.view(ana.player.id).outgoing?.state).toBe("declined");
    expect(lobby.view(ana.player.id).outgoing).toBeNull(); // já entregue

    const second = lobby.invite(ana.player.id, beto.player.id, "vaca");
    if (!second.ok) throw new Error("falha");
    clock.advance(181_000);
    lobby.authenticate("tok1");
    lobby.authenticate("tok2");
    expect(lobby.view(ana.player.id).outgoing?.state).toBe("expired");
  });

  it("não convida a si mesmo nem alguém inexistente", () => {
    const { lobby, join } = setup();
    const ana = join("Ana");
    expect(lobby.invite(ana.player.id, ana.player.id, "vaca")).toEqual({ ok: false, reason: "self_invite" });
    expect(lobby.invite(ana.player.id, "ninguem", "vaca")).toEqual({ ok: false, reason: "target_unavailable" });
  });

  it("ao fim da partida os dois voltam à lista", () => {
    const { lobby, join } = setup();
    const [ana, beto] = [join("Ana"), join("Beto")];
    const inv = lobby.invite(ana.player.id, beto.player.id, "vaca");
    if (!inv.ok) throw new Error("falha");
    const accepted = lobby.accept(inv.value.id, beto.player.id, "ovelha");
    if (!accepted.ok) throw new Error("falha");
    lobby.finishMatch(accepted.value.matchId);
    expect(lobby.view(ana.player.id).matchId).toBeNull();
    expect(lobby.view(ana.player.id).available.map((p) => p.nickname)).toEqual(["Beto"]);
  });
});

describe("InMemoryTrailResultRepository", () => {
  it("gravar a mesma partida duas vezes não duplica (idempotente)", async () => {
    const repo = new InMemoryTrailResultRepository();
    const record = { matchId: "m1", winnerNickname: "Ana", loserNickname: "Beto", winnerTotalAnswerMs: 9000, endedAt: 1 };
    await repo.save(record);
    await repo.save({ ...record, winnerNickname: "Outro" });
    expect(await repo.all()).toEqual([record]);
  });
});

describe("Lobby: guardar e restaurar", () => {
  it("depois de restaurar, tokens, apelidos e partidas em andamento continuam valendo", () => {
    const a = setup();
    const ana = a.join("Ana");
    const beto = a.join("Beto");
    const inv = a.lobby.invite(ana.player.id, beto.player.id, "vaca");
    if (!inv.ok) throw new Error("falha");
    const accepted = a.lobby.accept(inv.value.id, beto.player.id, "ovelha");
    if (!accepted.ok) throw new Error("falha");

    const b = setup();
    b.lobby.restore(a.lobby.snapshot());
    expect(b.lobby.authenticate(ana.token)?.nickname).toBe("Ana");
    expect(b.lobby.view(ana.player.id).matchId).toBe(accepted.value.matchId);
    expect(b.lobby.join("ana")).toMatchObject({ ok: false, reason: "nickname_in_use" });
  });
});
