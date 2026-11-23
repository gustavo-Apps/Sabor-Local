// Métricas sem o dono: visita e toque do vendedor logado na própria loja não contam.

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
  await admin.from("eventos").delete().in("vendedor_id", [ana.vendedorId, beto.vendedorId]);
});
after(() => ctx.limpar());

const evento = (cliente, tipo, vendedorId, extra = {}) => cliente.rpc("registrar_evento", { p_tipo: tipo, p_vendedor: vendedorId, ...extra });
const total = async (vendedorId, tipo) => {
  const { count } = await admin.from("eventos").select("id", { count: "exact", head: true }).eq("vendedor_id", vendedorId).eq("tipo", tipo);
  return count;
};

describe("o dono olhando a própria loja", () => {
  test("visita ao perfil não conta, e a chamada não dá erro", async () => {
    assert.ifError((await evento(ana.client, "visita_vendedor", ana.vendedorId)).error);
    assert.equal(await total(ana.vendedorId, "visita_vendedor"), 0);
  });

  test("toque no WhatsApp não conta", async () => {
    assert.ifError((await evento(ana.client, "whatsapp", ana.vendedorId)).error);
    assert.equal(await total(ana.vendedorId, "whatsapp"), 0);
  });

  test("com origem marcada também não conta", async () => {
    await evento(ana.client, "visita_vendedor", ana.vendedorId, { p_origem: "whatsapp" });
    assert.equal(await total(ana.vendedorId, "visita_vendedor"), 0);
  });

  test("100 chamadas seguidas do dono continuam sem contar nada", async () => {
    for (let i = 0; i < 100; i++) await evento(ana.client, "visita_vendedor", ana.vendedorId);
    assert.equal(await total(ana.vendedorId, "visita_vendedor"), 0);
  });

  test("o administrador que é dono de uma loja também não conta na própria", async () => {
    await evento(adm.client, "visita_vendedor", adm.vendedorId);
    assert.equal(await total(adm.vendedorId, "visita_vendedor"), 0);
  });
});

describe("quem é cliente continua contando", () => {
  test("visitante sem login conta", async () => {
    await evento(anonimo(), "visita_vendedor", ana.vendedorId);
    await evento(anonimo(), "whatsapp", ana.vendedorId);
    assert.equal(await total(ana.vendedorId, "visita_vendedor"), 1);
    assert.equal(await total(ana.vendedorId, "whatsapp"), 1);
  });

  test("outro vendedor logado, olhando a loja de A, conta como cliente de A", async () => {
    await evento(beto.client, "visita_vendedor", ana.vendedorId);
    await evento(beto.client, "whatsapp", ana.vendedorId);
    assert.equal(await total(ana.vendedorId, "visita_vendedor"), 1);
    assert.equal(await total(ana.vendedorId, "whatsapp"), 1);
  });

  test("um administrador olhando a loja dos outros conta (não é dono dela)", async () => {
    await evento(adm.client, "visita_vendedor", ana.vendedorId);
    assert.equal(await total(ana.vendedorId, "visita_vendedor"), 1);
  });

  test("a mesma pessoa conta na loja dos outros e não na própria", async () => {
    await evento(ana.client, "visita_vendedor", ana.vendedorId);
    await evento(ana.client, "visita_vendedor", beto.vendedorId);
    assert.equal(await total(ana.vendedorId, "visita_vendedor"), 0);
    assert.equal(await total(beto.vendedorId, "visita_vendedor"), 1);
  });

  test("a visita ao catálogo (sem loja) continua contando para quem está logado", async () => {
    const { count: antes } = await admin.from("eventos").select("id", { count: "exact", head: true }).eq("tipo", "visita_site");
    await evento(ana.client, "visita_site", null);
    const { count: depois } = await admin.from("eventos").select("id", { count: "exact", head: true }).eq("tipo", "visita_site");
    assert.equal(depois, antes + 1);
  });
});

describe("as validações continuam valendo para o dono", () => {
  test("tipo inválido e loja inexistente ainda dão erro, logado ou não", async () => {
    assert.match((await evento(ana.client, "compra", ana.vendedorId)).error?.message ?? "", /tipo_invalido/);
    assert.match((await evento(ana.client, "whatsapp", "00000000-0000-0000-0000-000000000000")).error?.message ?? "", /vendedor_invalido/);
  });
});

describe("o resumo do vendedor reflete só os clientes", () => {
  test("o dono navega à vontade e a contagem de visitas fica só com as de fora", async () => {
    for (let i = 0; i < 5; i++) await evento(ana.client, "visita_vendedor", ana.vendedorId);
    await evento(anonimo(), "visita_vendedor", ana.vendedorId);
    const { data } = await ana.client.rpc("visitas_por_origem", { p_dias: 30 });
    assert.deepEqual(data.map((r) => [r.origem, Number(r.visitas)]), [["direto", 1]]);
  });
});
