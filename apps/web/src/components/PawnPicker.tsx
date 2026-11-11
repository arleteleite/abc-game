import type { Pawn } from "@abc-game/domain";
import { PAWN_OPTIONS } from "../constants";
import { PawnImage } from "./PawnImage";

interface Props {
  selected: Pawn | null;
  /** Peão que não pode ser escolhido (o do adversário). */
  disabled?: Pawn | null;
  onSelect: (pawn: Pawn) => void;
}

export function PawnPicker({ selected, disabled = null, onSelect }: Props) {
  return (
    <div className="pawn-picker" role="radiogroup" aria-label="Escolha seu peão">
      {PAWN_OPTIONS.map(({ pawn, label }) => (
        <button
          key={pawn}
          type="button"
          role="radio"
          aria-checked={selected === pawn}
          className={`pawn-choice ${selected === pawn ? "selected" : ""}`}
          disabled={disabled === pawn}
          onClick={() => onSelect(pawn)}
        >
          <PawnImage pawn={pawn} size={56} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
