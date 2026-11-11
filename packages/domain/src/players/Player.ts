// Um jogador ativo. `id` é o identificador interno (token); `nickname` é só o
// nome de exibição. Nada além disso é guardado (LGPD).
export interface Player {
  readonly id: string;
  readonly nickname: string;
}
