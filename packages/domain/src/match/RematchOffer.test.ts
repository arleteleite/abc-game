import { describe, expect, it } from "vitest";
import { FakeClock } from "../time/FakeClock";
import { RematchOffer } from "./RematchOffer";

const setup = () => {
  const clock = new FakeClock(0);
  return { clock, offer: new RematchOffer(["A", "B"], clock, 180) };
};

describe("RematchOffer", () => {
  it("começa sem pedidos", () => {
    expect(setup().offer.status()).toMatchObject({ state: "idle", requestedBy: null });
  });

  it("o primeiro a pedir deixa pendente; o segundo fecha o acordo", () => {
    const { offer } = setup();
    expect(offer.request("A")).toMatchObject({ ok: true, value: { state: "pending", requestedBy: "A" } });
    expect(offer.request("B")).toMatchObject({ ok: true, value: { state: "agreed" } });
  });

  it("o mesmo jogador pedindo de novo não fecha o acordo sozinho", () => {
    const { offer } = setup();
    offer.request("A");
    expect(offer.request("A")).toMatchObject({ ok: true, value: { state: "pending" } });
  });

  it("vale por 3 minutos a partir do primeiro pedido", () => {
    const { offer, clock } = setup();
    clock.advance(60_000); // o tempo na tela de resultado antes de pedir não conta
    offer.request("A");
    clock.advance(179_999);
    expect(offer.status().state).toBe("pending");
    clock.advance(1);
    expect(offer.status().state).toBe("expired");
    expect(offer.request("B")).toEqual({ ok: false, reason: "closed" });
  });

  it("recusar encerra a oferta para os dois", () => {
    const { offer } = setup();
    offer.request("A");
    expect(offer.decline("B")).toMatchObject({ ok: true, value: { state: "declined" } });
    expect(offer.request("A")).toEqual({ ok: false, reason: "closed" });
  });

  it("quem sai cancela a oferta, mesmo antes de alguém pedir", () => {
    const { offer } = setup();
    offer.cancel();
    expect(offer.status().state).toBe("cancelled");
    expect(offer.request("A")).toEqual({ ok: false, reason: "closed" });
  });

  it("depois do acordo, nada mais muda", () => {
    const { offer } = setup();
    offer.request("A");
    offer.request("B");
    offer.cancel();
    expect(offer.status().state).toBe("agreed");
    expect(offer.decline("A")).toEqual({ ok: false, reason: "closed" });
  });

  it("rejeita quem não está na partida", () => {
    const { offer } = setup();
    expect(offer.request("X")).toEqual({ ok: false, reason: "unknown_player" });
    expect(offer.decline("X")).toEqual({ ok: false, reason: "unknown_player" });
  });
});
