import { describe, expect, it } from "vitest";
import { FakeClock } from "../time/FakeClock";
import { TtlCache } from "./TtlCache";

describe("TtlCache", () => {
  it("dentro do prazo reaproveita o valor; depois do prazo recalcula", async () => {
    const clock = new FakeClock(0);
    const cache = new TtlCache<number>(clock, 10_000);
    let calls = 0;
    const compute = async () => ++calls;
    expect(await cache.get(compute)).toBe(1);
    clock.advance(9_999);
    expect(await cache.get(compute)).toBe(1);
    clock.advance(1);
    expect(await cache.get(compute)).toBe(2);
    expect(calls).toBe(2);
  });

  it("requisições simultâneas compartilham o mesmo cálculo", async () => {
    const cache = new TtlCache<number>(new FakeClock(0), 10_000);
    let calls = 0;
    const compute = async () => ++calls;
    const [a, b, c] = await Promise.all([cache.get(compute), cache.get(compute), cache.get(compute)]);
    expect([a, b, c]).toEqual([1, 1, 1]);
    expect(calls).toBe(1);
  });

  it("se o cálculo falhar, o erro não fica guardado", async () => {
    const cache = new TtlCache<number>(new FakeClock(0), 10_000);
    await expect(cache.get(() => Promise.reject(new Error("falhou")))).rejects.toThrow("falhou");
    await Promise.resolve();
    await Promise.resolve();
    expect(await cache.get(async () => 7)).toBe(7);
  });
});
