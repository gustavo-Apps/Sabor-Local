// Plano destaque (Fase 3): pagamento manual registrado pelo admin estende o destaque.

import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto } from "../helpers.mjs";

const ctx = new Contexto();
let adm;
let ana;
let beto;

const DIA = 24 * 60 * 60 * 1000;
const registrar = (cliente, vendedorId, dias, valor, forma = "pix", obs = "") =>
  cliente.rpc("admin_registrar_pagamento", {
    p_vendedor: vendedorId,
    p_dias: dias,
    p_valor: valor,
    p_forma: forma,
    p_observacao: obs,
  });
const destaqueDe = async (vendedorId) => {
  const { data } = await admin.from("vendedores").select("destaque_ate").eq("id", vendedorId).single();
  return data.destaque_ate ? new Date(data.destaque_ate).getTime() : null;
};
const perto = (a, b, tolerancia = 2 * 60 * 1000) => Math.abs(a - b) <= tolerancia;

before(async () => {
  adm = await ctx.novoVendedor({ aprovado: true, ehAdmin: true });
  ana = await ctx.novoVendedor({ aprovado: true });
  beto = await ctx.novoVendedor({ aprovado: true });
});
after(() => ctx.limpar());

describe("registrar pagamento e ativar destaque", () => {
  test("30 dias a partir de agora quando não havia destaque", async () => {
    const antes = Date.now();
    const { data, error } = await registrar(adm.client, ana.vendedorId, 30, 30, "pix", "comprovante 123");
    assert.ifError(error);
    assert.ok(perto(new Date(data).getTime(), antes + 30 * DIA));
    assert.ok(perto(await destaqueDe(ana.vendedorId), antes + 30 * DIA));
  });

  test("renovar antes de vencer soma a partir do fim do período atual (não perde dias)", async () => {
    const fim1 = await destaqueDe(ana.vendedorId);
    await registrar(adm.client, ana.vendedorId, 15, 20);
    assert.ok(perto(await destaqueDe(ana.vendedorId), fim1 + 15 * DIA));
  });

  test("renovar depois de vencido conta a partir de agora", async () => {
    await admin.from("vendedores").update({ destaque_ate: new Date(Date.now() - 10 * DIA).toISOString() }).eq("id", beto.vendedorId);
    const antes = Date.now();
    await registrar(adm.client, beto.vendedorId, 7, 10);
    assert.ok(perto(await destaqueDe(beto.vendedorId), antes + 7 * DIA));
  });

  test("o pagamento fica registrado com valor, forma, dias, observação e quem registrou", async () => {
    const { data } = await admin.from("pagamentos").select("*").eq("vendedor_id", ana.vendedorId).order("created_at");
    assert.equal(data.length, 2);
    assert.equal(Number(data[0].valor), 30);
    assert.equal(data[0].forma, "pix");
    assert.equal(data[0].dias, 30);
    assert.equal(data[0].observacao, "comprovante 123");
    assert.equal(data[0].registrado_por, adm.id);
  });

  test("5 pagamentos simultâneos não perdem dias (travamento da linha)", async () => {
    const cobaia = await ctx.novoVendedor({ aprovado: true, semLogin: true });
    const antes = Date.now();
    const r = await Promise.all(Array.from({ length: 5 }, () => registrar(adm.client, cobaia.vendedorId, 7, 10)));
    assert.ok(r.every((x) => !x.error), r.find((x) => x.error)?.error?.message);
    assert.ok(perto(await destaqueDe(cobaia.vendedorId), antes + 35 * DIA), "7 dias x 5 = 35 dias");
  });

  test("cortesia: dá destaque, grava valor zero e não conta como pagante", async () => {
    const cobaia = await ctx.novoVendedor({ aprovado: true, semLogin: true });
    const antes = (await adm.client.rpc("admin_resumo")).data;
    const { error } = await registrar(adm.client, cobaia.vendedorId, 7, 0, "cortesia", "parceria");
    assert.ifError(error);
    const depois = (await adm.client.rpc("admin_resumo")).data;
    assert.equal(depois.pagantes_ativos, antes.pagantes_ativos, "cortesia não é pagante");
    assert.equal(depois.destaques_ativos, antes.destaques_ativos + 1);
    assert.equal(Number(depois.receita_30d), Number(antes.receita_30d));
  });

  test("o resumo conta pagantes ativos e a receita dos últimos 30 dias", async () => {
    const { data } = await adm.client.rpc("admin_resumo");
    assert.ok(data.pagantes_ativos >= 3, `pagantes ${data.pagantes_ativos}`); // ana, beto e a cobaia dos 5 pagamentos
    assert.ok(Number(data.receita_30d) >= 30 + 20 + 10 + 50);
  });

  test("remover destaque zera o prazo", async () => {
    const { error } = await adm.client.rpc("admin_remover_destaque", { p_vendedor: beto.vendedorId });
    assert.ifError(error);
    assert.equal(await destaqueDe(beto.vendedorId), null);
  });
});

