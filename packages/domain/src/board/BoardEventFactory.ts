import type { BoardEventConfig } from "../config/GameConfig";
import { AdvanceEvent } from "./AdvanceEvent";
import type { BoardEvent } from "./BoardEvent";
import { StopEvent } from "./StopEvent";

// Transforma a configuração (dados) em objetos de evento (comportamento).
export class BoardEventFactory {
  create(config: BoardEventConfig): BoardEvent {
    switch (config.kind) {
      case "stop":
        return new StopEvent(config.square, config.label, config.value);
      case "advance":
        return new AdvanceEvent(config.square, config.label, config.value);
    }
  }
}
