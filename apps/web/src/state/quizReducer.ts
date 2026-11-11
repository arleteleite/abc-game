import type { OptionKey, QuizPrompt } from "@abc-game/domain";
import type { QuizAnswerResponse, QuizResultPayload, QuizStartResponse } from "@abc-game/protocol";

// Aviso sobre a pergunta que acabou de ser respondida (aparece sobre a próxima).
export interface QuizNotice {
  correct: boolean;
  timedOut: boolean;
  correctKey: OptionKey;
  /** Texto da alternativa certa (a letra vem do servidor; o texto, da pergunta que o celular tinha). */
  correctText: string;
}

export interface QuizViewState {
  phase: "starting" | "playing" | "finished" | "error";
  quizId: string | null;
  prompt: QuizPrompt | null;
  /** Instante (relógio do celular) em que o tempo da pergunta acaba. */
  deadlineAt: number | null;
  /** Resposta enviada e ainda sem retorno do servidor. */
  sending: boolean;
  /** Alternativa que o jogador tocou (null se o tempo acabou sem resposta). */
  selected: OptionKey | null;
  notice: QuizNotice | null;
  result: QuizResultPayload | null;
  error: string | null;
}

export type QuizAction =
  | { type: "started"; response: QuizStartResponse; at: number }
  | { type: "sending"; choice: OptionKey | null }
  | { type: "answered"; response: QuizAnswerResponse; at: number }
  | { type: "failed"; code: string }
  | { type: "reset" };

export const initialQuizState: QuizViewState = {
  phase: "starting",
  quizId: null,
  prompt: null,
  deadlineAt: null,
  sending: false,
  selected: null,
  notice: null,
  result: null,
  error: null,
};

export function quizReducer(state: QuizViewState, action: QuizAction): QuizViewState {
  switch (action.type) {
    case "reset":
      return initialQuizState;
    case "started":
      return {
        ...initialQuizState,
        phase: "playing",
        quizId: action.response.quizId,
        prompt: action.response.prompt,
        deadlineAt: action.at + action.response.prompt.remainingMs,
      };
    case "sending":
      return { ...state, sending: true, selected: action.choice };
    case "answered": {
      const r = action.response;
      const correctText = state.prompt?.question.options.find((o) => o.key === r.correctKey)?.text ?? "";
      const notice: QuizNotice = { correct: r.correct, timedOut: r.timedOut, correctKey: r.correctKey, correctText };
      if (!r.next) {
        return { ...state, phase: "finished", prompt: null, deadlineAt: null, sending: false, selected: null, notice, result: r.result };
      }
      // A próxima pergunta aparece NA HORA: o relógio dela já está correndo no servidor.
      return { ...state, prompt: r.next, deadlineAt: action.at + r.next.remainingMs, sending: false, selected: null, notice };
    }
    case "failed":
      return { ...state, phase: "error", error: action.code, sending: false };
  }
}
