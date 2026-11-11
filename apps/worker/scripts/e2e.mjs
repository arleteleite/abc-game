// Teste de ponta a ponta da Trilha (etapa 5): dois clientes de teste jogam uma
// partida completa contra o servidor, e o script confere as regras que importam.
//
// Uso (na pasta apps/worker, com `npm run dev` rodando em outro terminal):
//   npm run e2e -- http://127.0.0.1:8787
//
// O script lê o banco de perguntas de DESENVOLVIMENTO (src/data/questions.json)
// só para saber qual alternativa é a certa; o servidor nunca revela isso antes da resposta.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const base = (process.argv[2] ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const wsBase = base.replace(/^http/, "ws");
const here = dirname(fileURLToPath(import.meta.url));
const bank = new Map(
  JSON.parse(readFileSync(resolve(here, "../src/data/questions.json"), "utf-8")).map((q) => [q.id, q]),
);

const results = [];
function check(nome, ok, detalhe = "") {
  results.push(ok);
  console.log(`${ok ? "PASSOU" : "FALHOU"}  ${nome}${detalhe ? "  (" + detalhe + ")" : ""}`);
}
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

// ---------- 1) saguão ----------
const suf = Date.now().toString(36).slice(-4);
const joinA = await api("/api/join", { method: "POST", body: { nickname: `Ana${suf}` } });
const joinB = await api("/api/join", { method: "POST", body: { nickname: `Beto${suf}` } });
check("dois jogadores entram com apelido", joinA.status === 200 && joinB.status === 200);
const A = { name: "A", token: joinA.data.token, id: joinA.data.player.id, correct: true };
const B = { name: "B", token: joinB.data.token, id: joinB.data.player.id, correct: false };

check("apelido repetido é recusado", (await api("/api/join", { method: "POST", body: { nickname: `ana${suf}` } })).status === 409);
check("sem token não acessa o saguão", (await api("/api/lobby")).status === 401);
check("rota interna não é alcançável pela internet", [401, 404].includes((await api("/api/internal/match-ended", { method: "POST", body: { matchId: "x" } })).status));

const lobbyA = await api("/api/lobby", { token: A.token });
check("a lista de disponíveis mostra o outro jogador, sem tokens", lobbyA.data.available.some((p) => p.id === B.id) && !JSON.stringify(lobbyA.data).includes(B.token));

const inv = await api("/api/invitations", { method: "POST", token: A.token, body: { toPlayerId: B.id, pawn: "vaca" } });
check("convite criado pela lista", inv.status === 200);
const lobbyB = await api("/api/lobby", { token: B.token });
check("o convidado vê o convite recebido", lobbyB.data.incoming.length === 1 && lobbyB.data.incoming[0].fromNickname === `Ana${suf}`);
check("mesmo peão do convidante é recusado", (await api(`/api/invitations/${inv.data.id}/accept`, { method: "POST", token: B.token, body: { pawn: "vaca" } })).status === 409);
const accepted = await api(`/api/invitations/${inv.data.id}/accept`, { method: "POST", token: B.token, body: { pawn: "ovelha" } });
check("convite aceito cria a partida", accepted.status === 200 && !!accepted.data.matchId);
const matchId = accepted.data.matchId;
check("convite usado não pode ser aceito de novo", (await api(`/api/invitations/${inv.data.id}/accept`, { method: "POST", token: B.token, body: { pawn: "milho" } })).status === 409);
check("o convidante enxerga a partida no saguão", (await api("/api/lobby", { token: A.token })).data.matchId === matchId);

// ---------- 2) partida ----------
const allRaw = [];
const violations = [];
const events = { turnQuestionsTo: { A: 0, B: 0 }, opponentTurnTo: { A: 0, B: 0 }, errors: [], ended: {}, welcomes: { A: 0, B: 0 } };
let firstTurnHandled = false;
let reconnectDone = false;
let turnsSeenByB = 0;
let doneResolve;
const done = new Promise((r) => (doneResolve = r));

function correctChoice(question) {
  const full = bank.get(question.questionId);
  const rightText = full.options[full.correct];
  return question.options.find((o) => o.text === rightText).key;
}
function wrongChoice(question) {
  const full = bank.get(question.questionId);
  const rightText = full.options[full.correct];
  return question.options.find((o) => o.text !== rightText).key;
}

