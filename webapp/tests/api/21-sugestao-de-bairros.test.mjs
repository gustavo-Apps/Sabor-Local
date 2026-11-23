// Sugestão de bairros: vendedor sugere, administrador aprova/junta/recusa; sem duplicata e com limite por dia.

import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, sufixo } from "../helpers.mjs";

const ctx = new Contexto();
let ana;
let beto;
let adm;
let cidadeId;
let outraCidadeId;
const criados = [];

const sugerir = (usuario, nome, cidade = cidadeId) => usuario.client.rpc("sugerir_bairro", { p_nome: nome, p_cidade: cidade });
const unico = () => `Bairro Teste ${sufixo()}`;
const vendedor = async (usuario) =>
  (await admin.from("vendedores").select("bairro_id, bairro_sugerido, cidade_id").eq("id", usuario.vendedorId).single()).data;
const fila = async (usuario) =>
  (await admin.from("bairros_sugeridos").select("*").eq("vendedor_id", usuario.vendedorId).order("criado_em")).data;
const novoBairro = async (nome, cidade = cidadeId) => {
  const { data, error } = await admin.from("bairros").insert({ nome, cidade_id: cidade }).select("id").single();
  assert.ifError(error);
  criados.push(data.id);
  return data.id;
};

before(async () => {
  ana = await ctx.novoVendedor({ aprovado: true });
  beto = await ctx.novoVendedor({ aprovado: true });
  adm = await ctx.novoVendedor({ aprovado: true, ehAdmin: true });
  const { data } = await admin.from("cidades").select("id").order("created_at").limit(1);
  cidadeId = data[0].id;
  const { data: nova, error } = await admin.from("cidades").insert({ nome: `Outra ${sufixo()}`, slug: `outra-${sufixo()}` }).select("id").single();
  assert.ifError(error);
  outraCidadeId = nova.id;
});
beforeEach(async () => {
  const antes = await vendedor(ana);
  await admin.from("bairros_sugeridos").delete().in("vendedor_id", [ana.vendedorId, beto.vendedorId]);
  await admin.from("vendedores").update({ bairro_sugerido: null, bairro_id: antes.bairro_id }).in("id", [ana.vendedorId, beto.vendedorId]);
});
after(async () => {
  await admin.from("vendedores").update({ bairro_id: ana.bairroId }).in("id", [ana.vendedorId, beto.vendedorId]);
  await admin.from("bairros_sugeridos").delete().in("cidade_id", [cidadeId, outraCidadeId]);
  if (criados.length) await admin.from("bairros").delete().in("id", criados);
  await ctx.limpar();
  await admin.from("bairros").delete().eq("cidade_id", outraCidadeId);
  await admin.from("cidades").delete().eq("id", outraCidadeId);
});

describe("nomes parecidos não duplicam", () => {
  test("chave_bairro ignora acento, maiúsculas, pontuação e espaços", async () => {
    const { data } = await admin.rpc("chave_bairro", { p_nome: "  Jardim  São-José! " });
    assert.equal(data, "jardim sao jose");
  });

  test("o banco recusa um bairro com o mesmo nome sem acento na mesma cidade", async () => {
    const base = `Lagoa ${sufixo()}`;
    await novoBairro(`${base} Azul`);
    for (const igual of [`${base} azul`, `${base.toUpperCase()} AZUL`, `${base}  Azul `]) {
      const { error } = await admin.from("bairros").insert({ nome: igual, cidade_id: cidadeId });
      assert.equal(error?.code, "23505", igual);
    }
  });

  test("o mesmo nome em outra cidade é permitido", async () => {
    const nome = unico();
    await novoBairro(nome);
    const { data, error } = await admin.from("bairros").insert({ nome, cidade_id: outraCidadeId }).select("id").single();
    assert.ifError(error);
    criados.push(data.id);
  });

  test("renomear para um nome que já existe também é recusado", async () => {
    const a = await novoBairro(unico());
    const nomeB = unico();
    await novoBairro(nomeB);
    const { error } = await admin.from("bairros").update({ nome: nomeB.toLowerCase() }).eq("id", a);
    assert.equal(error?.code, "23505");
  });
});

