// Fluxos de negócio expostos como RPC: avaliação com código, denúncia, métricas.

import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, zerarLimites } from "../helpers.mjs";

const ctx = new Contexto();
let ana;
let beto;

before(async () => {
  ana = await ctx.novoVendedor({ aprovado: true });
  beto = await ctx.novoVendedor({ aprovado: true });
});
beforeEach(() => zerarLimites());
after(() => ctx.limpar());

const avaliar = (cliente, vendedorId, codigo, extra = {}) =>
  cliente.rpc("enviar_avaliacao", { p_vendedor: vendedorId, p_nota: 5, p_comentario: "Muito bom", p_codigo: codigo, ...extra });

// Códigos antigos: o vendedor não gera mais (a avaliação agora é por convite); o admin ainda pode criar para suporte.
async function novoCodigo(dono, codigo, extra = {}) {
  const { error } = await admin.from("codigos_pedido").insert({ vendedor_id: dono.vendedorId, codigo, ...extra });
  assert.ifError(error);
}

describe("avaliação com código de compra", () => {
  test("código válido publica a avaliação (pendente de moderação) e queima o código", async () => {
    await novoCodigo(ana, "OK2345");
    const { data } = await avaliar(anonimo(), ana.vendedorId, "ok2345"); // minúsculas e espaço também valem
    assert.equal(data, "ok");
    const { data: av } = await admin.from("avaliacoes").select("aprovada, codigo_verificacao").eq("vendedor_id", ana.vendedorId).eq("codigo_verificacao", "OK2345").single();
    assert.equal(av.aprovada, false, "nasce pendente");
    const { data: cod } = await admin.from("codigos_pedido").select("usado_em").eq("codigo", "OK2345").single();
    assert.ok(cod.usado_em);
  });

  test("aceita espaços ao redor do código", async () => {
    await novoCodigo(ana, "SP2345");
    assert.equal((await avaliar(anonimo(), ana.vendedorId, "  sp2345  ")).data, "ok");
  });

  test("reutilizar o código devolve 'codigo_usado'", async () => {
    await novoCodigo(ana, "US2345");
    await avaliar(anonimo(), ana.vendedorId, "US2345");
    assert.equal((await avaliar(anonimo(), ana.vendedorId, "US2345")).data, "codigo_usado");
  });

  test("código expirado devolve 'codigo_expirado'", async () => {
    await novoCodigo(ana, "EX2345", { expira_em: new Date(Date.now() - 1000).toISOString() });
    assert.equal((await avaliar(anonimo(), ana.vendedorId, "EX2345")).data, "codigo_expirado");
  });

  test("código de OUTRO vendedor não vale", async () => {
    await novoCodigo(beto, "BE2345");
    assert.equal((await avaliar(anonimo(), ana.vendedorId, "BE2345")).data, "codigo_invalido");
  });

  test("código inexistente, vazio ou gigante devolvem 'codigo_invalido'", async () => {
    for (const c of ["ZZZZZZ", "", "   ", "a".repeat(5000)]) {
      assert.equal((await avaliar(anonimo(), ana.vendedorId, c)).data, "codigo_invalido", JSON.stringify(c.slice(0, 10)));
    }
  });

  test("injeção SQL no código é tratada como texto", async () => {
    for (const c of ["' OR '1'='1", "'; DROP TABLE codigos_pedido;--", "%", "_"]) {
      assert.equal((await avaliar(anonimo(), ana.vendedorId, c)).data, "codigo_invalido");
    }
    const { error } = await admin.from("codigos_pedido").select("id").limit(1);
    assert.ifError(error);
  });

  test("duas pessoas usando o MESMO código ao mesmo tempo: só uma passa", async () => {
    await novoCodigo(ana, "RC2345");
    const resultados = await Promise.all(Array.from({ length: 10 }, () => avaliar(anonimo(), ana.vendedorId, "RC2345")));
    const ok = resultados.filter((r) => r.data === "ok").length;
    assert.equal(ok, 1, `esperava 1 sucesso, houve ${ok}`);
  });

  test("não dá para inserir avaliação direto sem passar pelo código", async () => {
    const { error } = await anonimo().from("avaliacoes").insert({ vendedor_id: ana.vendedorId, nota: 5, codigo_verificacao: "FRAUDE" });
    assert.ok(error);
  });
});

