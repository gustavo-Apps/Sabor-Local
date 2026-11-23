// Itens em destaque: "Destaque da casa" (escolha do vendedor, até 3) e "Mais pedido" (toques em "Pedir este item").

import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, zerarLimites } from "../helpers.mjs";

const ctx = new Contexto();
let ana;
let beto;
let itensAna = [];
let itemBeto;

// No ambiente local o IP vem do gateway (não dá para simular pessoas diferentes por cabeçalho). Por isso:
//  * `tocar` passa pela função de verdade (e todas as chamadas parecem da mesma pessoa);
//  * `tocarVezes` grava toques de "pessoas diferentes" direto na tabela, para testar o ranking.
const tocar = (cliente, vendedorId, itemId) =>
  cliente.rpc("registrar_evento", { p_tipo: "pedir_item", p_vendedor: vendedorId, p_item: itemId });
const tocarVezes = async (vendedorId, itemId, vezes, primeiro = 1) => {
  const linhas = Array.from({ length: vezes }, (_, i) => ({
    tipo: "pedir_item",
    vendedor_id: vendedorId,
    item_id: itemId,
    ip_hash: `teste-${primeiro + i}`,
  }));
  assert.ifError((await admin.from("eventos").insert(linhas)).error);
};
const ranking = async (vendedorId) => (await anonimo().rpc("itens_mais_pedidos", { p_vendedor: vendedorId })).data.map((r) => r.item_id);
const marcar = (cliente, id, destaque) => cliente.from("itens_cardapio").update({ destaque }).eq("id", id).select("id, destaque");

before(async () => {
  ana = await ctx.novoVendedor({ aprovado: true });
  beto = await ctx.novoVendedor({ aprovado: true });
  const { data } = await admin
    .from("itens_cardapio")
    .insert(["Pastel", "Coxinha", "Suco", "Bolo", "Café"].map((nome, ordem) => ({ vendedor_id: ana.vendedorId, nome, ordem })))
    .select("id, nome");
  itensAna = data;
  const { data: b } = await admin.from("itens_cardapio").insert({ vendedor_id: beto.vendedorId, nome: "Hambúrguer" }).select("id").single();
  itemBeto = b.id;
});
beforeEach(async () => {
  await zerarLimites();
  await admin.from("eventos").delete().in("vendedor_id", [ana.vendedorId, beto.vendedorId]);
  await admin.from("itens_cardapio").update({ destaque: false }).in("vendedor_id", [ana.vendedorId, beto.vendedorId]);
  await admin.from("vendedores").update({ ativo: true }).in("id", [ana.vendedorId, beto.vendedorId]);
});
after(() => ctx.limpar());

describe("Destaque da casa (escolha do vendedor)", () => {
  test("o dono marca até 3 itens", async () => {
    for (const i of itensAna.slice(0, 3)) {
      const { data, error } = await marcar(ana.client, i.id, true);
      assert.ifError(error);
      assert.equal(data[0].destaque, true);
    }
  });

  test("o 4º é recusado pelo banco e desmarcar libera a vaga", async () => {
    for (const i of itensAna.slice(0, 3)) await marcar(ana.client, i.id, true);
    const quarto = await marcar(ana.client, itensAna[3].id, true);
    assert.equal(quarto.error?.code, "23514");
    assert.match(quarto.error?.message ?? "", /limite_destaques/);
    assert.ifError((await marcar(ana.client, itensAna[0].id, false)).error);
    assert.ifError((await marcar(ana.client, itensAna[3].id, true)).error);
  });

  test("o limite é por loja: a outra loja ainda marca os dela", async () => {
    for (const i of itensAna.slice(0, 3)) await marcar(ana.client, i.id, true);
    assert.ifError((await marcar(beto.client, itemBeto, true)).error);
  });

  test("outro vendedor e visitante não marcam item alheio", async () => {
    for (const cliente of [beto.client, anonimo()]) {
      const { data } = await marcar(cliente, itensAna[0].id, true);
      assert.equal(data?.length ?? 0, 0);
    }
    const { data } = await admin.from("itens_cardapio").select("destaque").eq("id", itensAna[0].id).single();
    assert.equal(data.destaque, false);
  });

  test("o perfil público enxerga quem é destaque", async () => {
    await marcar(ana.client, itensAna[1].id, true);
    const { data } = await anonimo().from("itens_cardapio").select("id, destaque").eq("vendedor_id", ana.vendedorId).eq("destaque", true);
    assert.deepEqual(data.map((i) => i.id), [itensAna[1].id]);
  });
});

