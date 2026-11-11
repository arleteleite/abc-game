// Teste pela tela do convite por link (etapa 9): três navegadores com tamanho de celular.
// Uso (na raiz): node scripts/ui-e2e-link.mjs http://127.0.0.1:8787 [pasta-das-capturas]
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
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const errors = [];
const open = async () => {
  const page = await (await browser.newContext(phone)).newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return page;
};
const shot = async (page, name) => shots && (await page.screenshot({ path: join(shots, `${name}.png`) }));

const suf = Date.now().toString(36).slice(-4);
const [a, b, c] = [await open(), await open(), await open()];

// A entra, escolhe o peão e gera o link
await a.goto(base);
await a.getByPlaceholder("Seu apelido").fill(`Ana${suf}`);
await a.getByRole("button", { name: "Entrar" }).click();
await a.locator(".game-button", { hasText: "Trilha ABC+" }).click();
await a.getByRole("radio", { name: /Vaca/ }).click();
await a.getByRole("button", { name: "Gerar link de convite" }).click();
await a.getByText("Link de convite pronto").waitFor();
await shot(a, "l1-link-pronto");
const link = await a.getByLabel("Link do convite").inputValue();
check("o link de convite é gerado e mostrado na tela", /\/\?convite=[\w-]{20,}/.test(link), link.replace(base, ""));

const wa = await a.getByRole("link", { name: "Enviar pelo WhatsApp" }).getAttribute("href");
check("o botão do WhatsApp abre wa.me com a mensagem e o link, sem número de telefone", wa.startsWith("https://wa.me/?text=") && decodeURIComponent(wa).includes(link));

// B abre o link SEM ter conta: vê o aviso, entra com apelido e cai direto no convite
await b.goto(link);
await b.getByText("Você foi desafiado(a)").waitFor();
await shot(b, "l2-abriu-o-link");
check("quem abre o link sem conta é recebido com o aviso de desafio", true);
check("o endereço do convite some da barra (não fica para reaproveitar)", !new URL(b.url()).search.includes("convite"));
await b.getByPlaceholder("Seu apelido").fill(`Beto${suf}`);
await b.getByRole("button", { name: "Entrar" }).click();
await b.getByText(`Ana${suf}`).first().waitFor();
await shot(b, "l3-convite");
check("depois de entrar, o convite mostra quem convidou", (await b.getByText("te desafiou para jogar com o peão").count()) === 1);
check("o peão de quem convidou fica bloqueado", await b.getByRole("radio", { name: /Vaca/ }).isDisabled());

// C abre o mesmo link ao mesmo tempo
await c.goto(link);
await c.getByPlaceholder("Seu apelido").fill(`Cris${suf}`);
await c.getByRole("button", { name: "Entrar" }).click();
await c.getByText(`Ana${suf}`).first().waitFor();

// B aceita primeiro
await b.getByRole("radio", { name: /Ovelha/ }).click();
await b.getByRole("button", { name: "Aceitar o desafio" }).click();
await b.getByText("Largada!").or(b.getByText("Aguardando o adversário")).first().waitFor({ timeout: 15000 });
await a.getByText("Largada!").waitFor({ timeout: 20000 });
check("o primeiro a aceitar entra na partida e quem convidou é levado a ela", true);

// C tenta depois: convite já usado
await c.getByRole("radio", { name: /Milho/ }).click();
await c.getByRole("button", { name: "Aceitar o desafio" }).click();
await c.getByText("Este convite já foi usado ou cancelado.").waitFor({ timeout: 10000 });
await shot(c, "l4-ja-usado");
check("uso único: o segundo a aceitar vê que o convite já foi usado", true);

// recarregar com o link antigo (já usado) mostra a mesma mensagem, sem erro
await c.goto(link);
await c.getByText("Este convite já foi usado ou cancelado.").waitFor({ timeout: 15000 });
check("abrir o link de novo depois de usado só mostra o aviso", true);

check("nenhum erro inesperado no console", errors.filter((e) => !/409|Conflict/i.test(e)).length === 0, errors.find((e) => !/409|Conflict/i.test(e)) ?? "");
await browser.close();
const falhas = results.filter((r) => !r).length;
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
