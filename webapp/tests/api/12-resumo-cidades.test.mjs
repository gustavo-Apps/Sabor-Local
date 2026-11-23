// Resumo do admin por cidade: só administrador, contagens certas e isolamento entre cidades.

import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, sufixo } from "../helpers.mjs";

const ctx = new Contexto();
const slug = `teste-resumo-${sufixo()}`;
let adm;
let comum;
let cidadeId;
let bairroId;
let completo;
let semHorario;
let pendente;
let suspenso;

const linhaDaCidade = async () => {
  const { data, error } = await adm.client.rpc("admin_resumo_cidades");
  assert.ifError(error);
  return data.find((c) => c.cidade_id === cidadeId);
};
const n = (v) => Number(v);

before(async () => {
  adm = await ctx.novoVendedor({ aprovado: true, ehAdmin: true });
  comum = await ctx.novoVendedor({ aprovado: true });

  const { data: cidade, error } = await admin.from("cidades").insert({ nome: "Cidade de Teste", uf: "RS", slug }).select("id").single();
  assert.ifError(error);
  cidadeId = cidade.id;
  const { data: bairro } = await admin.from("bairros").insert({ nome: "Centro do Teste", cidade_id: cidadeId }).select("id").single();
  bairroId = bairro.id;

  // quatro vendedores na cidade de teste (o gatilho copia a cidade do bairro)
  completo = await ctx.novoVendedor({ aprovado: true });
  semHorario = await ctx.novoVendedor({ aprovado: true });
  pendente = await ctx.novoVendedor({ aprovado: false });
  suspenso = await ctx.novoVendedor({ aprovado: true });
  for (const v of [completo, semHorario, pendente, suspenso]) {
    const { error: e } = await admin.from("vendedores").update({ bairro_id: bairroId }).eq("id", v.vendedorId);
    assert.ifError(e);
  }
  await admin.from("vendedores").update({ ativo: false }).eq("id", suspenso.vendedorId); // aprovado antes, depois suspenso

  // só o "completo" tem horário e menu
  await admin.from("horarios_funcionamento").insert({ vendedor_id: completo.vendedorId, dia_semana: 1, abre: "08:00", fecha: "18:00" });
  await admin.from("itens_cardapio").insert({ vendedor_id: completo.vendedorId, nome: "Prato do dia", preco: 20 });
  // o "semHorario" tem menu, mas não horário
  await admin.from("itens_cardapio").insert({ vendedor_id: semHorario.vendedorId, nome: "Lanche", preco: 15 });

  await admin.from("vendedores").update({ destaque_ate: new Date(Date.now() + 86_400_000).toISOString() }).eq("id", completo.vendedorId);

  // todas as linhas com as mesmas colunas (o insert em lote preenche a falta com nulo)
  const agora = new Date().toISOString();
  const velho = new Date(Date.now() - 40 * 86_400_000).toISOString();
  const { error: erroEventos } = await admin.from("eventos").insert([
    { tipo: "visita_vendedor", vendedor_id: completo.vendedorId, created_at: agora },
    { tipo: "visita_vendedor", vendedor_id: completo.vendedorId, created_at: agora },
    { tipo: "visita_vendedor", vendedor_id: semHorario.vendedorId, created_at: agora },
    { tipo: "visita_vendedor", vendedor_id: completo.vendedorId, created_at: velho }, // fora dos 30 dias
    { tipo: "whatsapp", vendedor_id: completo.vendedorId, created_at: agora },
  ]);
  assert.ifError(erroEventos);
  await admin.from("avaliacoes").insert({ vendedor_id: completo.vendedorId, nota: 5, codigo_verificacao: `RS${sufixo()}`, aprovada: true });
  await admin.from("avaliacoes").insert({ vendedor_id: completo.vendedorId, nota: 4, codigo_verificacao: `RP${sufixo()}`, aprovada: false });
});

after(async () => {
  await ctx.limpar();
  await admin.from("bairros").delete().eq("cidade_id", cidadeId);
  await admin.from("cidades").delete().eq("id", cidadeId);
});

