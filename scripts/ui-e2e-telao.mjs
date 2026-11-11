// Teste pela tela do ranking e do telão (etapa 8).
// Uso (na raiz): node scripts/ui-e2e-telao.mjs http://127.0.0.1:8787 [pasta-das-capturas]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const base = (process.argv[2] ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const shots = process.argv[3] ? resolve(process.argv[3]) : null;
if (shots) mkdirSync(shots, { recursive: true });
const results = [];
const check = (nome, ok, detalhe = "") => {
  results.push(ok);
  console.log(`${ok ? "PASSOU" : "FALHOU"}  ${nome}${detalhe ? "  (" + detalhe + ")" : ""}`);
};

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const errors = [];
const watch = (page) => {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
};

// ---- telão em tela grande ----
const tv = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
watch(tv);
await tv.goto(`${base}/telao`);
await tv.getByText("Atualizado às").waitFor({ timeout: 15000 });
if (shots) await tv.screenshot({ path: join(shots, "t1-telao-1920.png") });
check("o telão abre sem login e mostra os dois rankings", (await tv.getByRole("heading", { name: "Quiz ABC+" }).count()) === 1 && (await tv.getByRole("heading", { name: "Trilha ABC+" }).count()) === 1);
check("o telão não tem botões nem campos (só leitura)", (await tv.locator("button, input, a").count()) === 0);
check("o rodapé com o crédito aparece discretamente", (await tv.getByText("Desenvolvido por Arlete Leite Lima").count()) === 1);
const before = await tv.locator(".telao-status").innerText();
await tv.waitForTimeout(12_500);
const after = await tv.locator(".telao-status").innerText();
check("o telão atualiza sozinho (horário de atualização muda)", before !== after, `${before} -> ${after}`);

// ---- o mesmo endereço no celular (telão caiu) ----
const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
watch(phone);
await phone.goto(`${base}/telao`);
await phone.getByText("Atualizado às").waitFor({ timeout: 15000 });
if (shots) await phone.screenshot({ path: join(shots, "t2-telao-celular.png") });
const overflow = await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
check("no celular a página do telão cabe na tela, sem rolagem lateral", !overflow);

// ---- ranking dentro do app ----
const app = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
watch(app);
await app.goto(base);
await app.getByPlaceholder("Seu apelido").fill(`Tela${Date.now().toString(36).slice(-4)}`);
await app.getByRole("button", { name: "Entrar" }).click();
await app.getByRole("button", { name: "Ver ranking" }).click();
await app.getByRole("heading", { name: "Ranking" }).waitFor();
await app.getByRole("heading", { name: "Quiz ABC+" }).waitFor({ timeout: 15000 });
if (shots) await app.screenshot({ path: join(shots, "t3-ranking-no-app.png") });
check("o ranking abre pelo menu do app, com os dois jogos", (await app.getByRole("heading", { name: "Trilha ABC+" }).count()) === 1);
check("o crédito também aparece nas telas do app", (await app.getByText("Desenvolvido por Arlete Leite Lima").count()) === 1);
await app.getByRole("button", { name: "Voltar" }).click();
await app.getByText("Escolha o jogo").waitFor();
check("voltar leva ao menu", true);

check("nenhum erro no console", errors.length === 0, errors[0] ?? "");
await browser.close();
const falhas = results.filter((r) => !r).length;
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
