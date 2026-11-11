// Teste de ponta a ponta do QUIZ pela tela (navegador com tamanho de celular).
// Uso (na raiz do projeto): node scripts/ui-e2e-quiz.mjs http://127.0.0.1:8787 [pasta-das-capturas]
// Joga as 10 perguntas clicando: acerta 7, erra 2 e deixa 1 estourar o tempo (leva ~16 s a mais).
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

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = async (name) => shots && (await page.screenshot({ path: join(shots, `${name}.png`) }));

const nick = `Quiz${Date.now().toString(36).slice(-5)}`;
await page.goto(base);
await page.getByPlaceholder("Seu apelido").fill(nick);
await page.getByRole("button", { name: "Entrar" }).click();
await page.getByText("Escolha o jogo").waitFor();
await shot("q1-menu");
check("depois de entrar aparece o menu com os dois jogos", (await page.locator(".game-button").count()) === 2);

await page.locator(".game-button", { hasText: "Quiz ABC+" }).click();
await page.getByText("Pergunta 1 de 10").waitFor({ timeout: 15000 });
await shot("q2-pergunta");
check("o Quiz começa na pergunta 1 de 10", true);

let sawCorrectNotice = false;
let sawWrongNotice = false;
let sawTimeout = false;
for (let i = 0; i < 10; i++) {
  await page.getByText(`Pergunta ${i + 1} de 10`).waitFor({ timeout: 25000 });
  const statement = (await page.locator(".question-statement").innerText()).trim();
  const q = bank.get(statement);
  if (!q) throw new Error(`pergunta fora do banco: ${statement.slice(0, 40)}`);
  const rightText = q.options[q.correct];
  const options = page.locator(".option");
  if (i === 4) {
    // deixa o tempo estourar sem responder
    await page.getByText("Tempo esgotado.").waitFor({ timeout: 25000 });
    sawTimeout = true;
    await shot("q3-tempo-esgotado");
    continue;
  }
  const wantRight = !(i === 2 || i === 6);
  const n = await options.count();
  for (let k = 0; k < n; k++) {
    const text = (await options.nth(k).locator(".option-text").innerText()).trim();
    if ((text === rightText) === wantRight) {
      await options.nth(k).click();
      break;
    }
  }
  // O aviso chega com a resposta do servidor: espera (a Cloudflare leva algumas centenas de ms).
  if (i === 2) {
    sawWrongNotice = await page.locator(".banner.bad").waitFor({ timeout: 5000 }).then(() => true, () => false);
    sawWrongNotice = sawWrongNotice && (await page.getByText("Resposta certa:").count()) > 0;
    await shot("q4-errou");
  }
  if (i === 1) sawCorrectNotice = await page.locator(".banner.good").waitFor({ timeout: 5000 }).then(() => true, () => false);
}
check("acertar mostra o aviso 'Acertou!' sobre a próxima pergunta", sawCorrectNotice);
check("errar mostra a resposta certa", sawWrongNotice);
check("deixar o tempo acabar avança sozinho com 'Tempo esgotado.'", sawTimeout);

await page.getByText("Quiz concluído!").waitFor({ timeout: 30000 });
await shot("q5-resultado");
const body = await page.locator("main").innerText();
check("o resultado mostra 7 de 10 acertos", /7 de 10/.test(body), body.match(/\d+ de 10/)?.[0] ?? "");
check("o resultado mostra a posição no ranking", /º lugar/.test(body));

await page.getByRole("button", { name: "Jogar de novo" }).click();
await page.getByText("Pergunta 1 de 10").waitFor({ timeout: 15000 });
check("'Jogar de novo' recomeça um Quiz novo", true);
page.once("dialog", (d) => d.accept());
await page.getByRole("button", { name: "Sair" }).click();
await page.getByText("Escolha o jogo").waitFor();
check("sair do Quiz volta ao menu", true);

check("nenhum erro no console", errors.length === 0, errors[0] ?? "");
await browser.close();
const falhas = results.filter((r) => !r).length;
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
