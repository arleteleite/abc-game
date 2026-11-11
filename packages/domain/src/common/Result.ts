// Resultado de uma operação que pode ser recusada por regra de negócio
// (ex.: "não é a sua vez"). Evita lançar erro para casos esperados.
export type Result<T, R extends string> = { ok: true; value: T } | { ok: false; reason: R };

export const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });
export const fail = <R extends string>(reason: R): { ok: false; reason: R } => ({ ok: false, reason });
