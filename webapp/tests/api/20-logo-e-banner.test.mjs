// Logo e banner: só endereço do nosso Storage, só o dono troca, e o Storage isola a pasta de cada vendedor.

import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, cfg, Contexto } from "../helpers.mjs";

const ctx = new Contexto();
let ana;
let beto;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const urlPublica = (caminho) => `${cfg.url}/storage/v1/object/public/cardapios/${caminho}`;

before(async () => {
  ana = await ctx.novoVendedor({ aprovado: true });
  beto = await ctx.novoVendedor({ aprovado: true });
});
after(() => ctx.limpar());

describe("endereço da imagem", () => {
  test("o dono grava endereço do nosso Storage na própria loja", async () => {
    const url = urlPublica(`${ana.id}/logo-1.jpg`);
    const { error } = await ana.client.from("vendedores").update({ logo_url: url, banner_url: url }).eq("id", ana.vendedorId);
    assert.ifError(error);
    const { data } = await anonimo().from("vendedores").select("logo_url, banner_url").eq("id", ana.vendedorId).single();
    assert.equal(data.logo_url, url);
    assert.equal(data.banner_url, url);
  });

  test("endereço de fora (rastreador, site qualquer) é recusado pelo banco", async () => {
    for (const coluna of ["logo_url", "banner_url"]) {
      for (const url of ["https://exemplo.com/logo.jpg", "javascript:alert(1)", "http://127.0.0.1/storage/v1/object/public/outro/x.jpg"]) {
        const { error } = await ana.client.from("vendedores").update({ [coluna]: url }).eq("id", ana.vendedorId);
        assert.ok(error, `${coluna}: ${url}`);
      }
    }
  });

  test("endereço enorme é recusado", async () => {
    const url = urlPublica(`${ana.id}/${"a".repeat(600)}.jpg`);
    const { error } = await ana.client.from("vendedores").update({ logo_url: url }).eq("id", ana.vendedorId);
    assert.ok(error);
  });

  test("dá para remover (voltar a null)", async () => {
    const { error } = await ana.client.from("vendedores").update({ logo_url: null, banner_url: null }).eq("id", ana.vendedorId);
    assert.ifError(error);
  });

  test("outro vendedor não troca a imagem da loja alheia", async () => {
    const url = urlPublica(`${beto.id}/logo-1.jpg`);
    await beto.client.from("vendedores").update({ logo_url: url }).eq("id", ana.vendedorId);
    const { data } = await admin.from("vendedores").select("logo_url").eq("id", ana.vendedorId).single();
    assert.equal(data.logo_url, null);
  });

  test("visitante não grava", async () => {
    const url = urlPublica(`${ana.id}/logo-1.jpg`);
    await anonimo().from("vendedores").update({ logo_url: url }).eq("id", ana.vendedorId);
    const { data } = await admin.from("vendedores").select("logo_url").eq("id", ana.vendedorId).single();
    assert.equal(data.logo_url, null);
  });
});

describe("arquivos no Storage", () => {
  test("o vendedor envia para a própria pasta e apaga o arquivo antigo", async () => {
    const caminho = `${ana.id}/logo-teste.png`;
    const envio = await ana.client.storage.from("cardapios").upload(caminho, PNG, { contentType: "image/png" });
    assert.ifError(envio.error);
    const baixar = await fetch(urlPublica(caminho));
    assert.equal(baixar.status, 200);
    const apagar = await ana.client.storage.from("cardapios").remove([caminho]);
    assert.ifError(apagar.error);
    assert.equal(apagar.data.length, 1);
  });

  test("não envia para a pasta de outro vendedor", async () => {
    const { error } = await ana.client.storage.from("cardapios").upload(`${beto.id}/invasao.png`, PNG, { contentType: "image/png" });
    assert.ok(error);
  });

  test("visitante não envia", async () => {
    const { error } = await anonimo().storage.from("cardapios").upload(`${ana.id}/anon.png`, PNG, { contentType: "image/png" });
    assert.ok(error);
  });

  test("não apaga arquivo de outro vendedor", async () => {
    const caminho = `${beto.id}/logo-do-beto.png`;
    await admin.storage.from("cardapios").upload(caminho, PNG, { contentType: "image/png" });
    const { data } = await ana.client.storage.from("cardapios").remove([caminho]);
    assert.equal(data?.length ?? 0, 0, "nada removido");
    assert.equal((await fetch(urlPublica(caminho))).status, 200);
    await admin.storage.from("cardapios").remove([caminho]);
  });

  test("o bucket só aceita imagens e PDF (SVG com script não entra)", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const { error } = await ana.client.storage.from("cardapios").upload(`${ana.id}/x.svg`, svg, { contentType: "image/svg+xml" });
    assert.ok(error);
  });
});
