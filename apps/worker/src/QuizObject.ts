import { DurableObject } from "cloudflare:workers";
import {
  AnswerShuffler,
  DEFAULT_GAME_CONFIG,
  ListShuffler,
  MathRandom,
  NotEnoughQuestionsError,
  QuestionSelector,
  QuizQuestionPlanner,
  QuizRanking,
  QuizSession,
  SystemClock,
  type QuizSnapshot,
} from "@abc-game/domain";
import type { QuizAnswerRequest, QuizAnswerResponse, QuizResultPayload, QuizStartResponse } from "@abc-game/protocol";
import type { Env } from "./env";
import { errorResponse, json, readJson } from "./http/json";
import { D1QuizResultRepository } from "./infra/D1QuizResultRepository";
import { getQuestionBank } from "./infra/questionBank";

const quizConfig = DEFAULT_GAME_CONFIG.quiz;
const STORAGE_KEY = "quiz";

interface Stored {
  quizId: string;
  playerId: string;
  nickname: string;
  snapshot: QuizSnapshot;
}

// O Quiz de UM jogador (uma instância por jogador). As regras estão em QuizSession;
// aqui só há requisições e armazenamento. O estado é guardado a cada resposta porque o
// objeto pode ser descarregado da memória entre uma pergunta e outra.
// Quem chama (o roteador) já conferiu o token e informa o jogador pelos cabeçalhos x-player-*.
export class QuizObject extends DurableObject<Env> {
  private readonly clock = new SystemClock();

  override async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    const playerId = request.headers.get("x-player-id");
    const nickname = request.headers.get("x-player-nickname");
    if (!playerId || !nickname) return errorResponse("unauthorized", 401);

    if (request.method === "POST" && path === "/start") return this.start(playerId, nickname);
    if (request.method === "POST" && path === "/answer") return this.answer(request, playerId);
    return errorResponse("not_found", 404);
  }

  /** Começa uma partida nova (a anterior, se existir, é descartada: PRD 6, queda reinicia). */
  private async start(playerId: string, nickname: string): Promise<Response> {
    try {
      const shuffler = new ListShuffler(new MathRandom());
      const selector = new QuestionSelector(getQuestionBank(), shuffler);
      const questions = new QuizQuestionPlanner(selector, shuffler, quizConfig).plan();
      const session = QuizSession.create(questions, new AnswerShuffler(shuffler), this.clock, quizConfig.secondsPerQuestion);
      const quizId = crypto.randomUUID();
      await this.ctx.storage.put<Stored>(STORAGE_KEY, { quizId, playerId, nickname, snapshot: session.snapshot() });
      return json({ quizId, prompt: session.current() } as QuizStartResponse);
    } catch (error) {
      if (error instanceof NotEnoughQuestionsError) return errorResponse("question_bank_empty", 503);
      throw error;
    }
  }

  private async answer(request: Request, playerId: string): Promise<Response> {
    const body = await readJson(request);
    if (!body || typeof body["quizId"] !== "string" || typeof body["questionId"] !== "string") {
      return errorResponse("invalid_request", 400);
    }
    const choice = body["choice"] ?? null;
    if (choice !== null && !["A", "B", "C", "D"].includes(String(choice))) return errorResponse("invalid_request", 400);
    const { quizId, questionId } = body as unknown as QuizAnswerRequest;

    const stored = await this.ctx.storage.get<Stored>(STORAGE_KEY);
    if (!stored || stored.quizId !== quizId || stored.playerId !== playerId) return errorResponse("no_active_quiz", 409);

    const session = QuizSession.restore(stored.snapshot, this.clock, quizConfig.secondsPerQuestion);
    const outcome = session.answer(questionId, choice as QuizAnswerRequest["choice"]);
    if (!outcome.ok) return errorResponse(outcome.reason, 409);
    const { correct, timedOut, correctKey, next, summary } = outcome.value;

    let result: QuizResultPayload | null = null;
    if (summary) {
      result = await this.finish(stored, summary);
      await this.ctx.storage.delete(STORAGE_KEY);
    } else {
      await this.ctx.storage.put<Stored>(STORAGE_KEY, { ...stored, snapshot: session.snapshot() });
    }
    return json({ correct, timedOut, correctKey, next, result } satisfies QuizAnswerResponse);
  }

  /** Grava o resultado (uma vez por partida) e calcula a posição no ranking. */
  private async finish(stored: Stored, summary: NonNullable<ReturnType<QuizSession["summary"]>>): Promise<QuizResultPayload> {
    const repository = new D1QuizResultRepository(this.env.DB);
    await repository.save({
      sessionId: stored.quizId,
      playerId: stored.playerId,
      nickname: stored.nickname,
      correctCount: summary.correctCount,
      correctMs: summary.correctMs,
      hardCorrectMs: summary.hardCorrectMs,
      endedAt: this.clock.now(),
    });
    const ranking = new QuizRanking();
    const standings = ranking.standings(await repository.all());
    return {
      ...summary,
      position: standings.find((s) => s.record.playerId === stored.playerId)?.position ?? null,
      players: standings.length,
    };
  }
}
