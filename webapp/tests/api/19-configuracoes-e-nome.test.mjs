// Configurações do admin (exigir ou não aprovação de avaliações e de vendedores) e nome opcional de quem avalia.

import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, dadosBase, sufixo, zerarLimites } from "../helpers.mjs";

const ctx = new Contexto();
let loja;
let adm;
let outro;

const email = () => `cliente.${sufixo()}@exemplo.com`;
const novoConvite = async () => {
  const { data, error } = await admin.rpc("criar_convite_avaliacao", { p_vendedor: loja.vendedorId, p_email: email() });
  assert.ifError(error);
  return data.token;
};
const avaliar = (token, extra = {}) =>
  anonimo().rpc("avaliar_por_convite", { p_token: token, p_nota: 5, p_comentario: "Muito bom", ...extra });
const configurar = async (avaliacoes, vendedores) => {
  const { error } = await admin
    .from("configuracoes")
    .update({ avaliacoes_exigem_aprovacao: avaliacoes, vendedores_exigem_aprovacao: vendedores })
    .eq("id", true);
  assert.ifError(error);
};
const ultimaAvaliacao = async () => {
  const { data } = await admin.from("avaliacoes").select("*").eq("vendedor_id", loja.vendedorId).order("created_at", { ascending: false }).limit(1);
  return data[0];
};

before(async () => {
  loja = await ctx.novoVendedor({ aprovado: true });
  adm = await ctx.novoVendedor({ aprovado: true, ehAdmin: true });
  outro = await ctx.novoVendedor({ semPerfil: true });
});
beforeEach(async () => {
  await zerarLimites();
  await configurar(true, true);
  await admin.from("convites_avaliacao").delete().eq("vendedor_id", loja.vendedorId);
  await admin.from("avaliacoes").delete().eq("vendedor_id", loja.vendedorId);
});
after(async () => {
  await configurar(true, true); // o resto da suíte conta com o padrão (exigir aprovação)
  await ctx.limpar();
});

describe("quem lê e muda as configurações", () => {
  test("o padrão é exigir aprovação nos dois casos", async () => {
    const { data } = await admin.from("configuracoes").select("*");
    assert.equal(data.length, 1);
    assert.equal(data[0].avaliacoes_exigem_aprovacao, true);
    assert.equal(data[0].vendedores_exigem_aprovacao, true);
  });

  test("visitante e vendedor comum não leem nem mudam", async () => {
    for (const cliente of [anonimo(), loja.client]) {
      const ler = await cliente.from("configuracoes").select("*");
      assert.equal(ler.data?.length ?? 0, 0, "RLS: só o administrador vê");
      await cliente.from("configuracoes").update({ avaliacoes_exigem_aprovacao: false, vendedores_exigem_aprovacao: false }).eq("id", true);
      const { data } = await admin.from("configuracoes").select("*").single();
      assert.equal(data.avaliacoes_exigem_aprovacao, true, "continua exigindo");
      assert.equal(data.vendedores_exigem_aprovacao, true);
    }
  });

  test("não dá para criar uma segunda linha nem apagar a existente", async () => {
    const criar = await adm.client.from("configuracoes").insert({ id: false });
    assert.ok(criar.error);
    await adm.client.from("configuracoes").delete().eq("id", true);
    const { data } = await admin.from("configuracoes").select("*");
    assert.equal(data.length, 1);
  });

  test("o administrador muda, e a alteração registra quem e quando", async () => {
    const { error } = await adm.client.from("configuracoes").update({ avaliacoes_exigem_aprovacao: false }).eq("id", true);
    assert.ifError(error);
    const { data } = await adm.client.from("configuracoes").select("*").single();
    assert.equal(data.avaliacoes_exigem_aprovacao, false);
    assert.equal(data.vendedores_exigem_aprovacao, true, "o outro não mexe");
    assert.equal(data.atualizado_por, adm.id);
  });
});

