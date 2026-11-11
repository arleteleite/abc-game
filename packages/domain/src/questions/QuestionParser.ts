import { DIFFICULTIES } from "../common/Difficulty";
import { OPTION_KEYS, type OptionKey, type Question, type QuestionStatus } from "./Question";

const STATUSES: readonly QuestionStatus[] = ["Rascunho", "Revisada", "Validada", "Reprovada", "Reescrever"];

// Converte o JSON gerado pelo script (dado externo, não confiável) em Question[].
// Falha com mensagem clara se algo estiver errado, em vez de jogar com dado ruim.
export class QuestionParser {
  parse(raw: unknown): Question[] {
    if (!Array.isArray(raw)) throw new Error("O banco de perguntas deve ser uma lista");
    const ids = new Set<string>();
    return raw.map((item, index) => {
      const q = this.parseOne(item, index);
      if (ids.has(q.id)) throw new Error(`Pergunta duplicada: ${q.id}`);
      ids.add(q.id);
      return q;
    });
  }

  private parseOne(item: unknown, index: number): Question {
    const where = `pergunta #${index + 1}`;
    if (typeof item !== "object" || item === null) throw new Error(`${where}: formato inválido`);
    const o = item as Record<string, unknown>;

    const text = (field: string): string => {
      const v = o[field];
      if (typeof v !== "string") throw new Error(`${where}: campo "${field}" ausente ou não é texto`);
      return v;
    };

    const id = text("id");
    if (id.trim() === "") throw new Error(`${where}: id vazio`);

    const difficulty = text("difficulty");
    if (!(DIFFICULTIES as readonly string[]).includes(difficulty)) {
      throw new Error(`${id}: dificuldade inválida "${difficulty}"`);
    }
    const status = text("status");
    if (!(STATUSES as readonly string[]).includes(status)) throw new Error(`${id}: status inválido "${status}"`);

    const correct = text("correct");
    if (!(OPTION_KEYS as readonly string[]).includes(correct)) throw new Error(`${id}: correta inválida "${correct}"`);

    const rawOptions = o["options"];
    if (typeof rawOptions !== "object" || rawOptions === null) throw new Error(`${id}: "options" ausente`);
    const options = {} as Record<OptionKey, string>;
    for (const key of OPTION_KEYS) {
      const v = (rawOptions as Record<string, unknown>)[key];
      if (typeof v !== "string" || v.trim() === "") throw new Error(`${id}: alternativa ${key} vazia ou ausente`);
      options[key] = v;
    }

    const statement = text("statement");
    if (statement.trim() === "") throw new Error(`${id}: enunciado vazio`);

    return {
      id,
      difficulty: difficulty as Question["difficulty"],
      theme: text("theme"),
      statement,
      options,
      correct: correct as OptionKey,
      explanation: text("explanation"),
      source: text("source"),
      alert: text("alert"),
      status: status as QuestionStatus,
    };
  }
}
