import type { IdGenerator } from "@abc-game/domain";

// Identificadores imprevisíveis (UUID aleatório). Serve de token secreto.
export class CryptoIdGenerator implements IdGenerator {
  next(): string {
    return crypto.randomUUID();
  }
}
