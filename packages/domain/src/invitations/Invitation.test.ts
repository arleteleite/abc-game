import { describe, expect, it } from "vitest";
import { FakeClock } from "../time/FakeClock";
import { Invitation } from "./Invitation";

const setup = (toPlayerId: string | null = "B") => {
  const clock = new FakeClock(0);
  const invitation = new Invitation("inv1", "A", "vaca", toPlayerId, clock, 180);
  return { clock, invitation };
};

describe("Invitation", () => {
  it("o convidado aceita escolhendo outro peão", () => {
    const { invitation } = setup();
    expect(invitation.accept("B", "ovelha")).toMatchObject({ ok: true });
    expect(invitation.state).toBe("accepted");
    expect(invitation.guest).toEqual({ playerId: "B", pawn: "ovelha" });
  });

  it("não deixa escolher o mesmo peão de quem convidou", () => {
    const { invitation } = setup();
    expect(invitation.accept("B", "vaca")).toEqual({ ok: false, reason: "same_pawn" });
    expect(invitation.state).toBe("created");
  });

  it("expira em 3 min, decidido pelo relógio do servidor", () => {
    const { invitation, clock } = setup();
    clock.advance(179_999);
    expect(invitation.state).toBe("created");
    clock.advance(1);
    expect(invitation.state).toBe("expired");
    expect(invitation.accept("B", "ovelha")).toEqual({ ok: false, reason: "expired" });
  });

  it("uso único: o segundo clique no link é rejeitado", () => {
    const { invitation } = setup(null); // link aberto
    expect(invitation.accept("B", "ovelha").ok).toBe(true);
    expect(invitation.accept("C", "milho")).toEqual({ ok: false, reason: "not_available" });
    expect(invitation.guest?.playerId).toBe("B");
  });

  it("convite pela lista não pode ser aceito por terceiros nem por quem convidou", () => {
    const { invitation } = setup("B");
    expect(invitation.accept("C", "milho")).toEqual({ ok: false, reason: "not_invited" });
    expect(invitation.accept("A", "milho")).toEqual({ ok: false, reason: "own_invitation" });
  });

  it("o convidado pode recusar; depois disso não aceita mais", () => {
    const { invitation } = setup();
    expect(invitation.decline("B").ok).toBe(true);
    expect(invitation.state).toBe("declined");
    expect(invitation.accept("B", "ovelha")).toEqual({ ok: false, reason: "not_available" });
  });

  it("só quem convidou pode cancelar", () => {
    const { invitation } = setup();
    expect(invitation.cancel("B")).toEqual({ ok: false, reason: "not_sender" });
    expect(invitation.cancel("A").ok).toBe(true);
    expect(invitation.state).toBe("canceled");
    expect(invitation.accept("B", "ovelha")).toEqual({ ok: false, reason: "not_available" });
  });
});
