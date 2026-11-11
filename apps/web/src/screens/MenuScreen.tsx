import type { ApiClient } from "../api/ApiClient";
import { useHeartbeat } from "../hooks/useHeartbeat";
import type { Session } from "../session/SessionStore";

interface Props {
  api: ApiClient;
  session: Session;
  onTrail: () => void;
  onQuiz: () => void;
  onLeave: () => void;
  onSessionLost: () => void;
}

// Menu dos jogos, depois de entrar com o apelido.
export function MenuScreen({ api, session, onTrail, onQuiz, onLeave, onSessionLost }: Props) {
  useHeartbeat(api, onSessionLost);

  return (
    <main className="screen menu">
      <header className="topbar">
        <span>
          Olá, <strong>{session.player.nickname}</strong>
        </span>
        <button
          className="button small"
          onClick={() => {
            void api.leave().catch(() => undefined);
            onLeave();
          }}
        >
          Sair
        </button>
      </header>

      <h1 className="title">Escolha o jogo</h1>

      <button className="game-button" onClick={onQuiz}>
        <strong>Quiz ABC+</strong>
        <span>Jogue sozinho: 10 perguntas, 15 segundos cada. Entre no ranking!</span>
      </button>

      <button className="game-button" onClick={onTrail}>
        <strong>Trilha ABC+</strong>
        <span>Disputa em dupla: desafie outro jogador e corra até a casa 15.</span>
      </button>
    </main>
  );
}
