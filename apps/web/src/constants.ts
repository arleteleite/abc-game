import type { Pawn } from "@abc-game/domain";

export const PAWN_OPTIONS: ReadonlyArray<{ pawn: Pawn; label: string }> = [
  { pawn: "vaca", label: "Vaca" },
  { pawn: "ovelha", label: "Ovelha" },
  { pawn: "milho", label: "Milho" },
  { pawn: "seringueira", label: "Seringueira" },
  { pawn: "eucalipto", label: "Eucalipto" },
];

export const pawnLabel = (pawn: Pawn): string => PAWN_OPTIONS.find((p) => p.pawn === pawn)?.label ?? pawn;

// Ícone de cada casa de evento (mesmos números do GameConfig do domínio).
export const EVENT_ICONS: Readonly<Record<number, { icon: string; label: string }>> = {
  3: { icon: "veranico", label: "Veranico: perde a vez" },
  5: { icon: "extensao-rural", label: "Assistência técnica: +2 casas" },
  8: { icon: "fogo", label: "Fogo: perde a vez" },
  10: { icon: "fixacao-biologica", label: "FBN: +2 casas" },
};

/** Quanto tempo o aviso de acerto/erro fica na tela. [P] */
export const FEEDBACK_MS = 1800;