describe("vendedor sugere", () => {
  test("bairro novo fica pendente: o perfil mostra o texto e sai do filtro de bairro", async () => {
    const nome = unico();
    const { data, error } = await sugerir(ana, `  ${nome}  `);
    assert.ifError(error);
    assert.equal(data.resultado, "pendente");
    const v = await vendedor(ana);
    assert.equal(v.bairro_id, null);
    assert.equal(v.bairro_sugerido, nome);
    const linhas = await fila(ana);
    assert.equal(linhas.length, 1);
    assert.equal(linhas[0].status, "pendente");
    assert.equal(linhas[0].cidade_id, cidadeId);
  });

  test("bairro que já existe (outra grafia) é usado direto, sem fila", async () => {
    const nome = unico();
    const id = await novoBairro(nome);
    const { data } = await sugerir(ana, nome.toUpperCase());
    assert.equal(data.resultado, "ja_existia");
    const v = await vendedor(ana);
    assert.equal(v.bairro_id, id);
    assert.equal(v.bairro_sugerido, null);
    assert.equal((await fila(ana)).length, 0);
  });

  test("nome inválido é recusado: curto, longo, site, e-mail, só símbolos", async () => {
    for (const ruim of ["a", "x".repeat(61), "www.bairro.com", "contato@bairro.com", "https://x.com", "!!!", "   "]) {
      const { error } = await sugerir(ana, ruim);
      assert.match(error?.message ?? "", /nome_invalido/, ruim);
    }
  });

  test("cidade inexistente ou desativada é recusada", async () => {
    const { error } = await sugerir(ana, unico(), "00000000-0000-0000-0000-000000000000");
    assert.match(error?.message ?? "", /cidade_invalida/);
    await admin.from("cidades").update({ ativa: false }).eq("id", outraCidadeId);
    const { error: desativada } = await sugerir(ana, unico(), outraCidadeId);
    assert.match(desativada?.message ?? "", /cidade_invalida/);
    await admin.from("cidades").update({ ativa: true }).eq("id", outraCidadeId);
  });

  test("uma nova sugestão substitui a anterior que ainda esperava", async () => {
    await sugerir(ana, unico());
    const segundo = unico();
    await sugerir(ana, segundo);
    const linhas = await fila(ana);
    assert.deepEqual(linhas.map((l) => l.status), ["cancelada", "pendente"]);
    assert.equal((await vendedor(ana)).bairro_sugerido, segundo);
  });

  test("limite de 5 sugestões por dia", async () => {
    for (let i = 0; i < 5; i++) assert.ifError((await sugerir(ana, unico())).error);
    const { error } = await sugerir(ana, unico());
    assert.match(error?.message ?? "", /limite_diario/);
  });

  test("só vendedor logado e com perfil sugere", async () => {
    const visitante = await anonimo().rpc("sugerir_bairro", { p_nome: unico(), p_cidade: cidadeId });
    assert.ok(visitante.error);
    const semPerfil = await ctx.novoVendedor({ semPerfil: true });
    const { error } = await sugerir(semPerfil, unico());
    assert.match(error?.message ?? "", /sem_perfil/);
  });

  test("escolher um bairro da lista encerra a sugestão que esperava", async () => {
    await sugerir(ana, unico());
    await ana.client.from("vendedores").update({ bairro_id: ana.bairroId }).eq("id", ana.vendedorId);
    const v = await vendedor(ana);
    assert.equal(v.bairro_id, ana.bairroId);
    assert.equal(v.bairro_sugerido, null);
    assert.equal((await fila(ana))[0].status, "cancelada");
  });

  test("ninguém lê a fila direto (só o administrador, pela função)", async () => {
    await sugerir(ana, unico());
    for (const cliente of [anonimo(), ana.client, beto.client, adm.client]) {
      const { data } = await cliente.from("bairros_sugeridos").select("*");
      assert.equal(data?.length ?? 0, 0);
    }
    assert.ok((await ana.client.rpc("admin_bairros_sugeridos")).error);
    assert.ok((await anonimo().rpc("admin_bairros_sugeridos")).error);
  });
});

