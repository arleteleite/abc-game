import type { BoardEventKind } from "../config/GameConfig";

// Efeito de cair numa casa de evento.
export interface EventEffect {
  /** Casas extras que o jogador avança. */
  extraAdvance: number;
  /** Quantas vezes dele o jogador perde. */
  skipTurns: number;
}

// Um evento fixo do tabuleiro. Cada tipo de evento é uma classe própria.
export interface BoardEvent {
  readonly square: number;
  readonly kind: BoardEventKind;
  readonly label: string;
  apply(): EventEffect;
}