function connect(client) {
  const ws = new WebSocket(`${wsBase}/api/match/${matchId}/ws?token=${client.token}`);
  client.ws = ws;
  ws.addEventListener("message", async (ev) => {
    const raw = String(ev.data);
    allRaw.push(raw);
    const m = JSON.parse(raw);
    // Contrato: a pergunta nunca traz a resposta nem a explicação.
    if (/explanation/.test(raw) || (m.type !== "answer_result" && /"correct"\s*:/.test(raw))) {
      violations.push(`${m.type}: vazou explicação/correta`);
    }
    if ((m.type === "turn_question" || m.type === "race_question") && /correctKey/.test(raw)) {
      violations.push(`${m.type}: vazou correctKey`);
    }
    const send = (obj) => ws.readyState === 1 && ws.send(JSON.stringify(obj));

    if (m.type === "welcome") events.welcomes[client.name]++;
    if (m.type === "error") events.errors.push({ by: client.name, reason: m.reason });
    if (m.type === "race_question") {
      await sleep(client.correct ? 20 : 150);
      send({ type: "race_answer", questionId: m.question.questionId, choice: client.correct ? correctChoice(m.question) : wrongChoice(m.question) });
    }
    if (m.type === "turn_question") {
      events.turnQuestionsTo[client.name]++;
      if (client.name === "B") turnsSeenByB++;
      // Teste de vez: o outro jogador tenta responder fora de turno.
      if (client.name === "A" && !firstTurnHandled) {
        firstTurnHandled = true;
        const other = client === A ? B : A;
        if (other.ws.readyState === 1) other.ws.send(JSON.stringify({ type: "answer", questionId: m.question.questionId, choice: "A" }));
        await sleep(100);
      }
      // Teste de queda: B cai na 3ª pergunta dele e volta dentro da tolerância.
      if (client.name === "B" && turnsSeenByB === 3 && !reconnectDone) {
        reconnectDone = true;
        client.ws.close();
        await sleep(1500);
        connect(client);
        return;
      }
      await sleep(30);
      const choice = client.correct ? correctChoice(m.question) : wrongChoice(m.question);
      send({ type: "answer", questionId: m.question.questionId, choice });
      if (client.name === "A" && !client.dupTested) {
        client.dupTested = true;
        await sleep(100);
        send({ type: "answer", questionId: m.question.questionId, choice }); // reenvio duplicado
      }
    }
    if (m.type === "opponent_turn") events.opponentTurnTo[client.name]++;
    if (m.type === "match_ended") {
      events.ended[client.name] = m;
      if (events.ended.A && events.ended.B) doneResolve();
    }
  });
}

connect(A);
await sleep(200);
connect(B);

const timeout = sleep(60_000).then(() => "timeout");
const outcome = await Promise.race([done.then(() => "ok"), timeout]);
check("a partida chegou ao fim", outcome === "ok");
await sleep(300);

const endA = events.ended.A;
check("o jogador que acertou tudo venceu (A)", endA?.result.winnerId === A.id && endA?.winnerNickname === `Ana${suf}`, `fim=${endA?.result.endReason}`);
check("a partida vale para o ranking", endA?.result.rankable === true && endA?.result.winnerTotalAnswerMs > 0, `tempo=${endA?.result.winnerTotalAnswerMs} ms`);
check("a pergunta da vez vai só para o jogador da vez", events.turnQuestionsTo.A > 0 && events.opponentTurnTo.B >= events.turnQuestionsTo.A - 1);
check("nenhuma mensagem vazou resposta correta ou explicação antes da hora", violations.length === 0, violations[0] ?? "");
check("resposta fora de turno rejeitada", events.errors.some((e) => e.by === "B" && e.reason === "not_your_turn"));
check("resposta duplicada rejeitada", events.errors.some((e) => e.by === "A" && e.reason === "duplicate"));
check("queda curta: B reconectou e retomou a partida", events.welcomes.B >= 2);

// ---------- 3) pós-jogo ----------
const after = await api("/api/lobby", { token: A.token });
check("ao fim, os dois voltam a ficar livres no saguão", after.data.matchId === null);

await api("/api/leave", { method: "POST", token: A.token });
await api("/api/leave", { method: "POST", token: B.token });
check("sair libera o apelido", (await api("/api/join", { method: "POST", body: { nickname: `Ana${suf}` } })).status === 200);

const falhas = results.filter((r) => !r).length;
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
console.log(`Partida: ${matchId} · mensagens trocadas: ${allRaw.length}`);
process.exit(falhas === 0 ? 0 : 1);
