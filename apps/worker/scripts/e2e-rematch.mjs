// Teste de ponta a ponta da REVANCHE (etapa 10) contra o servidor.
// Uso (na pasta apps/worker): npm run e2e:rematch -- http://127.0.0.1:8787
// Leva ~20 s (espera o cache do ranking vencer para conferir que a revanche não entra nele).
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const base = (process.argv[2] ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const wsBase = base.replace(/^http/, "ws");
const here = dirname(fileURLToPath(import.meta.url));
const bank = new Map(JSON.parse(readFileSync(resolve(here, "../src/data/questions.json"), "utf-8")).map((q) => [q.id, q]));

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
  return { status: res.status, data };
}

// Cliente de partida: A acerta tudo, B erra tudo (na largada B erra, então A começa).
class Player {
  constructor(name, token, id, correct) {
    Object.assign(this, { name, token, id, correct, msgs: [], waiters: [], ws: null });
  }
  connect(matchId) {
    this.msgs = [];
    this.ws = new WebSocket(`${wsBase}/api/match/${matchId}/ws?token=${this.token}`);
    this.ws.addEventListener("message", (ev) => {
      const m = JSON.parse(String(ev.data));
      this.msgs.push(m);
      this.react(m);
      this.waiters = this.waiters.filter((w) => !(w.pred(m) && (w.resolve(m), true)));
    });
    return new Promise((resolve) => this.ws.addEventListener("open", resolve));
  }
  send(obj) {
    this.ws.send(JSON.stringify(obj));
  }
  react(m) {
    const choose = (q) => {
      const full = bank.get(q.questionId);
      const rightText = full.options[full.correct];
      return q.options.find((o) => (o.text === rightText) === this.correct).key;
    };
    if (m.type === "race_question") setTimeout(() => this.send({ type: "race_answer", questionId: m.question.questionId, choice: choose(m.question) }), this.correct ? 10 : 120);
    if (m.type === "turn_question") setTimeout(() => this.send({ type: "answer", questionId: m.question.questionId, choice: choose(m.question) }), 20);
  }
  waitFor(pred, ms = 60_000) {
    const found = this.msgs.find(pred);
    if (found) return Promise.resolve(found);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("tempo esgotado esperando mensagem")), ms);
      this.waiters.push({ pred, resolve: (m) => (clearTimeout(t), resolve(m)) });
    });
  }
  lastRematch() {
    return [...this.msgs].reverse().find((m) => m.type === "rematch_status");
  }
}

const suf = Date.now().toString(36).slice(-4);
const join = async (nick) => (await api("/api/join", { method: "POST", body: { nickname: nick } })).data;
const ja = await join(`Ana${suf}`);
const jb = await join(`Beto${suf}`);
await api("/api/lobby", { token: jb.token });
const inv = await api("/api/invitations", { method: "POST", token: ja.token, body: { toPlayerId: jb.player.id, pawn: "vaca" } });
const acc = await api(`/api/invitations/${inv.data.id}/accept`, { method: "POST", token: jb.token, body: { pawn: "ovelha" } });
const A = new Player("A", ja.token, ja.player.id, true);
const B = new Player("B", jb.token, jb.player.id, false);

// ---------- partida 1 (vale para o ranking) ----------
await Promise.all([A.connect(acc.data.matchId), B.connect(acc.data.matchId)]);
const end1 = await A.waitFor((m) => m.type === "match_ended");
await B.waitFor((m) => m.type === "match_ended");
check("a primeira partida termina com vencedor e vale para o ranking", end1.result.rankable === true && end1.result.winnerId === A.id);

const idle = await A.waitFor((m) => m.type === "rematch_status");
check("ao terminar, a revanche fica disponível (ninguém pediu ainda)", idle.state === "idle");

// ---------- pedido e aceite ----------
A.send({ type: "rematch_request" });
const asked = await B.waitFor((m) => m.type === "rematch_status" && m.state === "pending");
check("quando A pede, B é avisado de que A quer a revanche", asked.requestedBy === A.id && asked.expiresInMs > 170_000 && asked.expiresInMs <= 180_000, `expira em ${Math.round(asked.expiresInMs / 1000)} s`);
check("a revanche não começa só com o pedido de um lado", !A.msgs.some((m) => m.type === "rematch_started"));

