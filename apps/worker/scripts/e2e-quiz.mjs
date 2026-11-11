// Teste de ponta a ponta do Quiz (etapa 7) contra o servidor.
// Uso (na pasta apps/worker, com `npm run dev` rodando ou apontando para a Cloudflare):
//   npm run e2e:quiz -- http://127.0.0.1:8787
// Lê o banco de DESENVOLVIMENTO só para saber qual alternativa é a certa.
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

async function api(path, { method = "POST", token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

const rightKey = (prompt) => {
  const full = bank.get(prompt.question.statement);
  return prompt.question.options.find((o) => o.text === full.options[full.correct]).key;
};
const wrongKey = (prompt) => {
  const full = bank.get(prompt.question.statement);
  return prompt.question.options.find((o) => o.text !== full.options[full.correct]).key;
};

const suf = Date.now().toString(36).slice(-4);
const join = async (nick) => (await api("/api/join", { body: { nickname: nick } })).data;
const ana = await join(`Ana${suf}`);
const beto = await join(`Beto${suf}`);

check("sem token não inicia o Quiz", (await api("/api/quiz/start")).status === 401);
check("token inválido não inicia o Quiz", (await api("/api/quiz/start", { token: "token-invalido-123" })).status === 401);

// ---------- partida 1 da Ana: acerta 8, erra 1, estoura o tempo em 1 ----------
const start = await api("/api/quiz/start", { token: ana.token });
check("o Quiz começa com a primeira de 10 perguntas", start.status === 200 && start.data.prompt.total === 10 && start.data.prompt.index === 0);
const raw = JSON.stringify(start.data);
check("a pergunta não traz resposta correta nem explicação", !/correct|explanation/.test(raw));
check("as 4 alternativas chegam com letras A–D", start.data.prompt.question.options.map((o) => o.key).join("") === "ABCD");

let quizId = start.data.quizId;
let prompt = start.data.prompt;
let leaks = 0;
let timedOutSeen = false;
let wrongSeen = false;
let last = null;
let dupStatus = null;
for (let i = 0; i < 10; i++) {
  let choice = rightKey(prompt);
  if (i === 1) choice = wrongKey(prompt); // erra a 2ª
  if (i === 2) {
    await sleep(15_600); // estoura o tempo da 3ª
  }
  const res = await api("/api/quiz/answer", { token: ana.token, body: { quizId, questionId: prompt.question.questionId, choice } });
  if (res.status !== 200) throw new Error(`resposta rejeitada (${res.status}): ${JSON.stringify(res.data)}`);
  if (i === 0) {
    // reenvio da mesma resposta (clique duplo)
    dupStatus = (await api("/api/quiz/answer", { token: ana.token, body: { quizId, questionId: prompt.question.questionId, choice } })).status;
  }
  if (res.data.next && /correct"?\s*:|explanation/.test(JSON.stringify(res.data.next))) leaks++;
  if (i === 1) wrongSeen = res.data.correct === false && res.data.timedOut === false;
  if (i === 2) timedOutSeen = res.data.timedOut === true && res.data.correct === false;
  last = res.data;
  if (res.data.next) prompt = res.data.next;
}
check("resposta errada não pontua", wrongSeen);
check("resposta depois de 15 s conta como estouro (erro)", timedOutSeen);
check("reenvio da mesma resposta é rejeitado", dupStatus === 409, `status ${dupStatus}`);
check("as perguntas seguintes também não vazam a resposta", leaks === 0);
check("ao fim vem o resultado: 8 acertos de 10", last.result?.correctCount === 8 && last.result?.total === 10, `acertos=${last.result?.correctCount}`);
check("o tempo das corretas é somado (> 0 e sem contar o estouro)", last.result.correctMs > 0 && last.result.correctMs < 8 * 15_000);
const anaPosition = last.result.position;
check("o resultado traz a posição no ranking", Number.isInteger(anaPosition) && anaPosition >= 1, `posição=${anaPosition} de ${last.result.players}`);
check("depois do fim não aceita mais respostas", (await api("/api/quiz/answer", { token: ana.token, body: { quizId, questionId: prompt.question.questionId, choice: "A" } })).status === 409);

// ---------- partida do Beto: acerta tudo, tem que ficar à frente da Ana ----------
const startB = await api("/api/quiz/start", { token: beto.token });
let pB = startB.data.prompt;
let lastB = null;
for (let i = 0; i < 10; i++) {
  const res = await api("/api/quiz/answer", { token: beto.token, body: { quizId: startB.data.quizId, questionId: pB.question.questionId, choice: rightKey(pB) } });
  lastB = res.data;
  if (res.data.next) pB = res.data.next;
}
check("10 acertos entram no ranking (posição 1 se for o melhor)", lastB.result.correctCount === 10 && lastB.result.position >= 1, `Beto=${lastB.result.position}`);

// ---------- outra partida pior da Ana: a melhor continua valendo ----------
const start2 = await api("/api/quiz/start", { token: ana.token });
let p2 = start2.data.prompt;
let last2 = null;
for (let i = 0; i < 10; i++) {
  const res = await api("/api/quiz/answer", { token: ana.token, body: { quizId: start2.data.quizId, questionId: p2.question.questionId, choice: wrongKey(p2) } });
  last2 = res.data;
  if (res.data.next) p2 = res.data.next;
}
check("Ana (8 acertos) fica atrás do Beto (10) e a partida pior dela não a derruba: vale a melhor", last2.result.correctCount === 0 && last2.result.position > lastB.result.position && last2.result.position <= last.result.position + 1, `Ana=${last2.result.position}, Beto=${lastB.result.position}`);

// ---------- quizId antigo não funciona depois de recomeçar ----------
const start3 = await api("/api/quiz/start", { token: beto.token });
const stale = await api("/api/quiz/answer", { token: beto.token, body: { quizId: startB.data.quizId, questionId: start3.data.prompt.question.questionId, choice: "A" } });
check("partida antiga não aceita resposta depois de recomeçar", stale.status === 409);

const falhas = results.filter((r) => !r).length;
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
