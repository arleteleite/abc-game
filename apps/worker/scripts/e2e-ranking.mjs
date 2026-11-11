// Teste de ponta a ponta do ranking público (etapa 8).
// Uso (na pasta apps/worker): npm run e2e:ranking -- http://127.0.0.1:8787
// Leva ~25 s: espera o ranking guardado (cache de 10 s) vencer para ver a atualização.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const base = (process.argv[2] ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const here = dirname(fileURLToPath(import.meta.url));
const bank = new Map(JSON.parse(readFileSync(resolve(here, "../src/data/questions.json"), "utf-8")).map((q) => [q.statement, q]));

const results = [];
const check = (nome, ok, detalhe = "") => {
  results.push(ok);
  console.log(`${ok ? "PASSOU" : "FALHOU"}  ${nome}${detalhe ? "  (" + detalhe + ")" : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, { method = "GET", token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data, headers: res.headers };
}

const first = await api("/api/ranking");
check("o ranking é público (sem token) e responde 200", first.status === 200);
const r0 = first.data;
check("traz o top 5 do Quiz e da Trilha, no máximo", r0.quiz.length <= 5 && r0.trail.length <= 5, `quiz=${r0.quiz.length}, trilha=${r0.trail.length}`);
check("as posições vão de 1 em diante, sem pular", r0.quiz.every((row, i) => row.position === i + 1) && r0.trail.every((row, i) => row.position === i + 1));

const quizOrdered = r0.quiz.every((row, i, all) => {
  if (i === 0) return true;
  const prev = all[i - 1];
  return prev.correctCount > row.correctCount || (prev.correctCount === row.correctCount && prev.correctMs <= row.correctMs);
});
check("Quiz: ordenado por acertos e, no empate, pelo menor tempo", quizOrdered);
check("Trilha: ordenada pelo menor tempo do vencedor", r0.trail.every((row, i, all) => i === 0 || all[i - 1].winnerTotalAnswerMs <= row.winnerTotalAnswerMs));

const allowedQuiz = ["position", "nickname", "correctCount", "correctMs"].sort().join();
const allowedTrail = ["position", "winnerNickname", "loserNickname", "winnerTotalAnswerMs"].sort().join();
check(
  "só apelidos e números: nenhum identificador de jogador, token ou partida",
  r0.quiz.every((r) => Object.keys(r).sort().join() === allowedQuiz) && r0.trail.every((r) => Object.keys(r).sort().join() === allowedTrail) && !/token|playerId|sessionId|matchId/i.test(JSON.stringify(r0)),
);
check("traz os intervalos de atualização (app e telão)", r0.pollSeconds > 0 && r0.telaoPollSeconds > 0, `app=${r0.pollSeconds}s, telão=${r0.telaoPollSeconds}s`);
check("manda cabeçalho de cache curto", /max-age/.test(first.headers.get("cache-control") ?? ""));

// ---------- uma partida nova de Quiz muda o ranking, depois que o cache vence ----------
const suf = Date.now().toString(36).slice(-4);
const nick = `Rank${suf}`;
const joined = (await api("/api/join", { method: "POST", body: { nickname: nick } })).data;
const start = await api("/api/quiz/start", { method: "POST", token: joined.token, body: {} });
let prompt = start.data.prompt;
let final = null;
for (let i = 0; i < 10; i++) {
  const full = bank.get(prompt.question.statement);
  const key = prompt.question.options.find((o) => o.text === full.options[full.correct]).key;
  const res = await api("/api/quiz/answer", { method: "POST", token: joined.token, body: { quizId: start.data.quizId, questionId: prompt.question.questionId, choice: key } });
  final = res.data;
  if (res.data.next) prompt = res.data.next;
}
const myPosition = final.result.position;

const cached = (await api("/api/ranking")).data;
check("dentro do prazo do cache o servidor reaproveita o ranking (mesmo horário de cálculo)", cached.updatedAt === r0.updatedAt, `t0=${r0.updatedAt}, agora=${cached.updatedAt}`);

await sleep(Math.max(0, r0.updatedAt + 10_500 - Date.now()) + 500);
const fresh = (await api("/api/ranking")).data;
check("depois do prazo o ranking é recalculado", fresh.updatedAt > r0.updatedAt);
if (myPosition <= 5) {
  const row = fresh.quiz[myPosition - 1];
  check("a nova partida de 10 acertos aparece no top 5", row?.nickname === nick && row.correctCount === 10, `posição=${myPosition}`);
} else {
  console.log(`INFO    a partida nova ficou em ${myPosition}º (fora do top 5, ranking já tem partidas melhores): não aparece, como esperado`);
  check("fora do top 5 a partida não aparece", !fresh.quiz.some((row) => row.nickname === nick));
}

const falhas = results.filter((r) => !r).length;
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
