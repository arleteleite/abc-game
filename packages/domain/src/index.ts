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
