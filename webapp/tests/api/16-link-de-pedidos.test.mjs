// Link de pedidos próprio: regras do banco, quem pode mexer, o evento de toque e o que sai no arquivo de dados.

import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, zerarLimites } from "../helpers.mjs";

const ctx = new Contexto();
let ana;
let beto;
let adm;

before(async () => {
  ana = await ctx.novoVendedor({ aprovado: true });
  beto = await ctx.novoVendedor({ aprovado: true });
  adm = await ctx.novoVendedor({ aprovado: true, ehAdmin: true });
});
beforeEach(async () => {
  await zerarLimites();
  await admin.from("vendedores").update({ link_pedido_url: null, link_pedido_rotulo: null }).in("id", [ana.vendedorId, beto.vendedorId]);
  await admin.from("eventos").delete().in("vendedor_id", [ana.vendedorId, beto.vendedorId]);
});
after(() => ctx.limpar());

const definir = (cliente, vendedorId, campos) => cliente.from("vendedores").update(campos).eq("id", vendedorId).select("link_pedido_url, link_pedido_rotulo");
const lerLink = async (vendedorId) => (await admin.from("vendedores").select("link_pedido_url, link_pedido_rotulo").eq("id", vendedorId).single()).data;

describe("o dono define o link", () => {
  test("endereço e texto do botão são guardados", async () => {
    const { error } = await definir(ana.client, ana.vendedorId, { link_pedido_url: "https://meusite.com.br/cardapio", link_pedido_rotulo: "Pedir no site" });
    assert.ifError(error);
    assert.deepEqual(await lerLink(ana.vendedorId), { link_pedido_url: "https://meusite.com.br/cardapio", link_pedido_rotulo: "Pedir no site" });
  });

  test("só o endereço (sem texto) também vale", async () => {
    assert.ifError((await definir(ana.client, ana.vendedorId, { link_pedido_url: "http://pedidos.exemplo.com.br/loja?mesa=1#topo" })).error);
  });

  test("apagar o link (nulo nos dois campos) funciona", async () => {
    await definir(ana.client, ana.vendedorId, { link_pedido_url: "https://meusite.com.br", link_pedido_rotulo: "Site" });
    assert.ifError((await definir(ana.client, ana.vendedorId, { link_pedido_url: null, link_pedido_rotulo: null })).error);
    assert.deepEqual(await lerLink(ana.vendedorId), { link_pedido_url: null, link_pedido_rotulo: null });
  });
});

describe("regras do banco (última barreira, mesmo sem passar pelo formulário)", () => {
  const recusados = [
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["ftp:", "ftp://meusite.com.br/arquivo"],
    ["sem esquema", "meusite.com.br/cardapio"],
    ["esquema relativo", "//meusite.com.br"],
    ["usuário e senha", "https://usuario:senha@meusite.com.br"],
    ["só usuário", "https://usuario@meusite.com.br"],
    ["com espaço", "https://meusite.com.br/a b"],
    ["sem domínio", "https://localhost"],
    ["vazio", ""],
    ["acima de 300 caracteres", `https://meusite.com.br/${"a".repeat(300)}`],
  ];
  for (const [nome, url] of recusados) {
    test(`recusa: ${nome}`, async () => {
      const { error } = await definir(ana.client, ana.vendedorId, { link_pedido_url: url });
      assert.equal(error?.code, "23514", url.slice(0, 40));
      assert.equal((await lerLink(ana.vendedorId)).link_pedido_url, null);
    });
  }

  test("texto do botão: de 1 a 30 caracteres", async () => {
    const base = { link_pedido_url: "https://meusite.com.br" };
    assert.ifError((await definir(ana.client, ana.vendedorId, { ...base, link_pedido_rotulo: "a".repeat(30) })).error);
    assert.equal((await definir(ana.client, ana.vendedorId, { ...base, link_pedido_rotulo: "a".repeat(31) })).error?.code, "23514");
    assert.equal((await definir(ana.client, ana.vendedorId, { ...base, link_pedido_rotulo: "" })).error?.code, "23514");
  });

  test("texto do botão sem link não existe (os dois andam juntos)", async () => {
    const { error } = await definir(ana.client, ana.vendedorId, { link_pedido_url: null, link_pedido_rotulo: "Solto" });
    assert.equal(error?.code, "23514");
  });
});

