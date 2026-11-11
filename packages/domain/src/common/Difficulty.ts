// Níveis de dificuldade das perguntas (ordem usada no Quiz: fácil → difícil).
export const DIFFICULTIES = ["facil", "media", "dificil"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];