describe("quem não é admin não mexe em destaque nem em dinheiro", () => {
  test("vendedor não registra pagamento nem para si", async () => {
    const { error } = await registrar(ana.client, ana.vendedorId, 30, 30);
    assert.match(error?.message ?? "", /sem_permissao/);
  });

  test("visitante não registra nem remove destaque", async () => {
    const v = anonimo();
    assert.ok((await registrar(v, ana.vendedorId, 30, 30)).error);
    assert.ok((await v.rpc("admin_remover_destaque", { p_vendedor: ana.vendedorId })).error);
  });

  test("vendedor não remove o destaque de ninguém", async () => {
    const { error } = await ana.client.rpc("admin_remover_destaque", { p_vendedor: ana.vendedorId });
    assert.match(error?.message ?? "", /sem_permissao/);
  });

  test("não dá para inserir, alterar nem apagar pagamentos direto na tabela", async () => {
    const ins = await ana.client.from("pagamentos").insert({
      vendedor_id: ana.vendedorId, valor: 0, forma: "cortesia", dias: 365,
      destaque_de: new Date().toISOString(), destaque_ate: new Date(Date.now() + 365 * DIA).toISOString(),
    });
    assert.ok(ins.error, "insert direto deveria ser negado");
    const upd = await ana.client.from("pagamentos").update({ valor: 0 }).eq("vendedor_id", ana.vendedorId).select();
    const del = await ana.client.from("pagamentos").delete().eq("vendedor_id", ana.vendedorId).select();
    assert.equal(upd.data?.length ?? 0, 0);
    assert.equal(del.data?.length ?? 0, 0);
  });

  test("vendedor continua sem conseguir mudar o próprio destaque_ate", async () => {
    const antes = await destaqueDe(ana.vendedorId);
    await ana.client.from("vendedores").update({ destaque_ate: "2099-01-01T00:00:00Z" }).eq("id", ana.vendedorId);
    assert.equal(await destaqueDe(ana.vendedorId), antes);
  });

  test("admin_pagamentos só responde ao admin", async () => {
    assert.match((await ana.client.rpc("admin_pagamentos")).error?.message ?? "", /sem_permissao/);
    assert.ok((await anonimo().rpc("admin_pagamentos")).error);
    const { data } = await adm.client.rpc("admin_pagamentos", { p_limite: 10 });
    assert.ok(data.length > 0 && data[0].vendedor_nome);
  });

  test("admin_pagamentos respeita o teto de 500 linhas", async () => {
    const { data } = await adm.client.rpc("admin_pagamentos", { p_limite: 1_000_000 });
    assert.ok(data.length <= 500);
  });
});

describe("privacidade do histórico financeiro", () => {
  test("o vendedor vê os próprios pagamentos, mas não os de outro", async () => {
    const meus = await ana.client.from("pagamentos").select("vendedor_id, valor");
    assert.ok(meus.data.length >= 2);
    assert.ok(meus.data.every((p) => p.vendedor_id === ana.vendedorId));
    const doOutro = await ana.client.from("pagamentos").select("*").eq("vendedor_id", beto.vendedorId);
    assert.equal(doOutro.data.length, 0);
  });

  test("visitante não vê nenhum pagamento", async () => {
    const { data, error } = await anonimo().from("pagamentos").select("*");
    assert.ok(error || data.length === 0);
  });

  test("os pagamentos entram no histórico de auditoria", async () => {
    const { data } = await admin.from("historico").select("entidade, acao").eq("vendedor_id", ana.vendedorId).eq("entidade", "pagamentos");
    assert.ok(data.length >= 2);
  });
});

describe("o banco recusa pagamento inválido", () => {
  test("dias fora de 1 a 365, valor negativo, forma inventada e cortesia com valor", async () => {
    const casos = [
      [0, 10, "pix"], [366, 10, "pix"], [-5, 10, "pix"],
      [30, -1, "pix"], [30, 100000, "pix"],
      [30, 10, "cheque"],
      [30, 5, "cortesia"],
    ];
    for (const [dias, valor, forma] of casos) {
      const { error } = await registrar(adm.client, ana.vendedorId, dias, valor, forma);
      assert.ok(error, `dias=${dias} valor=${valor} forma=${forma} deveria falhar`);
    }
  });

  test("vendedor inexistente", async () => {
    const { error } = await registrar(adm.client, "00000000-0000-0000-0000-000000000000", 7, 10);
    assert.match(error?.message ?? "", /vendedor_invalido/);
  });

  test("observação gigante é cortada em 200, não estoura", async () => {
    const { error } = await registrar(adm.client, ana.vendedorId, 1, 1, "pix", "x".repeat(5000));
    assert.ifError(error);
    const { data } = await admin.from("pagamentos").select("observacao").eq("vendedor_id", ana.vendedorId).order("created_at", { ascending: false }).limit(1).single();
    assert.equal(data.observacao.length, 200);
  });

  test("os pagamentos inválidos não deixaram sujeira nem mexeram no destaque", async () => {
    const { data } = await admin.from("pagamentos").select("forma, dias, valor").eq("vendedor_id", ana.vendedorId);
    assert.ok(data.every((p) => p.dias >= 1 && p.dias <= 365 && Number(p.valor) >= 0));
    assert.ok(!data.some((p) => p.forma === "cheque"));
  });
});
