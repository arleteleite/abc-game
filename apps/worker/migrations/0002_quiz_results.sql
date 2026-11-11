-- Resultados do Quiz (PRD 6 e 8). player_id é o identificador de sessão (sorteado,
-- não identifica a pessoa) e serve só para valer a melhor partida de cada jogador.
CREATE TABLE IF NOT EXISTS quiz_results (
  session_id TEXT PRIMARY KEY,          -- gravar a mesma partida duas vezes não duplica
  player_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  correct_count INTEGER NOT NULL,
  correct_ms INTEGER NOT NULL,
  hard_correct_ms INTEGER NOT NULL,
  ended_at INTEGER NOT NULL             -- ms desde 1970
);
CREATE INDEX IF NOT EXISTS idx_quiz_ranking
  ON quiz_results (correct_count DESC, correct_ms, hard_correct_ms, ended_at);
