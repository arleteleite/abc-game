// Gera identificadores. Em produção, o Worker fornece uma versão
// criptograficamente aleatória (o identificador do jogador é um token).
export interface IdGenerator {
  next(): string;
}
