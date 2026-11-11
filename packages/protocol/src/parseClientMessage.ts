import { OPTION_KEYS, type OptionKey } from "@abc-game/domain";
import type { ClientMessage } from "./messages";

const isChoice = (v: unknown): v is OptionKey | null =>
  v === null || (typeof v === "string" && (OPTION_KEYS as readonly string[]).includes(v));

// Tudo o que chega do celular é dado não confiável: confere a forma antes de usar.
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== "string" || raw.length > 2000) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const m = data as Record<string, unknown>;

  switch (m["type"]) {
    case "race_answer":
    case "answer":
      if (typeof m["questionId"] === "string" && isChoice(m["choice"] ?? null)) {
        return { type: m["type"], questionId: m["questionId"], choice: (m["choice"] ?? null) as OptionKey | null };
      }
      return null;
    case "leave":
      return { type: "leave" };
    case "rematch_request":
      return { type: "rematch_request" };
    case "rematch_decline":
      return { type: "rematch_decline" };
    case "ping":
      return typeof m["t"] === "number" ? { type: "ping", t: m["t"] } : null;
    default:
      return null;
  }
}
