import { QuizRankingTable, TrailRankingTable } from "../components/RankingTables";
import { useRanking } from "../hooks/useRanking";

// Ranking dentro do app (top 5 de cada jogo).
export function RankingScreen({ onBack }: { onBack: () => void }) {
  const { data, offline } = useRanking("app");
  return (
    <main className="screen">
      <header className="topbar">
        <h1>Ranking</h1>
        <button className="button small" onClick={onBack}>
          Voltar
        </button>
      </header>
      {offline && (
        <p className="banner warn" role="status">
          ⚠ Sem conexão. Mostrando o último ranking recebido.
        </p>
      )}
      {!data && !offline && <p className="hint center">Carregando…</p>}
      {data && (
        <>
          <section className="card">
            <h2>Quiz ABC+</h2>
            <QuizRankingTable rows={data.quiz} />
          </section>
          <section className="card">
            <h2>Trilha ABC+</h2>
            <TrailRankingTable rows={data.trail} />
          </section>
        </>
      )}
    </main>
  );
}