describe("toque em Pedir este item", () => {
  test("grava o toque com o item", async () => {
    assert.ifError((await tocar(anonimo(), ana.vendedorId, itensAna[0].id)).error);
    const { data } = await admin.from("eventos").select("tipo, item_id, vendedor_id").eq("vendedor_id", ana.vendedorId);
    assert.deepEqual(data, [{ tipo: "pedir_item", item_id: itensAna[0].id, vendedor_id: ana.vendedorId }]);
  });

  test("item de outra loja ou inexistente é recusado", async () => {
    assert.match((await tocar(anonimo(), ana.vendedorId, itemBeto)).error?.message ?? "", /item_invalido/);
    assert.match((await tocar(anonimo(), ana.vendedorId, "00000000-0000-0000-0000-000000000000")).error?.message ?? "", /item_invalido/);
    assert.match((await tocar(anonimo(), ana.vendedorId, null)).error?.message ?? "", /item_invalido/);
  });

  test("o dono logado tocando na própria loja não conta", async () => {
    assert.ifError((await tocar(ana.client, ana.vendedorId, itensAna[0].id)).error);
    const { data } = await admin.from("eventos").select("id").eq("vendedor_id", ana.vendedorId);
    assert.equal(data.length, 0);
  });

  test("a mesma pessoa tocando de novo no mesmo item conta uma vez por hora", async () => {
    const mesmo = anonimo();
    for (let i = 0; i < 4; i++) assert.ifError((await tocar(mesmo, ana.vendedorId, itensAna[0].id)).error);
    assert.ifError((await tocar(mesmo, ana.vendedorId, itensAna[1].id)).error); // outro item conta
    const { data } = await admin.from("eventos").select("item_id").eq("vendedor_id", ana.vendedorId);
    assert.equal(data.length, 2);
  });

  test("os tipos antigos continuam como antes", async () => {
    assert.ifError((await anonimo().rpc("registrar_evento", { p_tipo: "whatsapp", p_vendedor: ana.vendedorId })).error);
    assert.ifError((await anonimo().rpc("registrar_evento", { p_tipo: "visita_vendedor", p_vendedor: ana.vendedorId, p_origem: "qr" })).error);
    const { data } = await admin.from("eventos").select("tipo, item_id").eq("vendedor_id", ana.vendedorId).order("id");
    assert.deepEqual(data, [{ tipo: "whatsapp", item_id: null }, { tipo: "visita_vendedor", item_id: null }]);
  });

  test("apagar o item apaga os toques dele", async () => {
    const { data: tmp } = await admin.from("itens_cardapio").insert({ vendedor_id: ana.vendedorId, nome: "Temporário" }).select("id").single();
    await tocar(anonimo(), ana.vendedorId, tmp.id);
    await admin.from("itens_cardapio").delete().eq("id", tmp.id);
    const { data } = await admin.from("eventos").select("id").eq("item_id", tmp.id);
    assert.equal(data.length, 0);
  });
});

describe("Mais pedido (ranking por dados)", () => {
  test("com menos de 5 toques, ninguém é 'mais pedido'", async () => {
    await tocarVezes(ana.vendedorId, itensAna[0].id, 4);
    assert.deepEqual(await ranking(ana.vendedorId), []);
  });

  test("a partir de 5 toques de pessoas diferentes, o item entra, na ordem do volume", async () => {
    await tocarVezes(ana.vendedorId, itensAna[0].id, 5, 1);
    await tocarVezes(ana.vendedorId, itensAna[1].id, 8, 20);
    await tocarVezes(ana.vendedorId, itensAna[2].id, 3, 40);
    assert.deepEqual(await ranking(ana.vendedorId), [itensAna[1].id, itensAna[0].id]);
  });

  test("toques repetidos da mesma pessoa não inflam o ranking", async () => {
    const mesmo = anonimo();
    for (let i = 0; i < 30; i++) await tocar(mesmo, ana.vendedorId, itensAna[0].id);
    assert.deepEqual(await ranking(ana.vendedorId), []);
  });

  test("só conta os últimos 30 dias", async () => {
    await tocarVezes(ana.vendedorId, itensAna[0].id, 5);
    await admin.from("eventos").update({ created_at: new Date(Date.now() - 31 * 86400000).toISOString() }).eq("item_id", itensAna[0].id);
    assert.deepEqual(await ranking(ana.vendedorId), []);
  });

  test("o ranking público não devolve números, só os itens", async () => {
    await tocarVezes(ana.vendedorId, itensAna[0].id, 5);
    const { data } = await anonimo().rpc("itens_mais_pedidos", { p_vendedor: ana.vendedorId });
    assert.deepEqual(Object.keys(data[0]), ["item_id"]);
  });

  test("loja suspensa não aparece no ranking", async () => {
    await tocarVezes(ana.vendedorId, itensAna[0].id, 5);
    await admin.from("vendedores").update({ ativo: false }).eq("id", ana.vendedorId);
    assert.deepEqual(await ranking(ana.vendedorId), []);
  });
});

describe("relatório do vendedor", () => {
  test("o dono vê os itens mais tocados, com o número de toques", async () => {
    await tocarVezes(ana.vendedorId, itensAna[0].id, 3, 1);
    await tocarVezes(ana.vendedorId, itensAna[1].id, 5, 20);
    const { data, error } = await ana.client.rpc("meus_itens_tocados", { p_dias: 30 });
    assert.ifError(error);
    assert.deepEqual(data.map((r) => [r.nome, Number(r.toques)]), [["Coxinha", 5], ["Pastel", 3]]);
  });

  test("cada vendedor vê só os dele; visitante não chama", async () => {
    await tocarVezes(ana.vendedorId, itensAna[0].id, 2);
    const { data } = await beto.client.rpc("meus_itens_tocados", {});
    assert.equal(data.length, 0);
    assert.ok((await anonimo().rpc("meus_itens_tocados", {})).error);
  });

  test("não lê os eventos de outra loja direto na tabela", async () => {
    await tocarVezes(ana.vendedorId, itensAna[0].id, 2);
    const { data } = await beto.client.from("eventos").select("id").eq("vendedor_id", ana.vendedorId);
    assert.equal(data?.length ?? 0, 0);
  });
});