describe("métricas", () => {
  test("registra os três tipos de evento", async () => {
    const c = anonimo();
    assert.ifError((await c.rpc("registrar_evento", { p_tipo: "visita_site", p_vendedor: null })).error);
    assert.ifError((await c.rpc("registrar_evento", { p_tipo: "visita_vendedor", p_vendedor: ana.vendedorId })).error);
    assert.ifError((await c.rpc("registrar_evento", { p_tipo: "whatsapp", p_vendedor: ana.vendedorId })).error);
  });

  test("tipo inventado e vendedor inexistente são recusados", async () => {
    const c = anonimo();
    assert.match((await c.rpc("registrar_evento", { p_tipo: "compra", p_vendedor: null })).error?.message ?? "", /tipo_invalido/);
    assert.match((await c.rpc("registrar_evento", { p_tipo: "whatsapp", p_vendedor: "00000000-0000-0000-0000-000000000000" })).error?.message ?? "", /vendedor_invalido/);
    assert.match((await c.rpc("registrar_evento", { p_tipo: "whatsapp", p_vendedor: null })).error?.message ?? "", /vendedor_invalido/);
  });

  test("o vendedor vê as próprias métricas e não as do vizinho", async () => {
    await anonimo().rpc("registrar_evento", { p_tipo: "whatsapp", p_vendedor: ana.vendedorId });
    const minhas = await ana.client.from("eventos").select("id").eq("vendedor_id", ana.vendedorId);
    const dele = await ana.client.from("eventos").select("id").eq("vendedor_id", beto.vendedorId);
    assert.ok(minhas.data.length >= 1);
    assert.equal(dele.data.length, 0);
  });
});

describe("denúncias", () => {
  const denunciar = (c, extra = {}) =>
    c.rpc("enviar_denuncia", { p_vendedor: ana.vendedorId, p_avaliacao: null, p_motivo: "golpe", p_descricao: "teste", p_contato: null, ...extra });

  test("visitante denuncia vendedor", async () => assert.ifError((await denunciar(anonimo())).error));

  test("denúncia de avaliação exige que a avaliação seja DAQUELE vendedor", async () => {
    const { data: av } = await admin.from("avaliacoes").insert({ vendedor_id: beto.vendedorId, nota: 1, codigo_verificacao: "DN2345", aprovada: true }).select("id").single();
    const { error } = await denunciar(anonimo(), { p_avaliacao: av.id });
    assert.match(error?.message ?? "", /avaliacao_invalida/);
  });

  test("a denúncia chega ao admin e some do vendedor denunciado (ele não a vê)", async () => {
    await denunciar(anonimo(), { p_descricao: "visível ao admin" });
    const { data: dele } = await ana.client.from("denuncias").select("*");
    assert.equal(dele.length, 0, "o denunciado não pode ver quem o denunciou");
    const { data: todas } = await admin.from("denuncias").select("descricao").eq("vendedor_id", ana.vendedorId);
    assert.ok(todas.some((d) => d.descricao === "visível ao admin"));
  });
});

describe("histórico (auditoria)", () => {
  test("alterar o perfil e o menu gera registros com o autor", async () => {
    await ana.client.from("vendedores").update({ descricao: "mudou" }).eq("id", ana.vendedorId);
    const { data: item } = await ana.client.from("itens_cardapio").insert({ vendedor_id: ana.vendedorId, nome: "Auditado" }).select("id").single();
    await ana.client.from("itens_cardapio").delete().eq("id", item.id);

    const { data } = await admin.from("historico").select("entidade, acao, user_id").eq("vendedor_id", ana.vendedorId);
    const tem = (entidade, acao) => data.some((h) => h.entidade === entidade && h.acao === acao && h.user_id === ana.id);
    assert.ok(tem("vendedores", "update"));
    assert.ok(tem("itens_cardapio", "insert"));
    assert.ok(tem("itens_cardapio", "delete"));
  });

  test("o histórico não pode ser alterado nem apagado pelo vendedor", async () => {
    const u = await ana.client.from("historico").update({ acao: "apagado" }).eq("vendedor_id", ana.vendedorId).select();
    const d = await ana.client.from("historico").delete().eq("vendedor_id", ana.vendedorId).select();
    assert.equal(u.data?.length ?? 0, 0);
    assert.equal(d.data?.length ?? 0, 0);
  });
});