describe("administrador trata a fila", () => {
  const tratar = (id, acao, bairro = null) => adm.client.rpc("admin_tratar_sugestao", { p_id: id, p_acao: acao, p_bairro: bairro });

  test("a fila mostra cidade, vendedor e quantos pediram o mesmo", async () => {
    const nome = unico();
    await sugerir(ana, nome);
    await sugerir(beto, nome.toUpperCase());
    const { data } = await adm.client.rpc("admin_bairros_sugeridos");
    const minhas = data.filter((s) => s.nome.toLowerCase() === nome.toLowerCase());
    assert.equal(minhas.length, 2);
    assert.equal(Number(minhas[0].iguais), 2);
    assert.ok(minhas[0].cidade_nome && minhas[0].vendedor_nome);
  });

  test("aprovar cria o bairro e coloca nele todos os vendedores que pediram o mesmo", async () => {
    const nome = unico();
    await sugerir(ana, nome);
    await sugerir(beto, nome.toLowerCase());
    const [s] = await fila(ana);
    const { data, error } = await tratar(s.id, "aprovar");
    assert.ifError(error);
    assert.equal(data.vendedores, 2);
    const { data: bairro } = await admin.from("bairros").select("id, nome, cidade_id").eq("nome", nome).single();
    criados.push(bairro.id);
    assert.equal(bairro.cidade_id, cidadeId);
    for (const u of [ana, beto]) {
      const v = await vendedor(u);
      assert.equal(v.bairro_id, bairro.id);
      assert.equal(v.bairro_sugerido, null);
    }
    assert.equal((await fila(ana))[0].status, "aprovada");
  });

  test("juntar usa um bairro que já existe", async () => {
    const existente = await novoBairro(unico());
    await sugerir(ana, unico());
    const [s] = await fila(ana);
    assert.ifError((await tratar(s.id, "unir", existente)).error);
    assert.equal((await vendedor(ana)).bairro_id, existente);
    assert.equal((await fila(ana))[0].status, "unida");
  });

  test("juntar com bairro de outra cidade é recusado", async () => {
    const deOutra = await novoBairro(unico(), outraCidadeId);
    await sugerir(ana, unico());
    const [s] = await fila(ana);
    assert.match((await tratar(s.id, "unir", deOutra)).error?.message ?? "", /bairro_invalido/);
    assert.match((await tratar(s.id, "unir", null)).error?.message ?? "", /bairro_invalido/);
    assert.equal((await fila(ana))[0].status, "pendente");
  });

  test("recusar descarta e o vendedor volta a ficar sem bairro (precisa escolher)", async () => {
    await sugerir(ana, unico());
    const [s] = await fila(ana);
    assert.ifError((await tratar(s.id, "recusar")).error);
    const v = await vendedor(ana);
    assert.equal(v.bairro_id, null);
    assert.equal(v.bairro_sugerido, null);
    assert.equal((await fila(ana))[0].status, "recusada");
  });

  test("não trata duas vezes nem com ação inventada", async () => {
    await sugerir(ana, unico());
    const [s] = await fila(ana);
    assert.match((await tratar(s.id, "apagar_tudo")).error?.message ?? "", /acao_invalida/);
    assert.ifError((await tratar(s.id, "recusar")).error);
    assert.match((await tratar(s.id, "recusar")).error?.message ?? "", /sugestao_nao_encontrada/);
  });

  test("vendedor comum e visitante não tratam", async () => {
    await sugerir(ana, unico());
    const [s] = await fila(ana);
    for (const cliente of [ana.client, beto.client, anonimo()]) {
      const { error } = await cliente.rpc("admin_tratar_sugestao", { p_id: s.id, p_acao: "aprovar", p_bairro: null });
      assert.ok(error);
    }
    assert.equal((await fila(ana))[0].status, "pendente");
  });
});

describe("juntar dois bairros", () => {
  test("quem estava no de origem vai para o destino e o de origem sai", async () => {
    const origem = await novoBairro(unico());
    const destino = await novoBairro(unico());
    await admin.from("vendedores").update({ bairro_id: origem }).eq("id", ana.vendedorId);
    const { data, error } = await adm.client.rpc("admin_unir_bairros", { p_origem: origem, p_destino: destino });
    assert.ifError(error);
    assert.equal(data, 1);
    assert.equal((await vendedor(ana)).bairro_id, destino);
    const { data: existe } = await admin.from("bairros").select("id").eq("id", origem);
    assert.equal(existe.length, 0);
  });

  test("entre cidades diferentes, para o mesmo bairro e sem ser administrador: recusado", async () => {
    const a = await novoBairro(unico());
    const b = await novoBairro(unico(), outraCidadeId);
    assert.match((await adm.client.rpc("admin_unir_bairros", { p_origem: a, p_destino: b })).error?.message ?? "", /bairro_invalido/);
    assert.match((await adm.client.rpc("admin_unir_bairros", { p_origem: a, p_destino: a })).error?.message ?? "", /bairro_invalido/);
    assert.ok((await ana.client.rpc("admin_unir_bairros", { p_origem: a, p_destino: a })).error);
  });

  test("bairro com vendedor não pode ser apagado direto (só juntado)", async () => {
    const usado = await novoBairro(unico());
    await admin.from("vendedores").update({ bairro_id: usado }).eq("id", ana.vendedorId);
    const { error } = await admin.from("bairros").delete().eq("id", usado);
    assert.ok(error);
  });
});