describe("quem pode mexer", () => {
  test("outro vendedor não muda o link da loja alheia (0 linhas)", async () => {
    const { data } = await definir(beto.client, ana.vendedorId, { link_pedido_url: "https://golpe.com.br" });
    assert.equal(data?.length ?? 0, 0);
    assert.equal((await lerLink(ana.vendedorId)).link_pedido_url, null);
  });

  test("visitante também não", async () => {
    const { data } = await definir(anonimo(), ana.vendedorId, { link_pedido_url: "https://golpe.com.br" });
    assert.equal(data?.length ?? 0, 0);
  });

  test("o administrador remove o link de qualquer loja", async () => {
    await admin.from("vendedores").update({ link_pedido_url: "https://suspeito.com.br", link_pedido_rotulo: "Compre aqui" }).eq("id", ana.vendedorId);
    const { data, error } = await definir(adm.client, ana.vendedorId, { link_pedido_url: null, link_pedido_rotulo: null });
    assert.ifError(error);
    assert.equal(data.length, 1);
    assert.deepEqual(await lerLink(ana.vendedorId), { link_pedido_url: null, link_pedido_rotulo: null });
  });

  test("a remoção pelo admin fica no histórico de alterações", async () => {
    await admin.from("vendedores").update({ link_pedido_url: "https://suspeito.com.br" }).eq("id", ana.vendedorId);
    const antes = (await admin.from("historico").select("id", { count: "exact", head: true }).eq("vendedor_id", ana.vendedorId)).count;
    await definir(adm.client, ana.vendedorId, { link_pedido_url: null, link_pedido_rotulo: null });
    const depois = (await admin.from("historico").select("id", { count: "exact", head: true }).eq("vendedor_id", ana.vendedorId)).count;
    assert.ok(depois > antes, "a alteração deveria ter sido registrada");
  });

  test("o cliente enxerga o link do perfil público", async () => {
    await admin.from("vendedores").update({ link_pedido_url: "https://meusite.com.br", link_pedido_rotulo: "Site" }).eq("id", ana.vendedorId);
    const { data } = await anonimo().from("vendedores").select("link_pedido_url, link_pedido_rotulo").eq("id", ana.vendedorId).single();
    assert.deepEqual(data, { link_pedido_url: "https://meusite.com.br", link_pedido_rotulo: "Site" });
  });
});

describe("toque no link de pedidos (evento link_pedido)", () => {
  const toque = (cliente, vendedorId) => cliente.rpc("registrar_evento", { p_tipo: "link_pedido", p_vendedor: vendedorId });
  const total = async (vendedorId) =>
    (await admin.from("eventos").select("id", { count: "exact", head: true }).eq("vendedor_id", vendedorId).eq("tipo", "link_pedido")).count;

  test("visitante e outro vendedor contam", async () => {
    assert.ifError((await toque(anonimo(), ana.vendedorId)).error);
    assert.ifError((await toque(beto.client, ana.vendedorId)).error);
    assert.equal(await total(ana.vendedorId), 2);
  });

  test("o dono tocando no próprio link não conta", async () => {
    assert.ifError((await toque(ana.client, ana.vendedorId)).error);
    assert.equal(await total(ana.vendedorId), 0);
  });

  test("loja inexistente dá erro, e visita ao catálogo continua sem loja", async () => {
    assert.match((await toque(anonimo(), "00000000-0000-0000-0000-000000000000")).error?.message ?? "", /vendedor_invalido/);
    assert.match((await anonimo().rpc("registrar_evento", { p_tipo: "link_pedido", p_vendedor: null })).error?.message ?? "", /vendedor_invalido/);
  });

  test("o banco só aceita os tipos conhecidos", async () => {
    const { error } = await admin.from("eventos").insert({ tipo: "compra", vendedor_id: ana.vendedorId });
    assert.equal(error?.code, "23514");
  });

  test("o toque não entra na conta do WhatsApp", async () => {
    await toque(anonimo(), ana.vendedorId);
    const { count } = await admin.from("eventos").select("id", { count: "exact", head: true }).eq("vendedor_id", ana.vendedorId).eq("tipo", "whatsapp");
    assert.equal(count, 0);
  });
});

describe("arquivo de dados e exclusão", () => {
  test("o arquivo 'Baixar meus dados' traz o link e o texto do botão", async () => {
    await admin.from("vendedores").update({ link_pedido_url: "https://meusite.com.br", link_pedido_rotulo: "Site" }).eq("id", ana.vendedorId);
    const { data } = await ana.client.rpc("exportar_meus_dados");
    assert.equal(data.perfil.link_pedido_url, "https://meusite.com.br");
    assert.equal(data.perfil.link_pedido_rotulo, "Site");
  });

  test("excluir a loja leva o link junto (nada fica para trás)", async () => {
    const extra = await ctx.novoVendedor({ aprovado: true });
    await admin.from("vendedores").update({ link_pedido_url: "https://temporario.com.br" }).eq("id", extra.vendedorId);
    await admin.from("vendedores").delete().eq("id", extra.vendedorId);
    const { data } = await admin.from("vendedores").select("id").eq("link_pedido_url", "https://temporario.com.br");
    assert.equal(data.length, 0);
  });
});
