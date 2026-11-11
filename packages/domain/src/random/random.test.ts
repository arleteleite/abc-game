import { describe, expect, it } from "vitest";
import { ListShuffler } from "./ListShuffler";
import { SeededRandom } from "./SeededRandom";

describe("SeededRandom", () => {
  it("a mesma semente gera a mesma sequência", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it("nextInt fica sempre em [0, max)", () => {
    const r = new SeededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.nextInt(5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
  });
});

describe("ListShuffler", () => {
  it("mantém os mesmos elementos e não altera a lista original", () => {
    const original = [1, 2, 3, 4, 5, 6];
    const shuffled = new ListShuffler(new SeededRandom(1)).shuffle(original);
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(original).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
