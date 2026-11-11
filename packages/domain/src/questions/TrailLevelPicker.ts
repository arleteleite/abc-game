import { DIFFICULTIES, type Difficulty } from "../common/Difficulty";
import type { TrailConfig } from "../config/GameConfig";
import type { ListShuffler } from "../random/ListShuffler";

// Decide o nível da próxima pergunta de CADA jogador da Trilha.
// A ordem é aleatória, mas a proporção é garantida por jogador: a cada bloco
// (padrão: 10 perguntas) o jogador recebe 4 fáceis, 3 médias e 3 difíceis,
// embaralhadas. Assim os dois jogadores enfrentam a mesma dificuldade no total,
// sem depender de sorte. Tem estado: um objeto por partida.
export class TrailLevelPicker {
  private readonly remaining = new Map<string, Difficulty[]>();

  constructor(
    private readonly config: TrailConfig,
    private readonly shuffler: ListShuffler,
  ) {}

  next(playerId: string): Difficulty {
    let deck = this.remaining.get(playerId);
    if (!deck || deck.length === 0) {
      deck = this.newBlock();
      this.remaining.set(playerId, deck);
    }
    return deck.pop() as Difficulty;
  }

  private newBlock(): Difficulty[] {
    const block: Difficulty[] = [];
    for (const level of DIFFICULTIES) {
      const count = Math.round(this.config.levelRatio[level] * this.config.levelBlockSize);
      for (let i = 0; i < count; i++) block.push(level);
    }
    return this.shuffler.shuffle(block);
  }
}
