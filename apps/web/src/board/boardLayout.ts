// Onde cada casa aparece no tabuleiro desenhado pelo app (PRD: o tabuleiro não é
// uma imagem; é desenhado sobre a cena da propriedade).

/** Ponto no tabuleiro, em % da largura (x) e da altura (y, 0 = topo). */
export interface Point {
  x: number;
  y: number;
}

export const SQUARES_PER_LEG = 5;

/**
 * Posição de cada casa na trilha sinuosa: a largada fica embaixo (casa 0) e a
 * trilha sobe em "S", 5 casas por trecho, com uma leve ondulação para parecer
 * caminho de terra e não uma grade. Serve para qualquer tamanho de tabuleiro.
 */
export function trailPoint(square: number, boardSize: number): Point {
  if (square <= 0) return { x: 10, y: 90 };
  const index = square - 1;
  const legs = Math.max(1, Math.ceil(boardSize / SQUARES_PER_LEG));
  const leg = Math.floor(index / SQUARES_PER_LEG);
  const offset = index % SQUARES_PER_LEG;
  const goingRight = leg % 2 === 0;
  const x = 20 + (goingRight ? offset : SQUARES_PER_LEG - 1 - offset) * 16;
  const baseY = legs === 1 ? 50 : 86 - leg * (72 / (legs - 1));
  const wave = offset % 2 === 0 ? 0 : -4;
  return { x, y: baseY + wave };
}

/** Caminho suave (curvas) que passa por todos os pontos, para desenhar a trilha. */
export function trailPath(boardSize: number): string {
  const pts = Array.from({ length: boardSize + 1 }, (_, i) => trailPoint(i, boardSize));
  const first = pts[0];
  if (!first) return "";
  let d = `M ${first.x} ${first.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

// Cena de fundo muda nas casas 2, 4, 7 e 10 [P] (PRD 7.5). Vale a casa de quem está na frente.
export const STAGE_THRESHOLDS = [2, 4, 7, 10] as const;

/** Estágio de 1 a 5. */
export function stageForPosition(position: number): number {
  return 1 + STAGE_THRESHOLDS.filter((limit) => position >= limit).length;
}
