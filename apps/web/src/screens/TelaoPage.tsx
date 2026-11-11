import { QuizRankingTable, TrailRankingTable } from "../components/RankingTables";
import { useRanking } from "../hooks/useRanking";

// Página do telão: só leitura, letras grandes, atualiza sozinha. A mesma página
// abre no celular (endereço /telao) se o telão cair.
export function TelaoPage() {
  const { data, offline } = useRanking("telao");
  const updated = data ? new Date(data.updatedAt).toLocaleTimeString("pt-BR") : null;
  return (
    <main className="telao">
      <header className="telao-header">
        <h1>ABC+ GAME · Ranking</h1>
        <p className="telao-status">
          {offline ? "⚠ Sem conexão: mostrando o último ranking" : updated ? `Atualizado às ${updated}` : "Carregando…"}
        </p>
      </header>
      <div className="telao-columns">
        <section className="telao-card" aria-label="Ranking do Quiz">
          <h2>Quiz ABC+</h2>
          <QuizRankingTable rows={data?.quiz ?? []} />
        </section>
        <section className="telao-card" aria-label="Ranking da Trilha">
          <h2>Trilha ABC+</h2>
          <TrailRankingTable rows={data?.trail ?? []} />
        </section>
      </div>
    </main>
  );
}
