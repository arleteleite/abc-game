import type { Pawn } from "@abc-game/domain";

// O que o saguão entrega à partida quando um convite é aceito (só circula
// entre os dois Durable Objects, nunca chega ao celular).
export interface MatchInit {
  matchId: string;
  players: [MatchInitPlayer, MatchInitPlayer];
}

export interface MatchInitPlayer {
  playerId: string;
  nickname: string;
  pawn: Pawn;
  /** Token do jogador: é assim que a partida sabe quem está conectando. */
  token: string;
}
