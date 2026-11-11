// Converte as imagens originais (PNG grandes) em WebP leves para o 4G.
// Uso (na raiz do projeto):  node scripts/converter-imagens.mjs
// Entrada: imagens-originais/*.png   Saída: apps/web/public/img/*.webp
// Metas do PRD: cenas <= 300 KB (~1100 px de largura); peões e ícones <= 150 KB (~256 px).
import sharp from "sharp";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entrada = join(raiz, "imagens-originais");
const saida = join(raiz, "apps/web/public/img");
mkdirSync(saida, { recursive: true });

const regra = (nome) =>
  nome.startsWith("cena-fazenda") || nome === "mapa-tocantins"
    ? { largura: nome === "mapa-tocantins" ? 600 : 1100, limiteKb: nome === "mapa-tocantins" ? 150 : 300 }
    : { largura: 256, limiteKb: 150 };

let falhas = 0;
for (const arquivo of readdirSync(entrada).filter((f) => f.toLowerCase().endsWith(".png"))) {
  const { name } = parse(arquivo);
  const { largura, limiteKb } = regra(name);
  const destino = join(saida, `${name}.webp`);

  // Começa com boa qualidade e baixa até caber no limite.
  let qualidade = 85;
  let tamanhoKb = Infinity;
  while (qualidade >= 40) {
    await sharp(join(entrada, arquivo))
      .resize({ width: largura, withoutEnlargement: true })
      .webp({ quality: qualidade, alphaQuality: 90 })
      .toFile(destino);
    tamanhoKb = statSync(destino).size / 1024;
    if (tamanhoKb <= limiteKb) break;
    qualidade -= 5;
  }
  const meta = await sharp(destino).metadata();
  const origKb = statSync(join(entrada, arquivo)).size / 1024;
  const ok = tamanhoKb <= limiteKb;
  if (!ok) falhas++;
  console.log(
    `${ok ? "OK    " : "GRANDE"} ${name}.webp  ${meta.width}x${meta.height}  q${qualidade}  ${tamanhoKb.toFixed(0)} KB (limite ${limiteKb}; original ${origKb.toFixed(0)} KB)`,
  );
}
process.exit(falhas === 0 ? 0 : 1);
