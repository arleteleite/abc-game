import {
  DEFAULT_GAME_CONFIG,
  QuizRanking,
  TrailRanking,
  TtlCache,
  SystemClock,
  type QuizResultRepository,
  type TrailResultRepository,
} from "@abc-game/domain";
import type { RankingResponse } from "@abc-game/protocol";

const config = DEFAULT_GAME_CONFIG.ranking;

// Monta o ranking público (top 5 do Quiz e da Trilha) e o guarda por alguns segundos:
// com 100 celulares e o telão consultando, o D1 seria lido centenas de vezes por minuto.
export class RankingReader {
  private readonly clock = new SystemClock();
  private readonly cache = new TtlCache<RankingResponse>(this.clock, config.cacheSeconds * 1000);

  constructor(
    private readonly quizResults: QuizResultRepository,
    private readonly trailResults: TrailResultRepository,
  ) {}

  read(): Promise<RankingResponse> {
    return this.cache.get(() => this.build());
  }

  private async build(): Promise<RankingResponse> {
    const [quizRecords, trailRecords] = await Promise.all([this.quizResults.all(), this.trailResults.all()]);
    return {
      quiz: new QuizRanking().top(quizRecords, config.topSize).map(({ position, record }) => ({
        position,
        nickname: record.nickname,
        correctCount: record.correctCount,
        correctMs: record.correctMs,
      })),
      trail: new TrailRanking().top(trailRecords, config.topSize).map(({ position, record }) => ({
        position,
        winnerNickname: record.winnerNickname,
        loserNickname: record.loserNickname,
        winnerTotalAnswerMs: record.winnerTotalAnswerMs,
      })),
      updatedAt: this.clock.now(),
      pollSeconds: config.pollingSeconds,
      telaoPollSeconds: config.telaoPollSeconds,
    };
  }
}
