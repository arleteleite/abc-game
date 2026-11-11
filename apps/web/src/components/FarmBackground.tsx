// Fundo da trilha desenhado em código (SVG): só terreno, sem céu atrás do caminho.
// Cinco estágios (PRD 7.5): 1 degradada, 2 pasto recuperado, 3 plantio direto/soja,
// 4 iLPF com eucalipto, 5 biodigestor + irrigação. Serve para qualquer proporção
// (o desenho estica, por isso só usa formas orgânicas).

interface Palette {
  far: string;
  a: string;
  b: string;
  c: string;
  detail: string;
}

const PALETTES: Record<number, Palette> = {
  1: { far: "#b99a52", a: "#d9bd6a", b: "#cfae55", c: "#c29f46", detail: "#8a6a35" },
  2: { far: "#6e9f55", a: "#a5cf75", b: "#94c565", c: "#84b956", detail: "#4f8a3c" },
  3: { far: "#5f9a4f", a: "#9acb6c", b: "#8cc15f", c: "#7db651", detail: "#2f7a3a" },
  4: { far: "#4f8f4a", a: "#86c262", b: "#78b857", c: "#6aad4c", detail: "#1f6a35" },
  5: { far: "#3f8a4a", a: "#7dc060", b: "#6fb556", c: "#60aa4c", detail: "#1b6a3a" },
};

const BANDS = [
  "M0 20 C25 14 45 24 70 17 S95 18 100 15 L100 40 C70 46 40 36 0 44 Z",
  "M0 42 C30 36 55 48 100 38 L100 68 C65 74 35 62 0 70 Z",
  "M0 66 C35 60 60 72 100 62 L100 100 L0 100 Z",
];

const TREE_ROWS: ReadonlyArray<readonly [number, number]> = [
  [6, 28], [14, 30], [22, 27], [78, 26], [88, 28], [95, 25],
  [5, 54], [93, 56], [96, 50],
  [6, 76], [94, 78], [9, 92], [91, 94], [96, 88],
];

const DRY_BUSHES: ReadonlyArray<readonly [number, number]> = [
  [8, 30], [92, 27], [50, 33], [6, 56], [93, 52], [50, 58], [10, 78], [90, 74], [55, 90], [30, 94],
];

const TUFTS: ReadonlyArray<readonly [number, number]> = [
  [10, 32], [90, 30], [48, 36], [8, 58], [92, 54], [52, 60], [12, 80], [88, 76], [56, 92], [30, 95],
];

function Rows({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  const lines = Array.from({ length: 7 }, (_, i) => y + (h / 6) * i);
  return (
    <g stroke={color} strokeWidth={0.9} strokeLinecap="round" opacity={0.75}>
      {lines.map((ly) => (
        <line key={ly} x1={x} y1={ly} x2={x + w} y2={ly} />
      ))}
    </g>
  );
}

export function FarmBackground({ stage }: { stage: number }) {
  const p = PALETTES[stage] ?? PALETTES[1]!;
  return (
    <svg className="farm-bg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" key={stage}>
      <rect width="100" height="100" fill={p.far} />
      <path d={BANDS[0]} fill={p.a} />
      <path d={BANDS[1]} fill={p.b} />
      <path d={BANDS[2]} fill={p.c} />
      <path d="M0 0 H100 V18 C70 12 40 22 0 16 Z" fill={p.far} opacity={0.85} />

      {stage === 1 &&
        DRY_BUSHES.map(([x, y]) => (
          <g key={`${x}${y}`} stroke={p.detail} strokeWidth={0.7} strokeLinecap="round">
            <line x1={x} y1={y} x2={x - 2} y2={y - 3} />
            <line x1={x} y1={y} x2={x} y2={y - 4} />
            <line x1={x} y1={y} x2={x + 2} y2={y - 3} />
          </g>
        ))}

      {stage === 2 &&
        TUFTS.map(([x, y]) => (
          <g key={`${x}${y}`} stroke={p.detail} strokeWidth={0.7} strokeLinecap="round">
            <line x1={x} y1={y} x2={x - 1.5} y2={y - 3} />
            <line x1={x} y1={y} x2={x + 1.5} y2={y - 3} />
          </g>
        ))}

      {stage >= 3 && (
        <>
          <Rows x={4} y={22} w={20} h={14} color={p.detail} />
          <Rows x={76} y={46} w={20} h={14} color={p.detail} />
          <Rows x={4} y={72} w={18} h={14} color={p.detail} />
        </>
      )}

      {stage >= 4 &&
        TREE_ROWS.map(([x, y]) => (
          <g key={`${x}${y}`}>
            <rect x={x - 0.4} y={y} width={0.8} height={3} fill="#6b4a2b" />
            <ellipse cx={x} cy={y - 1} rx={2.6} ry={3.6} fill={p.detail} />
          </g>
        ))}

      {stage >= 5 && (
        <g>
          <circle cx="60" cy="68" r="8" fill="#2687c4" opacity={0.28} />
          <circle cx="60" cy="68" r="8" fill="none" stroke="#1f5aa6" strokeWidth={0.6} />
          <line x1="60" y1="68" x2="67" y2="64" stroke="#1f5aa6" strokeWidth={0.8} />
          <line x1="60" y1="68" x2="53" y2="72" stroke="#1f5aa6" strokeWidth={0.8} />
          <ellipse cx="14" cy="64" rx="5" ry="4" fill="#e7eef0" stroke="#7b8c93" strokeWidth={0.5} />
          <ellipse cx="14" cy="62" rx="5" ry="2.4" fill="#f6fafb" stroke="#7b8c93" strokeWidth={0.5} />
        </g>
      )}
    </svg>
  );
}
