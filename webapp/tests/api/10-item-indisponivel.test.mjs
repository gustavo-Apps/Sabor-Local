// "Indisponível hoje": colunas, regra do banco e quem pode mudar a disponibilidade.

import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto } from "../helpers.mjs";

const ctx = new Contexto();
let ana;
let beto;
let itemId;

before(async () => {
  ana = await ctx.novoVendedor({ aprovado: true });
  beto = await ctx.novoVendedor({ aprovado: true });
  const { data, error } = await admin
    .from("itens_cardapio")
    .insert({ vendedor_id: ana.vendedorId, nome: "Pizza grande", preco: 50 })
    .select("id")
    .single();
  assert.ifError(error);
  itemId = data.id;
});
after(() => ctx.limpar());

const ler = async () => (await admin.from("itens_cardapio").select("disponivel, indisponivel_ate").eq("id", itemId).single()).data;

describe("dono muda a disponibilidade", () => {
  test("item novo nasce disponível e sem data", async () => {
    assert.deepEqual(await ler(), { disponivel: true, indisponivel_ate: null });
  });

  test("indisponível só hoje: guarda a data", async () => {
    const { error } = await ana.client.from("itens_cardapio").update({ disponivel: false, indisponivel_ate: "2031-10-06" }).eq("id", itemId);
    assert.ifError(error);
    assert.deepEqual(await ler(), { disponivel: false, indisponivel_ate: "2031-10-06" });
  });

  test("sem previsão: indisponível e sem data", async () => {
    const { error } = await ana.client.from("itens_cardapio").update({ disponivel: false, indisponivel_ate: null }).eq("id", itemId);
    assert.ifError(error);
    assert.deepEqual(await ler(), { disponivel: false, indisponivel_ate: null });
  });

  test("voltar a ter: disponível e sem data", async () => {
    await ana.client.from("itens_cardapio").update({ disponivel: false, indisponivel_ate: "2031-10-06" }).eq("id", itemId);
    const { error } = await ana.client.from("itens_cardapio").update({ disponivel: true, indisponivel_ate: null }).eq("id", itemId);
    assert.ifError(error);
    assert.deepEqual(await ler(), { disponivel: true, indisponivel_ate: null });
  });
});

describe("regra do banco", () => {
  test("data com o item disponível é recusada (23514)", async () => {
    const { error } = await ana.client.from("itens_cardapio").update({ disponivel: true, indisponivel_ate: "2031-10-06" }).eq("id", itemId);
    assert.equal(error?.code, "23514");
  });

  test("data inexistente é recusada", async () => {
    const { error } = await admin.from("itens_cardapio").update({ disponivel: false, indisponivel_ate: "2031-02-31" }).eq("id", itemId);
    assert.ok(error);
  });

  test("criar já indisponível com data funciona; disponível com data não", async () => {
    const ok = await ana.client.from("itens_cardapio").insert({ vendedor_id: ana.vendedorId, nome: "Acabou", disponivel: false, indisponivel_ate: "2031-10-06" });
    assert.ifError(ok.error);
    const ruim = await ana.client.from("itens_cardapio").insert({ vendedor_id: ana.vendedorId, nome: "Incoerente", disponivel: true, indisponivel_ate: "2031-10-06" });
    assert.equal(ruim.error?.code, "23514");
  });
});

describe("quem pode mexer", () => {
  test("outro vendedor não muda a disponibilidade do item alheio (0 linhas)", async () => {
    const { data } = await beto.client.from("itens_cardapio").update({ disponivel: false }).eq("id", itemId).select();
    assert.equal(data?.length ?? 0, 0);
    assert.equal((await ler()).disponivel, true);
  });

  test("visitante também não", async () => {
    const { data } = await anonimo().from("itens_cardapio").update({ disponivel: false }).eq("id", itemId).select();
    assert.equal(data?.length ?? 0, 0);
  });

  test("o cliente enxerga o item indisponível e a data (o perfil mostra o selo)", async () => {
    await ana.client.from("itens_cardapio").update({ disponivel: false, indisponivel_ate: "2031-10-06" }).eq("id", itemId);
    const { data } = await anonimo().from("itens_cardapio").select("nome, disponivel, indisponivel_ate").eq("id", itemId).single();
    assert.deepEqual(data, { nome: "Pizza grande", disponivel: false, indisponivel_ate: "2031-10-06" });
  });
});
