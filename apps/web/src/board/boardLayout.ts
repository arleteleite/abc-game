// Onde cada casa aparece no tabuleiro desenhado pelo app (PRD: o tabuleiro não é
// uma imagem; é desenhado sobre a cena da propriedade).

export interface Cell {
  row: number; // 0 = linha de cima
  col: number; // 0 = coluna da esquerda
}

export const BOARD_COLUMNS = 5;

/**
 * Casa 1..N em "cobrinha": a primeira linha vai da esquerda para a direita, a
 * segunda volta da direita para a esquerda, e assim por diante.
 */
export function cellOfSquare(square: number, columns: number = BOARD_COLUMNS): Cell {
  const index = square - 1;
  const row = Math.floor(index / columns);
  const offset = index % columns;
  const col = row % 2 === 0 ? offset : columns - 1 - offset;
  return { row, col };
}

// Cena de fundo muda nas casas 2, 4, 7 e 10 [P] (PRD 7.5). Vale a casa de quem está na frente.
export const STAGE_THRESHOLDS = [2, 4, 7, 10] as const;

/** Estágio de 1 a 5. */
export function stageForPosition(position: number): number {
  return 1 + STAGE_THRESHOLDS.filter((limit) => position >= limit).length;
}
