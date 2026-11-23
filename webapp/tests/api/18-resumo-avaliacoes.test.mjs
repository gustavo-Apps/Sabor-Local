// Nota média e total na vitrine: só contam avaliações aprovadas, e a view não vaza comentário.

import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, sufixo } from "../helpers.mjs";

const ctx = new Contexto();
let ana;
let beto;

const avaliacao = (vendedorId, nota, aprovada) => ({
  vendedor_id: vendedorId,
  nota,
  comentario: "Segredo do comentário",
  aprovada,
  codigo_verificacao: `resumo-${sufixo()}`,
});

before(async () => {
  ana = await ctx.novoVendedor({ aprovado: true });
  beto = await ctx.novoVendedor({ aprovado: true });
  const { error } = await admin.from("avaliacoes").insert([
    avaliacao(ana.vendedorId, 5, true),
    avaliacao(ana.vendedorId, 4, true),
    avaliacao(ana.vendedorId, 1, false), // pendente: não entra na conta
    avaliacao(beto.vendedorId, 2, false), // só pendente: loja não aparece na view
  ]);
  assert.ifError(error);
});
after(async () => {
  await admin.from("avaliacoes").delete().in("vendedor_id", [ana.vendedorId, beto.vendedorId]);
  await ctx.limpar();
});

describe("avaliacoes_resumo", () => {
  test("visitante vê média e total só das aprovadas", async () => {
    const { data, error } = await anonimo().from("avaliacoes_resumo").select("media, total").eq("vendedor_id", ana.vendedorId);
    assert.ifError(error);
    assert.equal(data.length, 1);
    assert.equal(Number(data[0].media), 4.5);
    assert.equal(data[0].total, 2);
  });

  test("loja só com avaliação pendente não aparece", async () => {
    const { data } = await anonimo().from("avaliacoes_resumo").select("*").eq("vendedor_id", beto.vendedorId);
    assert.equal(data.length, 0);
  });

  test("a view não expõe comentário nem o código de verificação", async () => {
    const { error } = await anonimo().from("avaliacoes_resumo").select("comentario").limit(1);
    assert.ok(error, "coluna comentario não existe na view");
    const { data } = await anonimo().from("avaliacoes_resumo").select("*").eq("vendedor_id", ana.vendedorId);
    assert.deepEqual(Object.keys(data[0]).sort(), ["media", "total", "vendedor_id"]);
  });

  test("visitante não grava na view", async () => {
    const { error } = await anonimo().from("avaliacoes_resumo").insert({ vendedor_id: ana.vendedorId, media: 5, total: 99 });
    assert.ok(error);
  });
});
