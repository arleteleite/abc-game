-- Resultados da Trilha que valem para o ranking (PRD 8).
-- Só apelidos e números; nenhum identificador de jogador.
CREATE TABLE IF NOT EXISTS trail_results (
  match_id TEXT PRIMARY KEY,            -- chave: gravar a mesma partida duas vezes não duplica
  winner_nickname TEXT NOT NULL,
  loser_nickname TEXT NOT NULL,
  winner_total_answer_ms INTEGER NOT NULL,
  ended_at INTEGER NOT NULL             -- ms desde 1970
);
CREATE INDEX IF NOT EXISTS idx_trail_ranking
  ON trail_results (winner_total_answer_ms, ended_at);
