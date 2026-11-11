import type {
  InvitationView,
  MatchResult,
  MoveResult,
  OptionKey,
  Pawn,
  Player,
  PublicQuestion,
  RaceDecision,
} from "@abc-game/domain";

// ---------------------------------------------------------------------------
// HTTP (saguão). O token do jogador vai no cabeçalho Authorization: Bearer <token>.
// ---------------------------------------------------------------------------

export interface JoinRequest {
  nickname: string;
}

export interface JoinResponse {
  player: Player;
  /** Segredo do jogador; guardado só no navegador dele. */
  token: string;
}

export interface LobbyResponse {
  available: Player[];
  incoming: InvitationView[];
  outgoing: InvitationView | null;
  matchId: string | null;
  /** Quantos segundos esperar entre consultas (vem da configuração do servidor). */
  pollSeconds: number;
}

export interface InviteRequest {
  toPlayerId: string;
  pawn: Pawn;
}

export interface AcceptRequest {
  pawn: Pawn;
}

export interface MatchCreatedResponse {
  matchId: string;
}

export interface ErrorResponse {
  error: string;
}

// ---------------------------------------------------------------------------
// WebSocket da partida
// ---------------------------------------------------------------------------

export type ClientMessage =
  | { type: "race_answer"; questionId: string; choice: OptionKey | null }
  | { type: "answer"; questionId: string; choice: OptionKey | null }
  | { type: "leave" }
  | { type: "ping"; t: number };

export interface PlayerInfo {
  id: string;
  nickname: string;
  pawn: Pawn;
}

export interface PlayerState {
  playerId: string;
  position: number;
  skipsNextTurn: boolean;
}

export type ServerMessage =
  /** Primeira mensagem após conectar (e após reconectar). */
  | { type: "welcome"; you: PlayerInfo; opponent: PlayerInfo; boardSize: number }
  | { type: "waiting_opponent" }
  /** Pergunta da largada: vai para os dois. Sem resposta correta. */
  | { type: "race_question"; question: PublicQuestion; attempt: number; remainingMs: number }
  | { type: "race_waiting" }
  | { type: "race_decided"; starter: string; reason: RaceDecision }
  /** Pergunta da vez: vai só para o jogador da vez. Sem resposta correta. */
  | { type: "turn_question"; question: PublicQuestion; remainingMs: number }
  /** Para o adversário: não vê a pergunta, só de quem é a vez. */
  | { type: "opponent_turn"; playerId: string; remainingMs: number }
  /** Revelada somente depois de a resposta ser dada (ou o tempo estourar). */
  | {
      type: "answer_result";
      playerId: string;
      correct: boolean;
      timedOut: boolean;
      correctKey: OptionKey;
      move: MoveResult | null;
      skippedPlayerIds: string[];
    }
  | { type: "state"; currentPlayerId: string | null; players: PlayerState[] }
  | { type: "opponent_status"; connected: boolean; graceMs: number }
  | { type: "match_ended"; result: MatchResult; winnerNickname: string | null }
  | { type: "error"; reason: string }
  | { type: "pong"; t: number };

// ---------------------------------------------------------------------------
// Convite por link (WhatsApp)
//   POST /api/invitations/link    { pawn }  -> InvitationView (o id é o segredo do link)
//   GET  /api/invitations/<id>              -> InvitationView (quem abriu o link vê quem convidou)
//   POST /api/invitations/<id>/accept       -> o mesmo aceite do convite pela lista
// ---------------------------------------------------------------------------

export interface InviteLinkRequest {
  pawn: Pawn;
}
