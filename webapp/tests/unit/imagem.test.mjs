// Logo e banner: recorte centralizado, arquivos aceitos e caminho no Storage (sem navegador, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { calcularRecorte, caminhoNoBucket, erroDoArquivo, erroDoRecorte, IMAGENS } from "../../src/lib/imagem.ts";

describe("calcularRecorte", () => {
  test("logo (quadrada) de foto horizontal: corta as laterais, no centro", () => {
    assert.deepEqual(calcularRecorte(4000, 3000, "logo"), { x: 500, y: 0, largura: 3000, altura: 3000 });
  });
  test("logo de foto vertical: corta em cima e embaixo", () => {
    assert.deepEqual(calcularRecorte(3000, 4000, "logo"), { x: 0, y: 500, largura: 3000, altura: 3000 });
  });
  test("imagem que já é quadrada não perde nada", () => {
    assert.deepEqual(calcularRecorte(800, 800, "logo"), { x: 0, y: 0, largura: 800, altura: 800 });
  });
  test("banner (3:1) de foto 4:3: usa a largura toda e corta a altura", () => {
    assert.deepEqual(calcularRecorte(4000, 3000, "banner"), { x: 0, y: 833, largura: 4000, altura: 1333 });
  });
  test("banner de imagem já bem larga: corta as laterais", () => {
    const r = calcularRecorte(3000, 500, "banner");
    assert.deepEqual(r, { x: 750, y: 0, largura: 1500, altura: 500 });
  });
  test("o recorte sempre cabe na imagem e mantém a proporção do destino", () => {
    for (const [w, h] of [[1000, 1000], [3000, 1000], [1000, 3000], [4032, 3024], [1920, 1080], [500, 2000]]) {
      for (const tipo of ["logo", "banner"]) {
        const r = calcularRecorte(w, h, tipo);
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.largura <= w + 1 && r.y + r.altura <= h + 1, `${w}x${h} ${tipo}`);
        const alvo = IMAGENS[tipo].largura / IMAGENS[tipo].altura;
        assert.ok(Math.abs(r.largura / r.altura - alvo) < 0.02 * alvo + 1 / r.altura, `${w}x${h} ${tipo}`);
      }
    }
  });
});

describe("tamanhos mínimos", () => {
  test("imagens minúsculas nunca geram recorte de altura zero", () => {
    const r = calcularRecorte(1, 1, "banner");
    assert.ok(r.largura >= 1 && r.altura >= 1);
  });
  test("logo: recusa quando a parte aproveitada tem menos de 200 px", () => {
    assert.match(erroDoRecorte(calcularRecorte(150, 150, "logo"), "logo"), /pequena demais para o logo/);
    assert.equal(erroDoRecorte(calcularRecorte(200, 900, "logo"), "logo"), null);
  });
  test("banner: pede pelo menos 600 px de largura", () => {
    assert.match(erroDoRecorte(calcularRecorte(500, 400, "banner"), "banner"), /pequena demais para o banner/);
    assert.equal(erroDoRecorte(calcularRecorte(1200, 800, "banner"), "banner"), null);
  });
});

describe("erroDoArquivo", () => {
  test("aceita JPG, PNG e WebP", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) assert.equal(erroDoArquivo({ type, size: 1000 }), null);
  });
  test("recusa o que não é foto (PDF, GIF animado, SVG)", () => {
    for (const type of ["application/pdf", "image/gif", "image/svg+xml", "text/html", ""]) {
      assert.match(erroDoArquivo({ type, size: 1000 }), /JPG, PNG ou WebP/);
    }
  });
  test("recusa acima de 15 MB", () => {
    assert.equal(erroDoArquivo({ type: "image/jpeg", size: 15 * 1024 * 1024 }), null);
    assert.match(erroDoArquivo({ type: "image/jpeg", size: 15 * 1024 * 1024 + 1 }), /15 MB/);
  });
});

describe("caminhoNoBucket", () => {
  const base = "http://127.0.0.1:54321/storage/v1/object/public/cardapios";
  test("extrai a pasta do dono e o arquivo", () => {
    assert.equal(caminhoNoBucket(`${base}/abc-123/logo-1.jpg`), "abc-123/logo-1.jpg");
  });
  test("ignora o ?v= do final", () => {
    assert.equal(caminhoNoBucket(`${base}/abc/logo.jpg?v=99`), "abc/logo.jpg");
  });
  test("endereço de fora ou vazio não vira caminho (nunca apagamos nada que não é nosso)", () => {
    for (const u of ["https://exemplo.com/logo.jpg", "", null, undefined, `${base}/`]) assert.equal(caminhoNoBucket(u), null);
  });
});
