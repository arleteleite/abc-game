// Ponto de entrada do pacote de domínio (regras puras, sem React nem Cloudflare).
export { DIFFICULTIES, type Difficulty } from "./common/Difficulty";

export { MathRandom } from "./random/MathRandom";
export { SeededRandom } from "./random/SeededRandom";
export { ListShuffler } from "./random/ListShuffler";
export type { RandomSource } from "./random/RandomSource";

export { DEFAULT_GAME_CONFIG } from "./config/GameConfig";
export type {
  BoardEventConfig,
  BoardEventKind,
  GameConfig,
  LobbyConfig,
  NicknameConfig,
  QuestionBankConfig,
  QuizConfig,
  RankingConfig,
  TrailConfig,
} from "./config/GameConfig";
export { GameConfigValidator } from "./config/GameConfigValidator";

export { OPTION_KEYS, type OptionKey, type Question, type QuestionStatus } from "./questions/Question";
export type { PresentedQuestion, PublicQuestion } from "./questions/PublicQuestion";
export type { QuestionRepository } from "./questions/QuestionRepository";
export { InMemoryQuestionRepository } from "./questions/InMemoryQuestionRepository";
export { QuestionParser } from "./questions/QuestionParser";
export { QuestionBank, type BankReport } from "./questions/QuestionBank";
export { NotEnoughQuestionsError, QuestionSelector } from "./questions/QuestionSelector";
export { AnswerShuffler } from "./questions/AnswerShuffler";
export { QuizQuestionPlanner } from "./questions/QuizQuestionPlanner";
export { TrailLevelPicker } from "./questions/TrailLevelPicker";
export { TrailQuestionDealer } from "./questions/TrailQuestionDealer";

export type { BoardEvent, EventEffect } from "./board/BoardEvent";
export { StopEvent } from "./board/StopEvent";
export { AdvanceEvent } from "./board/AdvanceEvent";
export { BoardEventFactory } from "./board/BoardEventFactory";
export { Board } from "./board/Board";
export type { MoveResult } from "./board/MoveResult";
export { PAWNS, PlayerPiece, type Pawn } from "./board/PlayerPiece";

// Etapa 4: partida, jogadores, convites, tempo
export { fail, ok, type Result } from "./common/Result";
export type { Clock } from "./time/Clock";
export { SystemClock } from "./time/SystemClock";
export { FakeClock } from "./time/FakeClock";
export type { IdGenerator } from "./ids/IdGenerator";
export { SequentialIdGenerator } from "./ids/SequentialIdGenerator";
export type { Player } from "./players/Player";
export { NicknameValidator, type NicknameProblem, type ValidNickname } from "./players/NicknameValidator";
export { PlayerRegistry, type JoinedPlayer, type JoinProblem } from "./players/PlayerRegistry";
export { Invitation, type InvitationProblem, type InvitationState } from "./invitations/Invitation";
export type { QuestionDealer } from "./questions/QuestionDealer";
export type { QuestionPresenter } from "./questions/QuestionPresenter";
export { StartRace, type RaceAnswer, type RaceDecision, type RaceStatus } from "./match/StartRace";
export { TurnManager, type AnswerRejection } from "./match/TurnManager";
export { DisconnectPolicy, type ConnectionStatus } from "./match/DisconnectPolicy";
export { Match, type MatchDependencies } from "./match/Match";
export type {
  AnswerOutcome,
  EndReason,
  MatchPhase,
  MatchRejection,
  MatchResult,
  MatchSnapshot,
  RaceOutcome,
  RacePrompt,
  TickResult,
  TurnPrompt,
} from "./match/MatchTypes";

// Etapa 5: saguão e resultados
export { Lobby, type LobbySnapshot, type InvitationView, type InviteProblem, type LobbyView, type MatchSetup, type RespondProblem } from "./lobby/Lobby";
export type { TrailRecord } from "./results/TrailRecord";
export type { TrailResultRepository } from "./results/TrailResultRepository";
export { InMemoryTrailResultRepository } from "./results/InMemoryTrailResultRepository";

// Etapa 7: Quiz
export { QuizSession, type QuizRejection } from "./quiz/QuizSession";
export type {
  QuizAnswerOutcome,
  QuizAnswerRecord,
  QuizItem,
  QuizPrompt,
  QuizSnapshot,
  QuizSummary,
} from "./quiz/QuizTypes";
export { QuizRanking, type QuizStanding } from "./quiz/QuizRanking";
export type { QuizRecord } from "./results/QuizRecord";
export type { QuizResultRepository } from "./results/QuizResultRepository";
export { InMemoryQuizResultRepository } from "./results/InMemoryQuizResultRepository";
