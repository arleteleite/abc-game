import type { NicknameConfig } from "../config/GameConfig";
import { fail, ok, type Result } from "../common/Result";

export type NicknameProblem = "too_short" | "too_long" | "invalid_characters" | "blocked_term";

export interface ValidNickname {
  /** Apelido para exibir (sem espaços sobrando nas pontas). */
  display: string;
  /** Forma normalizada, usada para comparar unicidade ("Zé" e "ze" são o mesmo). */
  key: string;
}

const strip = (text: string): string =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Troca de símbolos comuns por letras, para pegar "b0b0" ou "p4lavr@".
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };
const unLeet = (text: string): string => [...text].map((ch) => LEET[ch] ?? ch).join("");

// Valida e normaliza apelidos (PRD 10.5): tamanho, caracteres e termos bloqueados.
export class NicknameValidator {
  private readonly blocked: readonly string[];

  constructor(private readonly config: NicknameConfig) {
    this.blocked = config.blockedTerms.map((term) => strip(term).replace(/[^a-z0-9]/g, ""));
  }

  validate(input: string): Result<ValidNickname, NicknameProblem> {
    const display = input.replace(/\s+/g, " ").trim();
    if (display.length < this.config.minLength) return fail("too_short");
    if (display.length > this.config.maxLength) return fail("too_long");
    // Letras (com acento), números, espaço, ponto, hífen e sublinhado.
    if (!/^[\p{L}\p{N} ._-]+$/u.test(display)) return fail("invalid_characters");

    const key = strip(display);
    const compact = unLeet(key).replace(/[^a-z0-9]/g, "");
    if (this.blocked.some((term) => term !== "" && compact.includes(term))) return fail("blocked_term");

    return ok({ display, key });
  }
}
