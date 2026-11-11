// Teste de ponta a ponta PELA TELA: dois navegadores (tamanho de celular) entram,
// um desafia o outro, e a partida é jogada clicando nos botões de verdade.
//
// Uso (na raiz do projeto, com o site já publicado ou rodando em `wrangler dev`):
//   node scripts/ui-e2e.mjs http://127.0.0.1:8787 [pasta-das-capturas]
//
// Usa o Chrome instalado no computador (playwright-core não baixa navegador).
// Lê o banco de DESENVOLVIMENTO só para saber qual alternativa é a certa.
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const base = (process.argv[2] ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const shots = process.argv[3] ? resolve(process.argv[3]) : null;
if (shots) mkdirSync(shots, { recursive: true });

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bank = JSON.parse(readFileSync(join(raiz, "apps/worker/src/data/questions.json"), "utf-8"));
const byStatement = new Map(bank.map((q) => [q.statement, q]));

const results = [];
const check = (nome, ok, detalhe = "") => {
  results.push(ok);
  console.log(`${ok ? "PASSOU" : "FALHOU"}  ${nome}${detalhe ? "  (" + detalhe + ")" : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const ctxA = await browser.newContext(phone);
const ctxB = await browser.newContext(phone);
const a = await ctxA.newPage();
const b = await ctxB.newPage();
const consoleErrors = [];
for (const [name, page] of [["A", a], ["B", b]]) {
  page.on("pageerror", (e) => consoleErrors.push(`${name}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(`${name}: ${m.text()}`));
}
const shot = async (page, name) => shots && (await page.screenshot({ path: join(shots, `${name}.png`) }));

const suf = Date.now().toString(36).slice(-4);
const nickA = `Ana${suf}`;
const nickB = `Beto${suf}`;

// 1) Entrar
await a.goto(base);
await shot(a, "01-inicio");
await a.getByPlaceholder("Seu apelido").fill(nickA);
await a.getByRole("button", { name: "Entrar" }).click();
await b.goto(base);
await b.getByPlaceholder("Seu apelido").fill(nickB);
await b.getByRole("button", { name: "Entrar" }).click();
await a.locator(".game-button", { hasText: "Trilha ABC+" }).click();
await b.locator(".game-button", { hasText: "Trilha ABC+" }).click();
await a.getByText("2. Quem está disponível").waitFor();
check("os dois entram pelo apelido, escolhem a Trilha e chegam ao saguão", true);

// 2) Convidar
await a.getByRole("radio", { name: /Vaca/ }).click();
await a.locator(".player-row", { hasText: nickB }).getByRole("button", { name: "Desafiar" }).click({ timeout: 15000 });
await a.getByText("Convite enviado").waitFor();
await shot(a, "02-convite-enviado");
await b.getByText("Você foi desafiado!").waitFor({ timeout: 15000 });
await shot(b, "03-convite-recebido");
check("o convite aparece para o outro jogador (por consulta periódica)", true);

// 3) Aceitar com outro peão
await b.locator(".incoming").getByRole("radio", { name: /Vaca/ }).isDisabled().then((d) => check("o peão do adversário fica bloqueado para o convidado", d));
await b.locator(".incoming").getByRole("radio", { name: /Ovelha/ }).click();
await b.getByRole("button", { name: "Aceitar" }).click();
await b.getByText("Largada!").or(b.getByText("Aguardando o adversário")).first().waitFor({ timeout: 15000 });
await a.getByText("Largada!").waitFor({ timeout: 20000 });
check("os dois entram na partida e a largada começa", true);
await shot(a, "04-largada");

// 4) Jogar clicando: A sempre acerta, B sempre erra
async function answerIfQuestion(page, correct) {
  const statementLoc = page.locator(".question-statement");
  if ((await statementLoc.count()) === 0) return false;
  if ((await page.locator(".option.selected").count()) > 0) return false;
  const statement = (await statementLoc.first().innerText()).trim();
  const q = byStatement.get(statement);
  if (!q) throw new Error(`pergunta fora do banco: ${statement.slice(0, 40)}`);
  const rightText = q.options[q.correct];
  const options = page.locator(".option");
  const n = await options.count();
  for (let i = 0; i < n; i++) {
    const text = (await options.nth(i).locator(".option-text").innerText()).trim();
    if ((text === rightText) === correct) {
      await options.nth(i).click();
      return true;
    }
  }
  return false;
}

let shotBoard = false;
let sawFeedback = false;
const deadline = Date.now() + 90_000;
while (Date.now() < deadline) {
  if ((await a.getByText("Voltar ao saguão").count()) > 0 && (await b.getByText("Voltar ao saguão").count()) > 0) break;
  await answerIfQuestion(a, true);
  await answerIfQuestion(b, false);
  if (!shotBoard && (await a.locator(".board").count()) > 0) {
    shotBoard = true;
    await sleep(300);
    await shot(a, "05-tabuleiro-minha-vez");
    await shot(b, "06-tabuleiro-vez-do-adversario");
  }
  if (!sawFeedback && (await a.locator(".banner.good, .banner.bad").count()) > 0) {
    sawFeedback = true;
    await shot(a, "07-acertou");
  }
  await sleep(150);
}

check("a partida terminou nas duas telas", (await a.getByText("Voltar ao saguão").count()) > 0 && (await b.getByText("Voltar ao saguão").count()) > 0);
await shot(a, "08-fim-vencedor");
await shot(b, "09-fim-perdedor");
check("a tela do vencedor diz 'Você venceu!'", (await a.getByText("Você venceu!").count()) > 0);
check("a tela do outro jogador mostra quem venceu", (await b.getByText(`${nickA} venceu`).count()) > 0);
check("o aviso de acerto apareceu durante a partida", sawFeedback);

// 5) Voltar ao saguão
await a.getByRole("button", { name: "Voltar ao saguão" }).click();
await a.getByText("2. Quem está disponível").waitFor({ timeout: 10000 });
check("voltar ao saguão funciona e o jogador está livre de novo", true);

check("nenhum erro no console dos navegadores", consoleErrors.length === 0, consoleErrors[0] ?? "");

await browser.close();
const falhas = results.filter((r) => !r).length;
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
