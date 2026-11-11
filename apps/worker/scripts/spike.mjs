// Teste automático do spike (etapa 2).
// Uso: node scripts/spike.mjs <url-base>   (ex.: http://127.0.0.1:8787)
// Verifica: turnos entre dois jogadores, rejeição fora de turno, reconexão
// pelo identificador, 20 conexões simultâneas e latência de ida e volta.
// Usa o WebSocket nativo do Node (>= 22).

const base = (process.argv[2] ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const wsBase = base.replace(/^http/, "ws");
const room = `auto-${Date.now()}`;
const results = [];

function check(nome, ok, detalhe = "") {
  results.push({ nome, ok });
  console.log(`${ok ? "PASSOU" : "FALHOU"}  ${nome}${detalhe ? "  (" + detalhe + ")" : ""}`);
}

function open(roomName) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsBase}/ws/${roomName}`);
    ws.inbox = [];
    ws.waiters = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      const w = ws.waiters.findIndex((x) => x.pred(m));
      if (w >= 0) ws.waiters.splice(w, 1)[0].resolve(m);
      else ws.inbox.push(m);
    };
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error("falha ao conectar"));
  });
}

function next(ws, pred, ms = 5000) {
  const i = ws.inbox.findIndex(pred);
  if (i >= 0) return Promise.resolve(ws.inbox.splice(i, 1)[0]);
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("tempo esgotado esperando mensagem")), ms);
    ws.waiters.push({ pred, resolve: (m) => { clearTimeout(t); resolve(m); } });
  });
}

const send = (ws, obj) => ws.send(JSON.stringify(obj));
const quantil = (arr, q) => [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * q))];

async function main() {
  // 1) Turnos entre dois jogadores
  const a = await open(room);
  const b = await open(room);
  send(a, { type: "join", playerId: "A" });
  await next(a, (m) => m.type === "joined");
  send(b, { type: "join", playerId: "B" });
  await next(b, (m) => m.type === "joined");

  send(b, { type: "move" }); // B tenta jogar fora de turno (a vez é de A)
  const erro = await next(b, (m) => m.type === "error");
  check("jogada fora de turno é rejeitada", erro.reason === "fora_de_turno", erro.reason);

  let alternou = true;
  for (let i = 0; i < 10; i++) {
    const jogador = i % 2 === 0 ? a : b;
    send(jogador, { type: "move" });
    const st = await next(a, (m) => m.type === "state" && m.game.moves === i + 1);
    const esperado = i % 2 === 0 ? 1 : 0;
    if (st.game.turn !== esperado) alternou = false;
  }
  check("10 jogadas alternando a vez entre dois jogadores", alternou);

  // 2) Reconexão pelo identificador: A cai e volta; o estado deve continuar
  a.close();
  await new Promise((r) => setTimeout(r, 300));
  const a2 = await open(room);
  send(a2, { type: "join", playerId: "A" });
  const j = await next(a2, (m) => m.type === "joined");
  check("reconexão retoma a mesma partida pelo identificador", j.game.moves === 10 && j.game.players[0] === "A", `jogadas=${j.game.moves}`);

  // 3) 20 conexões simultâneas + latência
  const salaCarga = `carga-${Date.now()}`;
  const conexoes = await Promise.all(Array.from({ length: 20 }, () => open(salaCarga)));
  conexoes.forEach((ws, i) => send(ws, { type: "join", playerId: `c${i}` }));
  await new Promise((r) => setTimeout(r, 500));
  const stats = await (await fetch(`${base}/stats/${salaCarga}`)).json();
  check("20 conexões simultâneas na mesma sala", stats.connections === 20, `conexões=${stats.connections}`);

  const lats = [];
  for (let rodada = 0; rodada < 10; rodada++) {
    await Promise.all(
      conexoes.map(async (ws) => {
        const t = Date.now();
        send(ws, { type: "ping", t });
        await next(ws, (m) => m.type === "pong" && m.t === t);
        lats.push(Date.now() - t);
      }),
    );
  }
  const media = lats.reduce((s, v) => s + v, 0) / lats.length;
  check("pings respondidos por todas as 20 conexões", lats.length === 200, `${lats.length}/200`);
  console.log(`LATÊNCIA (do computador até o servidor e volta): média ${media.toFixed(0)} ms · p95 ${quantil(lats, 0.95)} ms · máx ${Math.max(...lats)} ms`);

  [a2, b, ...conexoes].forEach((ws) => ws.close());

  const falhas = results.filter((r) => !r.ok).length;
  console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
