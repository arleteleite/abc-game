// Converte o xlsx de perguntas (mestre) no JSON usado pelo Worker.
// Uso (na raiz do projeto):
//   node scripts/gerar-banco.mjs            -> produção: só "Validada (gerente)"
//   node scripts/gerar-banco.mjs --dev      -> desenvolvimento: tudo, menos Reprovada/Reescrever
// Entrada:  docs/banco_perguntas_abc_to.xlsx  (aba "Perguntas")
// Saída:    apps/worker/src/data/questions.json  (não vai para o Git)
import readXlsx from "read-excel-file/node";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entrada = resolve(raiz, "docs/banco_perguntas_abc_to.xlsx");
const saida = resolve(raiz, "apps/worker/src/data/questions.json");
const modoDev = process.argv.includes("--dev");

const MIN_POR_NIVEL = 30; // PRD seção 5
const MIN_REDUZIDO = 20;

const semAcento = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

const NIVEIS = { facil: "facil", media: "media", dificil: "dificil" };
const STATUS = {
  rascunho: "Rascunho",
  "revisada (arlete)": "Revisada",
  "validada (gerente)": "Validada",
  reprovada: "Reprovada",
  reescrever: "Reescrever",
};

function texto(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

function falhar(msg) {
  console.error(`ERRO: ${msg}`);
  process.exit(1);
}

const planilhas = await readXlsx(entrada);
const aba = planilhas.find((p) => p.sheet === "Perguntas");
if (!aba) falhar('aba "Perguntas" não encontrada no xlsx');

const [cabecalho, ...linhas] = aba.data;
if (!cabecalho || texto(cabecalho[0]).toUpperCase() !== "ID") falhar("cabeçalho inesperado na aba Perguntas");

const perguntas = [];
const ids = new Set();
for (const [i, l] of linhas.entries()) {
  const id = texto(l[0]);
  if (!id) continue;
  const n = i + 2; // linha na planilha
  const nivel = NIVEIS[semAcento(texto(l[1]))];
  const status = STATUS[semAcento(texto(l[12]))];
  const correta = texto(l[8]).toUpperCase();
  if (!nivel) falhar(`${id} (linha ${n}): nível inválido "${texto(l[1])}"`);
  if (!status) falhar(`${id} (linha ${n}): status inválido "${texto(l[12])}"`);
  if (!["A", "B", "C", "D"].includes(correta)) falhar(`${id} (linha ${n}): correta inválida "${correta}"`);
  if (ids.has(id)) falhar(`${id} (linha ${n}): id duplicado`);
  ids.add(id);
  const opcoes = { A: texto(l[4]), B: texto(l[5]), C: texto(l[6]), D: texto(l[7]) };
  if (!texto(l[3]) || Object.values(opcoes).some((o) => !o)) falhar(`${id} (linha ${n}): enunciado ou alternativa vazia`);
  perguntas.push({
    id,
    difficulty: nivel,
    theme: texto(l[2]),
    statement: texto(l[3]),
    options: opcoes,
    correct: correta,
    explanation: texto(l[9]),
    source: texto(l[10]),
    alert: texto(l[11]),
    status,
  });
}

const aceitas = perguntas.filter((p) =>
  modoDev ? p.status !== "Reprovada" && p.status !== "Reescrever" : p.status === "Validada",
);

const porNivel = { facil: 0, media: 0, dificil: 0 };
for (const p of aceitas) porNivel[p.difficulty]++;

mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, JSON.stringify(aceitas, null, 1) + "\n", "utf-8");

console.log(`Modo: ${modoDev ? "DESENVOLVIMENTO (todas, menos Reprovada/Reescrever)" : "PRODUÇÃO (só Validada)"}`);
console.log(`Lidas: ${perguntas.length} · Gravadas: ${aceitas.length} -> ${saida}`);
console.log(`Por nível: fácil ${porNivel.facil} · média ${porNivel.media} · difícil ${porNivel.dificil}`);

const menor = Math.min(...Object.values(porNivel));
if (!modoDev && menor < MIN_POR_NIVEL) {
  const aviso = menor < MIN_REDUZIDO ? "ABAIXO DO MÍNIMO REDUZIDO" : "abaixo de 30 (mínimo reduzido de 20 ainda atendido)";
  console.warn(`ATENÇÃO: menor nível tem ${menor} validadas: ${aviso}.`);
  if (menor < MIN_REDUZIDO) process.exitCode = 2;
}