describe("quem pode chamar", () => {
  test("administrador consegue", async () => {
    assert.ifError((await adm.client.rpc("admin_resumo_cidades")).error);
  });

  test("vendedor comum recebe sem_permissao", async () => {
    const { data, error } = await comum.client.rpc("admin_resumo_cidades");
    assert.match(error?.message ?? "", /sem_permissao/);
    assert.ok(!data || data.length === 0);
  });

  test("visitante sem login não chama a função", async () => {
    const { error } = await anonimo().rpc("admin_resumo_cidades");
    assert.ok(error);
  });
});

describe("contagens da cidade", () => {
  test("a cidade nova aparece com os dados dela", async () => {
    const c = await linhaDaCidade();
    assert.ok(c, "a cidade de teste deveria estar na lista");
    assert.equal(c.nome, "Cidade de Teste");
    assert.equal(c.uf, "RS");
    assert.equal(c.slug, slug);
    assert.equal(c.ativa, true);
  });

  test("vendedores: ativos, pendentes e suspensos", async () => {
    const c = await linhaDaCidade();
    assert.equal(n(c.vendedores_ativos), 2);
    assert.equal(n(c.vendedores_pendentes), 1);
    assert.equal(n(c.vendedores_suspensos), 1);
  });

  test("perfil completo exige horário e menu: só um dos quatro", async () => {
    assert.equal(n((await linhaDaCidade()).perfis_completos), 1);
  });

  test("dar horário a quem só tinha menu completa o perfil (e tirar descompleta)", async () => {
    await admin.from("horarios_funcionamento").insert({ vendedor_id: semHorario.vendedorId, dia_semana: 2, abre: "09:00", fecha: "12:00" });
    assert.equal(n((await linhaDaCidade()).perfis_completos), 2);
    await admin.from("horarios_funcionamento").delete().eq("vendedor_id", semHorario.vendedorId);
    assert.equal(n((await linhaDaCidade()).perfis_completos), 1);
  });

  test("destaques, visitas (só 30 dias), toques e avaliações publicadas", async () => {
    const c = await linhaDaCidade();
    assert.equal(n(c.destaques_ativos), 1);
    assert.equal(n(c.visitas_perfis_30d), 3);
    assert.equal(n(c.toques_whatsapp_30d), 1);
    assert.equal(n(c.avaliacoes_publicadas), 1, "avaliação pendente não conta");
  });

  test("cidade vazia aparece zerada, sem erro", async () => {
    const { data: vazia } = await admin.from("cidades").insert({ nome: "Cidade Vazia", slug: `${slug}-vazia` }).select("id").single();
    try {
      const { data } = await adm.client.rpc("admin_resumo_cidades");
      const c = data.find((x) => x.cidade_id === vazia.id);
      assert.deepEqual(
        [c.vendedores_ativos, c.vendedores_pendentes, c.vendedores_suspensos, c.perfis_completos, c.visitas_perfis_30d].map(n),
        [0, 0, 0, 0, 0],
      );
    } finally {
      await admin.from("cidades").delete().eq("id", vazia.id);
    }
  });

  test("os vendedores da cidade de teste não entram na conta de outra cidade", async () => {
    const { data } = await adm.client.rpc("admin_resumo_cidades");
    const outras = data.filter((c) => c.cidade_id !== cidadeId);
    const somaOutras = outras.reduce((s, c) => s + n(c.visitas_perfis_30d), 0);
    const { count } = await admin.from("eventos").select("id", { count: "exact", head: true }).eq("tipo", "visita_vendedor").gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString());
    assert.equal(somaOutras + n(data.find((c) => c.cidade_id === cidadeId).visitas_perfis_30d), count, "as visitas por cidade fecham com o total de visitas a perfis");
  });

  test("cidade desativada continua na lista, marcada como inativa", async () => {
    await admin.from("cidades").update({ ativa: false }).eq("id", cidadeId);
    assert.equal((await linhaDaCidade()).ativa, false);
    await admin.from("cidades").update({ ativa: true }).eq("id", cidadeId);
  });

  test("a lista vem da cidade mais antiga para a mais nova", async () => {
    const { data } = await adm.client.rpc("admin_resumo_cidades");
    const datas = data.map((c) => Date.parse(c.criada_em));
    assert.deepEqual(datas, [...datas].sort((a, b) => a - b));
  });
});
