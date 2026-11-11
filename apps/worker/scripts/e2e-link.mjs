// Teste de ponta a ponta do convite por link (etapa 9) contra o servidor.
// Uso (na pasta apps/worker): npm run e2e:link -- http://127.0.0.1:8787
const base = (process.argv[2] ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const results = [];
const check = (nome, ok, detalhe = "") => {
  results.push(ok);
  console.log(`${ok ? "PASSOU" : "FALHOU"}  ${nome}${detalhe ? "  (" + detalhe + ")" : ""}`);
};

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

const suf = Date.now().toString(36).slice(-4);
const join = async (nick) => (await api("/api/join", { method: "POST", body: { nickname: nick } })).data;
const ana = await join(`Ana${suf}`);
const beto = await join(`Beto${suf}`);
const cris = await join(`Cris${suf}`);

const link = await api("/api/invitations/link", { method: "POST", token: ana.token, body: { pawn: "vaca" } });
check("quem convida gera um link (convite sem destinatário)", link.status === 200 && link.data.toPlayerId === null && !!link.data.id);
check("o identificador do convite é imprevisível (UUID)", /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(link.data.id));
check("peão inválido é recusado", (await api("/api/invitations/link", { method: "POST", token: ana.token, body: { pawn: "dragao" } })).status === 400);
check("sem token não gera link", (await api("/api/invitations/link", { method: "POST", body: { pawn: "vaca" } })).status === 401);

// o link anterior foi cancelado pelo novo; usar o novo
const link2 = await api("/api/invitations/link", { method: "POST", token: ana.token, body: { pawn: "vaca" } });
check("um novo link cancela o anterior", (await api(`/api/invitations/${link.data.id}`, { token: beto.token })).data.state === "canceled");
const id = link2.data.id;

check("o link não aparece como convite recebido de ninguém", (await api("/api/lobby", { token: beto.token })).data.incoming.length === 0);
check("quem abre o link sem estar logado não vê o convite", (await api(`/api/invitations/${id}`)).status === 401);
const info = await api(`/api/invitations/${id}`, { token: beto.token });
check("quem abriu o link vê quem convidou e com qual peão", info.status === 200 && info.data.fromNickname === `Ana${suf}` && info.data.fromPawn === "vaca" && info.data.state === "created");
check("convite inexistente devolve 404", (await api("/api/invitations/nao-existe-123", { token: beto.token })).status === 404);

check("o próprio convidante não pode aceitar o link", (await api(`/api/invitations/${id}/accept`, { method: "POST", token: ana.token, body: { pawn: "ovelha" } })).status === 409);
check("não deixa usar o mesmo peão de quem convidou", (await api(`/api/invitations/${id}/accept`, { method: "POST", token: beto.token, body: { pawn: "vaca" } })).status === 409);

const accepted = await api(`/api/invitations/${id}/accept`, { method: "POST", token: beto.token, body: { pawn: "ovelha" } });
check("o primeiro a aceitar cria a partida (sem ter passado pelo saguão)", accepted.status === 200 && !!accepted.data.matchId);
check("o convidante enxerga a partida no saguão", (await api("/api/lobby", { token: ana.token })).data.matchId === accepted.data.matchId);

const second = await api(`/api/invitations/${id}/accept`, { method: "POST", token: cris.token, body: { pawn: "milho" } });
check("uso único: o segundo a abrir o link é rejeitado", second.status === 409 && second.data.error === "not_available", second.data?.error);
check("o convite aparece como usado", (await api(`/api/invitations/${id}`, { token: cris.token })).data.state === "accepted");

const falhas = results.filter((r) => !r).length;
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
