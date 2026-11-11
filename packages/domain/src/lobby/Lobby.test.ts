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
    lobby.view(r.value.player.id); // chegou ao saguão: passa a aparecer na lista
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

  it("quem para de consultar o saguão some da lista; quem consulta continua", () => {
    const { lobby, join, clock } = setup();
    const ana = join("Ana");
    const beto = join("Beto");
    clock.advance(10_000);
    lobby.view(beto.player.id); // Beto continua no saguão
    clock.advance(10_000); // Ana: 20 s sem consultar; Beto: 10 s
    expect(lobby.view(beto.player.id).available).toEqual([]); // Ana sumiu da lista
    expect(lobby.view(ana.player.id).available.map((p) => p.nickname)).toEqual(["Beto"]);
  });

  it("jogador no Quiz (sem consultar o saguão) não recebe convite", () => {
    const { lobby, join, clock } = setup();
    const ana = join("Ana");
    const beto = join("Beto");
    clock.advance(20_000);
    lobby.heartbeat(beto.player.id); // Beto está vivo, mas fora do saguão
    lobby.view(ana.player.id);
    expect(lobby.invite(ana.player.id, beto.player.id, "vaca")).toEqual({ ok: false, reason: "target_unavailable" });
  });

  it("a sessão só acaba depois de 120 s sem nenhum sinal; heartbeat renova", () => {
    const { lobby, join, clock } = setup();
    const ana = join("Ana");
    const beto = join("Beto");
    clock.advance(100_000);
    lobby.heartbeat(beto.player.id);
    clock.advance(30_000); // Ana: 130 s sem sinal; Beto: 30 s
    expect(lobby.sweep()).toEqual([ana.player.id]);
    expect(lobby.authenticate(beto.token)).toBeDefined();
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

describe("Lobby: convite por link (WhatsApp)", () => {
  it("quem abre o link e aceita primeiro joga com quem convidou, mesmo sem estar no saguão", () => {
    const { lobby, join } = setup();
    const ana = join("Ana");
    const link = lobby.inviteByLink(ana.player.id, "vaca");
    if (!link.ok) throw new Error("falha");
    expect(link.value.toPlayerId).toBeNull();

    const beto = lobby.join("Beto"); // entrou agora e nem chegou ao saguão
    if (!beto.ok) throw new Error("falha");
    expect(lobby.invitationInfo(link.value.id)).toMatchObject({ fromNickname: "Ana", fromPawn: "vaca", state: "created" });

    const accepted = lobby.accept(link.value.id, beto.value.player.id, "ovelha");
    expect(accepted.ok).toBe(true);
    expect(lobby.view(ana.player.id).matchId).toBeTruthy();
  });

  it("uso único: o segundo a abrir o link não entra", () => {
    const { lobby, join } = setup();
    const ana = join("Ana");
    const beto = join("Beto");
    const cris = join("Cris");
    const link = lobby.inviteByLink(ana.player.id, "vaca");
    if (!link.ok) throw new Error("falha");
    expect(lobby.accept(link.value.id, beto.player.id, "ovelha").ok).toBe(true);
    expect(lobby.accept(link.value.id, cris.player.id, "milho")).toMatchObject({ ok: false, reason: "not_available" });
    expect(lobby.invitationInfo(link.value.id)?.state).toBe("accepted");
  });

  it("o link vale por 3 minutos", () => {
    const { lobby, join, clock } = setup();
    const ana = join("Ana");
    const beto = join("Beto");
    const link = lobby.inviteByLink(ana.player.id, "vaca");
    if (!link.ok) throw new Error("falha");
    clock.advance(181_000);
    expect(lobby.invitationInfo(link.value.id)?.state).toBe("expired");
    expect(lobby.accept(link.value.id, beto.player.id, "ovelha")).toMatchObject({ ok: false, reason: "expired" });
  });

  it("quem criou o link não pode aceitar o próprio convite, nem usar o mesmo peão", () => {
    const { lobby, join } = setup();
    const ana = join("Ana");
    const beto = join("Beto");
    const link = lobby.inviteByLink(ana.player.id, "vaca");
    if (!link.ok) throw new Error("falha");
    expect(lobby.accept(link.value.id, ana.player.id, "ovelha")).toMatchObject({ ok: false, reason: "own_invitation" });
    expect(lobby.accept(link.value.id, beto.player.id, "vaca")).toMatchObject({ ok: false, reason: "same_pawn" });
  });

  it("se quem convidou já entrou em outra partida, o link avisa e não cria partida", () => {
    const { lobby, join } = setup();
    const ana = join("Ana");
    const beto = join("Beto");
    const cris = join("Cris");
    const link = lobby.inviteByLink(ana.player.id, "vaca");
    const direct = lobby.invite(ana.player.id, beto.player.id, "milho"); // convite novo cancela o link anterior
    if (!link.ok || !direct.ok) throw new Error("falha");
    expect(lobby.accept(link.value.id, cris.player.id, "ovelha")).toMatchObject({ ok: false, reason: "not_available" });
    lobby.accept(direct.value.id, beto.player.id, "ovelha"); // Ana entra em partida com Beto
    const second = lobby.inviteByLink(ana.player.id, "vaca");
    expect(second).toEqual({ ok: false, reason: "player_busy" });
  });

  it("o link não aparece como convite recebido de ninguém nem na lista de disponíveis", () => {
    const { lobby, join } = setup();
    const ana = join("Ana");
    const beto = join("Beto");
    lobby.inviteByLink(ana.player.id, "vaca");
    expect(lobby.view(beto.player.id).incoming).toEqual([]);
    expect(lobby.view(ana.player.id).outgoing).toMatchObject({ state: "created", toPlayerId: null });
  });

  it("convite que não existe devolve null", () => {
    const { lobby } = setup();
    expect(lobby.invitationInfo("nao-existe")).toBeNull();
  });

  it("o convite usado continua consultável por um tempo e depois é esquecido", () => {
    const { lobby, join, clock } = setup();
    const ana = join("Ana");
    const beto = join("Beto");
    const link = lobby.inviteByLink(ana.player.id, "vaca");
    if (!link.ok) throw new Error("falha");
    lobby.accept(link.value.id, beto.player.id, "ovelha");
    lobby.sweep();
    expect(lobby.invitationInfo(link.value.id)?.state).toBe("accepted"); // quem abrir agora vê "já foi usado"
    clock.advance(180_000 + 10 * 60_000 + 1000);
    lobby.heartbeat(ana.player.id);
    lobby.heartbeat(beto.player.id);
    lobby.sweep();
    expect(lobby.invitationInfo(link.value.id)).toBeNull();
  });
});