B.send({ type: "rematch_request" });
const started = await A.waitFor((m) => m.type === "rematch_started");
await B.waitFor((m) => m.type === "rematch_started");
check("quando os dois aceitam, os dois recebem a partida nova", !!started.matchId && started.matchId !== acc.data.matchId);

// ---------- partida 2 (revanche: mesmos jogadores e peões, fora do ranking) ----------
await Promise.all([A.connect(started.matchId), B.connect(started.matchId)]);
const welcome = await A.waitFor((m) => m.type === "welcome");
check("mesmos jogadores e mesmos peões", welcome.you.nickname === `Ana${suf}` && welcome.you.pawn === "vaca" && welcome.opponent.nickname === `Beto${suf}` && welcome.opponent.pawn === "ovelha");
await A.waitFor((m) => m.type === "race_question");
check("a revanche começa com a pergunta de largada", true);
const end2 = await A.waitFor((m) => m.type === "match_ended");
check("a revanche termina com vencedor, mas NÃO vale para o ranking", end2.result.winnerId === A.id && end2.result.rankable === false);

// ---------- o ranking conta só a primeira partida ----------
await sleep(10_800);
const ranking = (await api("/api/ranking")).data;
const rows = ranking.trail.filter((r) => r.winnerNickname === `Ana${suf}`);
check("no ranking da Trilha só a primeira partida do par aparece", rows.length <= 1, `linhas de Ana${suf}: ${rows.length}`);

// ---------- recusa ----------
await B.waitFor((m) => m.type === "match_ended" && m.result);
const offer2 = await A.waitFor((m) => m.type === "rematch_status" && m.state === "idle");
check("a revanche também pode ser pedida de novo depois da revanche", offer2.state === "idle");
B.send({ type: "rematch_request" });
await A.waitFor((m) => m.type === "rematch_status" && m.state === "pending");
A.send({ type: "rematch_decline" });
const declined = await B.waitFor((m) => m.type === "rematch_status" && m.state === "declined");
check("recusar encerra a oferta para os dois", declined.state === "declined" && A.lastRematch().state === "declined");
A.send({ type: "rematch_request" });
const err = await A.waitFor((m) => m.type === "error" && m.reason.startsWith("rematch_"));
check("depois de recusada, não dá para pedir de novo", err.reason === "rematch_closed", err.reason);

// ---------- quem sai cancela ----------
// partida nova entre os mesmos (via convite) para testar "Novo adversário"
A.ws.close();
B.ws.close();
await sleep(500);
await api("/api/lobby", { token: jb.token });
await api("/api/lobby", { token: ja.token });
const inv2 = await api("/api/invitations", { method: "POST", token: ja.token, body: { toPlayerId: jb.player.id, pawn: "milho" } });
const acc2 = await api(`/api/invitations/${inv2.data.id}/accept`, { method: "POST", token: jb.token, body: { pawn: "eucalipto" } });
check("depois de uma revanche recusada, os dois podem se convidar normalmente", acc2.status === 200);
const A2 = new Player("A", ja.token, ja.player.id, true);
const B2 = new Player("B", jb.token, jb.player.id, false);
await Promise.all([A2.connect(acc2.data.matchId), B2.connect(acc2.data.matchId)]);
await A2.waitFor((m) => m.type === "match_ended");
await B2.waitFor((m) => m.type === "rematch_status" && m.state === "idle");
A2.send({ type: "rematch_request" });
await B2.waitFor((m) => m.type === "rematch_status" && m.state === "pending");
B2.ws.close(); // B escolhe "Novo adversário" e sai da tela de resultado
const left = await A2.waitFor((m) => m.type === "rematch_status" && m.state === "cancelled");
check("quem sai da tela de resultado cancela a revanche e o outro é avisado", left.state === "cancelled");

const falhas = results.filter((r) => !r).length;
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
