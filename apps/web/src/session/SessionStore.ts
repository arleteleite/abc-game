import type { Player } from "@abc-game/domain";

export interface Session {
  player: Player;
  token: string;
}

const KEY = "abc-game-session";

// Guarda a sessão no navegador para sobreviver a um "recarregar". Se o
// navegador bloquear o armazenamento (aba privada), o jogo funciona do mesmo
// jeito, só não lembra de quem é o jogador depois de recarregar.
export const SessionStore = {
  load(): Session | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as Session;
      return data?.token && data?.player?.id ? data : null;
    } catch {
      return null;
    }
  },

  save(session: Session): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(session));
    } catch {
      // sem armazenamento: segue sem lembrar
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // nada a fazer
    }
  },
};
