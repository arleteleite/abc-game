import type { Pawn } from "@abc-game/domain";
import { pawnLabel } from "../constants";

interface Props {
  pawn: Pawn;
  size?: number;
}

// Imagem do peão (WebP leve). O texto alternativo vem do nome do peão.
export function PawnImage({ pawn, size = 56 }: Props) {
  return (
    <img
      className="pawn-image"
      src={`/img/${pawn}.webp`}
      alt={pawnLabel(pawn)}
      width={size}
      height={size}
      decoding="async"
    />
  );
}
