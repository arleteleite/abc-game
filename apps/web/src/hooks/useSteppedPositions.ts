import { useEffect, useRef, useState } from "react";

const STEP_MS = 260;

/**
 * Posição "mostrada" de cada peão: quando o servidor manda um avanço (por
 * exemplo de 2 para 5), o peão passa por 3, 4 e 5, uma casa de cada vez, para o
 * jogador acompanhar o caminho. Recuos e trocas aparecem na hora.
 */
export function useSteppedPositions(target: Readonly<Record<string, number>>): Record<string, number> {
  const [shown, setShown] = useState<Record<string, number>>(() => ({ ...target }));
  const targetRef = useRef(target);
  targetRef.current = target;
  const key = JSON.stringify(target);

  useEffect(() => {
    const timer = setInterval(() => {
      setShown((current) => {
        let changed = false;
        const next: Record<string, number> = { ...current };
        for (const [id, goal] of Object.entries(targetRef.current)) {
          const now = current[id];
          if (now === undefined || goal < now) {
            if (now !== goal) {
              next[id] = goal;
              changed = true;
            }
          } else if (now < goal) {
            next[id] = now + 1;
            changed = true;
          }
        }
        return changed ? next : current;
      });
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [key]);

  return shown;
}