describe("avaliação: aprovação e nome", () => {
  test("exigindo aprovação: nasce pendente e fora da nota média", async () => {
    assert.equal((await avaliar(await novoConvite())).data, "ok");
    const a = await ultimaAvaliacao();
    assert.equal(a.aprovada, false);
    const { data } = await anonimo().from("avaliacoes_resumo").select("*").eq("vendedor_id", loja.vendedorId);
    assert.equal(data.length, 0);
  });

  test("liberando: já nasce publicada e entra na nota média", async () => {
    await configurar(false, true);
    assert.equal((await avaliar(await novoConvite(), { p_nota: 4 })).data, "ok");
    assert.equal((await ultimaAvaliacao()).aprovada, true);
    const { data } = await anonimo().from("avaliacoes_resumo").select("media, total").eq("vendedor_id", loja.vendedorId);
    assert.equal(Number(data[0].media), 4);
    assert.equal(data[0].total, 1);
  });

  test("a página do convite sabe se haverá conferência", async () => {
    const token = await novoConvite();
    assert.equal((await anonimo().rpc("convite_info", { p_token: token })).data.moderada, true);
    await configurar(false, true);
    assert.equal((await anonimo().rpc("convite_info", { p_token: token })).data.moderada, false);
  });

  test("o nome é opcional: sem nome fica nulo (anônimo)", async () => {
    await avaliar(await novoConvite());
    assert.equal((await ultimaAvaliacao()).autor_nome, null);
    await avaliar(await novoConvite(), { p_nome: "   " });
    assert.equal((await ultimaAvaliacao()).autor_nome, null);
  });

  test("com nome: guarda limpo, sem espaços repetidos nem caracteres de controle", async () => {
    await avaliar(await novoConvite(), { p_nome: "  Maria   da\u0007 Silva " });
    assert.equal((await ultimaAvaliacao()).autor_nome, "Maria da Silva");
  });

  test("nome publicado só aparece ao visitante depois de aprovada", async () => {
    await avaliar(await novoConvite(), { p_nome: "Joana" });
    const pendente = await anonimo().from("avaliacoes").select("autor_nome").eq("vendedor_id", loja.vendedorId);
    assert.equal(pendente.data.length, 0, "pendente não é público");
    await admin.from("avaliacoes").update({ aprovada: true }).eq("vendedor_id", loja.vendedorId);
    const publica = await anonimo().from("avaliacoes").select("autor_nome").eq("vendedor_id", loja.vendedorId);
    assert.equal(publica.data[0].autor_nome, "Joana");
  });

  test("nome inválido é recusado e o convite não é gasto", async () => {
    const token = await novoConvite();
    for (const [nome, motivo] of [
      ["a".repeat(41), "nome_longo"],
      ["maria@gmail.com", "nome_invalido"],
      ["www.loja.com.br", "nome_invalido"],
      ["https://x.com", "nome_invalido"],
      ["Ligue 11999990000", "nome_invalido"],
    ]) {
      assert.equal((await avaliar(token, { p_nome: nome })).data, motivo, nome);
    }
    assert.equal((await avaliar(token, { p_nome: "Carlos" })).data, "ok", "o mesmo convite ainda vale");
  });

  test("a assinatura antiga (sem nome) continua funcionando para quem não manda o campo", async () => {
    assert.equal((await avaliar(await novoConvite())).data, "ok");
  });
});

describe("vendedor novo: aprovação", () => {
  const criarPerfil = async (usuario, extra = {}) => {
    const { data: antigo } = await admin.from("vendedores").select("id").eq("owner_id", usuario.id);
    if (antigo?.length) await admin.from("vendedores").delete().eq("owner_id", usuario.id);
    const { bairroId } = await dadosBase();
    return usuario.client
      .from("vendedores")
      .insert({ owner_id: usuario.id, nome: `Nova loja ${sufixo()}`, whatsapp: "5511999990001", bairro_id: bairroId, ...extra })
      .select("ativo, aprovado_em")
      .single();
  };

  test("exigindo aprovação: nasce oculto, mesmo que o vendedor tente se aprovar", async () => {
    const { data, error } = await criarPerfil(outro, { ativo: true, aprovado_em: new Date().toISOString() });
    assert.ifError(error);
    assert.equal(data.ativo, false);
    assert.equal(data.aprovado_em, null);
  });

  test("liberando: já nasce no ar, com a data de aprovação", async () => {
    await configurar(true, false);
    const { data, error } = await criarPerfil(outro);
    assert.ifError(error);
    assert.equal(data.ativo, true);
    assert.ok(data.aprovado_em);
  });

  test("liberado, o vendedor continua sem poder se reativar depois de suspenso", async () => {
    await configurar(true, false);
    await criarPerfil(outro);
    await admin.from("vendedores").update({ ativo: false }).eq("owner_id", outro.id); // admin suspende
    await outro.client.from("vendedores").update({ ativo: true }).eq("owner_id", outro.id);
    const { data } = await admin.from("vendedores").select("ativo").eq("owner_id", outro.id).single();
    assert.equal(data.ativo, false);
  });

  test("liberar não esconde nem aprova os que já existem", async () => {
    await configurar(true, false);
    const { data } = await admin.from("vendedores").select("ativo").eq("id", loja.vendedorId).single();
    assert.equal(data.ativo, true);
  });
});
