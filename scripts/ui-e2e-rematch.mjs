// Teste pela tela da REVANCHE (etapa 10): dois navegadores com tamanho de celular.
// Uso (na raiz): node scripts/ui-e2e-rematch.mjs http://127.0.0.1:8787 [pasta-das-capturas]
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const base = (process.argv[2] ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const shots = process.argv[3] ? resolve(process.argv[3]) : null;
if (shots) mkdirSync(shots, { recursive: true });
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bank = new Map(JSON.parse(readFileSync(join(raiz, "apps/worker/src/data/questions.json"), "utf-8")).map((q) => [q.statement, q]));

const results = [];
const check = (nome, ok, detalhe = "") => {
  results.push(ok);
  console.log(`${ok ? "PASSOU" : "FALHOU"}  ${nome}${detalhe ? "  (" + detalhe + ")" : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const errors = [];
const open = async () => {
  const page = await (await browser.newContext(phone)).newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return page;
};
const shot = async (page, name) => shots && (await page.screenshot({ path: join(shots, `${name}.png`) }));

async function answerIfQuestion(page, correct) {
  try {
    const loc = page.locator(".question-statement");
    if ((await loc.count()) === 0 || (await page.locator(".option.selected").count()) > 0) return;
    const q = bank.get((await loc.first().innerText({ timeout: 2000 })).trim());
    if (!q) return;
    const rightText = q.options[q.correct];
    const options = page.locator(".option");
    for (let k = 0; k < (await options.count()); k++) {
      if (((await options.nth(k).locator(".option-text").innerText({ timeout: 2000 })).trim() === rightText) === correct) {
        await options.nth(k).click({ timeout: 2000 });
        return;
      }
    }
  } catch {
    // a pergunta mudou enquanto líamos: tenta de novo no próximo ciclo
  }
}

async function playUntilEnd(a, b) {
  const limit = Date.now() + 90_000;
  while (Date.now() < limit) {
    if ((await a.getByText("Novo adversário").count()) > 0 && (await b.getByText("Novo adversário").count()) > 0) return true;
    await answerIfQuestion(a, true);
    await answerIfQuestion(b, false);
    await sleep(150);
  }
  return false;
}

const suf = Date.now().toString(36).slice(-4);
const [a, b] = [await open(), await open()];
for (const [page, nick] of [[a, `Ana${suf}`], [b, `Beto${suf}`]]) {
  await page.goto(base);
  await page.getByPlaceholder("Seu apelido").fill(nick);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.locator(".game-button", { hasText: "Trilha ABC+" }).click();
}
await a.getByText("2. Quem está disponível").waitFor();
await b.getByText("2. Quem está disponível").waitFor();
await a.getByRole("radio", { name: /Vaca/ }).click();
await a.locator(".player-row", { hasText: `Beto${suf}` }).getByRole("button", { name: "Desafiar" }).click({ timeout: 15000 });
await b.getByText("Você foi desafiado!").waitFor({ timeout: 15000 });
await b.locator(".incoming").getByRole("radio", { name: /Ovelha/ }).click();
await b.getByRole("button", { name: "Aceitar" }).click();

check("a primeira partida é jogada até o fim pela tela", await playUntilEnd(a, b));
await shot(a, "r1-fim-com-revanche");
check("o vencedor vê o botão de revanche com o nome do adversário", (await a.getByRole("button", { name: `Revanche com Beto${suf}` }).count()) === 1);
check("o perdedor também vê o botão e o aviso de que a primeira vale para o ranking", (await b.getByRole("button", { name: `Revanche com Ana${suf}` }).count()) === 1 && (await b.getByText("A partida vale para o ranking.").count()) === 1);
check("existe a opção de novo adversário", (await a.getByRole("button", { name: /Novo adversário/ }).count()) === 1);

// B pede, A aceita
await b.getByRole("button", { name: `Revanche com Ana${suf}` }).click();
await b.getByText("Aguardando", { exact: false }).waitFor({ timeout: 10000 });
check("quem pede vê que está aguardando o outro aceitar", true);
await a.getByText(`Beto${suf} quer a revanche!`).waitFor({ timeout: 10000 });
await shot(a, "r2-pedido-recebido");
check("o adversário vê o pedido com os botões Aceitar e Recusar", (await a.getByRole("button", { name: "Aceitar revanche" }).count()) === 1 && (await a.getByRole("button", { name: "Recusar" }).count()) === 1);
await a.getByRole("button", { name: "Aceitar revanche" }).click();

await a.getByText("Largada!").waitFor({ timeout: 20000 });
await b.getByText("Largada!").waitFor({ timeout: 20000 });
check("os dois entram na partida nova (largada) sem passar pelo saguão", true);
check("com os mesmos peões e adversário", (await a.locator(".score", { hasText: `Beto${suf}` }).count()) === 1 && (await b.locator(".score", { hasText: `Ana${suf}` }).count()) === 1);

check("a revanche também é jogada até o fim", await playUntilEnd(a, b));
await shot(a, "r3-fim-da-revanche");
check("o resultado da revanche avisa que ela não entra no ranking", (await a.getByText("Esta partida (revanche) não entra no ranking.").count()) === 1);

// B escolhe novo adversário
await a.getByRole("button", { name: `Revanche com Beto${suf}` }).click();
await b.getByText(`Ana${suf} quer a revanche!`).waitFor({ timeout: 10000 });
await b.getByRole("button", { name: "Recusar" }).click();
await a.getByText("A revanche foi recusada.").waitFor({ timeout: 10000 });
await shot(a, "r4-recusada");
check("recusar a revanche avisa o outro jogador", true);
await b.getByRole("button", { name: /Novo adversário/ }).click();
await b.getByText("2. Quem está disponível").waitFor({ timeout: 10000 });
check("'Novo adversário' leva ao saguão para convidar outra pessoa", true);

check("nenhum erro inesperado no console", errors.filter((e) => !/409|Conflict/i.test(e)).length === 0, errors.find((e) => !/409|Conflict/i.test(e)) ?? "");
await browser.close();
const falhas = results.filter((r) => !r).length;
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
