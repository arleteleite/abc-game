import { useState, type FormEvent } from "react";
import { ApiError, type ApiClient } from "../api/ApiClient";
import { errorText } from "../messages";
import type { Session } from "../session/SessionStore";

interface Props {
  api: ApiClient;
  onJoined: (session: Session) => void;
}

// Primeira tela: o jogador escolhe um apelido e entra. Sem telefone, sem login.
export function HomeScreen({ api, onJoined }: Props) {
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { player, token } = await api.join(nickname);
      onJoined({ player, token });
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "unknown"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen home">
      <h1 className="title">ABC+ GAME</h1>
      <p className="subtitle">Jogos do Plano ABC+ Tocantins</p>

      <form onSubmit={submit} className="card">
        <label htmlFor="nickname" className="label">
          Como quer ser chamado(a)?
        </label>
        <input
          id="nickname"
          className="input"
          value={nickname}
          maxLength={16}
          autoComplete="off"
          autoFocus
          placeholder="Seu apelido"
          onChange={(e) => setNickname(e.target.value)}
        />
        {error && (
          <p className="error" role="alert">
            <span aria-hidden="true">⚠ </span>
            {error}
          </p>
        )}
        <button className="button primary" type="submit" disabled={busy || nickname.trim().length < 2}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
        <p className="hint">Só o apelido é usado. Não pedimos telefone nem login.</p>
      </form>

      <div className="games">
        <div className="game-card active">
          <h2>Trilha ABC+</h2>
          <p>Disputa em dupla: desafie outro jogador e corra até a casa 15.</p>
        </div>
        <div className="game-card disabled" aria-disabled="true">
          <h2>Quiz ABC+</h2>
          <p>Em breve.</p>
        </div>
      </div>
    </main>
  );
}
