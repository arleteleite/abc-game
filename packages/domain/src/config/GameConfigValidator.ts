import { DIFFICULTIES } from "../common/Difficulty";
import type { GameConfig } from "./GameConfig";

// Confere se a configuração faz sentido ANTES de o jogo usá-la.
// Devolve a lista de problemas (vazia = configuração válida).
export class GameConfigValidator {
  validate(config: GameConfig): string[] {
    const problems: string[] = [];
    const { quiz, trail } = config;

    for (const level of DIFFICULTIES) {
      if (!Number.isInteger(quiz.mix[level]) || quiz.mix[level] < 0) {
        problems.push(`quiz.mix.${level} deve ser um inteiro >= 0`);
      }
      if (!Number.isInteger(trail.advance[level]) || trail.advance[level] < 1) {
        problems.push(`trail.advance.${level} deve ser um inteiro >= 1`);
      }
      if (trail.levelRatio[level] < 0) {
        problems.push(`trail.levelRatio.${level} não pode ser negativo`);
      }
    }

    const quizTotal = DIFFICULTIES.reduce((sum, level) => sum + quiz.mix[level], 0);
    if (quizTotal < 1) problems.push("quiz.mix precisa somar pelo menos 1 pergunta");

    const ratioTotal = DIFFICULTIES.reduce((sum, level) => sum + trail.levelRatio[level], 0);
    if (Math.abs(ratioTotal - 1) > 1e-9) {
      problems.push(`trail.levelRatio deve somar 1 (soma atual: ${ratioTotal})`);
    }

    if (!Number.isInteger(trail.levelBlockSize) || trail.levelBlockSize < 1) {
      problems.push("trail.levelBlockSize deve ser um inteiro >= 1");
    } else {
      for (const level of DIFFICULTIES) {
        const exact = trail.levelRatio[level] * trail.levelBlockSize;
        if (Math.abs(exact - Math.round(exact)) > 1e-9) {
          problems.push(
            `trail.levelRatio.${level} × levelBlockSize (${exact}) deve ser inteiro; ajuste o tamanho do bloco`,
          );
        }
      }
    }

    if (trail.boardSize < 2) problems.push("trail.boardSize deve ser >= 2");

    const seen = new Set<number>();
    for (const event of trail.events) {
      if (event.square < 1 || event.square >= trail.boardSize) {
        problems.push(`evento "${event.label}": casa ${event.square} fora do tabuleiro (1 a ${trail.boardSize - 1})`);
      }
      if (seen.has(event.square)) problems.push(`duas ocorrências de evento na casa ${event.square}`);
      seen.add(event.square);
      if (event.value < 1) problems.push(`evento "${event.label}": value deve ser >= 1`);
    }

    if (config.nickname.minLength < 1 || config.nickname.maxLength < config.nickname.minLength) {
      problems.push("nickname: tamanhos mínimo/máximo incoerentes");
    }

    if (config.questionBank.reducedMinValidatedPerLevel > config.questionBank.minValidatedPerLevel) {
      problems.push("o mínimo reduzido não pode ser maior que o mínimo normal");
    }
    return problems;
  }

  assertValid(config: GameConfig): void {
    const problems = this.validate(config);
    if (problems.length > 0) {
      throw new Error(`Configuração do jogo inválida:\n- ${problems.join("\n- ")}`);
    }
  }
}
