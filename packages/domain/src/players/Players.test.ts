import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_CONFIG } from "../config/GameConfig";
import { SequentialIdGenerator } from "../ids/SequentialIdGenerator";
import { NicknameValidator } from "./NicknameValidator";
import { PlayerRegistry } from "./PlayerRegistry";

const validator = new NicknameValidator({ ...DEFAULT_GAME_CONFIG.nickname, blockedTerms: ["palavrao"] });

describe("NicknameValidator", () => {
  it("aceita apelidos comuns e tira espaços das pontas", () => {
    expect(validator.validate("  Zé da Silva ")).toMatchObject({ ok: true, value: { display: "Zé da Silva" } });
  });

  it("rejeita curto, longo e caracteres estranhos", () => {
    expect(validator.validate("a")).toEqual({ ok: false, reason: "too_short" });
    expect(validator.validate("x".repeat(17))).toEqual({ ok: false, reason: "too_long" });
    expect(validator.validate("<script>")).toEqual({ ok: false, reason: "invalid_characters" });
  });

  it("bloqueia termos mesmo com acento, maiúsculas, símbolos e trocas por números", () => {
    for (const bad of ["PALAVRÃO", "p4lavr4o", "xx_palavrao_xx", "p a l a v r a o"]) {
      expect(validator.validate(bad)).toEqual({ ok: false, reason: "blocked_term" });
    }
    // Símbolos como "@" nem chegam a ser aceitos como apelido.
    expect(validator.validate("p@lavrao")).toEqual({ ok: false, reason: "invalid_characters" });
  });

  it("'Zé' e 'ze' são o mesmo apelido para fins de unicidade", () => {
    const a = validator.validate("Zé");
    const b = validator.validate("ZE");
    expect(a.ok && b.ok && a.value.key === b.value.key).toBe(true);
  });
});

describe("PlayerRegistry", () => {
  const newRegistry = () => new PlayerRegistry(validator, new SequentialIdGenerator("p"));

  it("dois 'João' não se confundem: o segundo é recusado", () => {
    const registry = newRegistry();
    expect(registry.join("João").ok).toBe(true);
    expect(registry.join("joao")).toEqual({ ok: false, reason: "nickname_in_use" });
  });

  it("cada jogador recebe um identificador interno próprio, diferente do apelido", () => {
    const registry = newRegistry();
    const a = registry.join("Ana");
    const b = registry.join("Beto");
    expect(a.ok && b.ok && a.value.id !== b.value.id).toBe(true);
    expect(a.ok && a.value.id).toBe("p1");
  });

  it("quem sai libera o apelido e some da lista", () => {
    const registry = newRegistry();
    const ana = registry.join("Ana");
    if (!ana.ok) throw new Error("falha");
    registry.leave(ana.value.id);
    expect(registry.isActive(ana.value.id)).toBe(false);
    expect(registry.list()).toEqual([]);
    expect(registry.join("Ana").ok).toBe(true);
  });

  it("propaga o motivo de apelido inválido", () => {
    expect(newRegistry().join("a")).toEqual({ ok: false, reason: "too_short" });
  });
});
