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

// Joga a Trilha e tira capturas do tabuleiro a cada ~2,5 s (as duas telas).
let n = 0;
const limit = Date.now() + 80_000;
let last = 0;
while (Date.now() < limit) {
  if ((await a.getByText("Novo adversário").count()) > 0) break;
  await answerIfQuestion(a, true);
  await answerIfQuestion(b, false);
  if (Date.now() - last > 2500 && (await a.locator(".trail").count()) > 0) {
    last = Date.now();
    n++;
    await shot(a, `t${String(n).padStart(2, "0")}-a`);
    await shot(b, `t${String(n).padStart(2, "0")}-b`);
  }
  await sleep(150);
}
await sleep(500);
await shot(a, "fim-a");
await shot(b, "fim-b");
console.log("capturas:", n, "erros:", errors.slice(0, 3));
await browser.close();
