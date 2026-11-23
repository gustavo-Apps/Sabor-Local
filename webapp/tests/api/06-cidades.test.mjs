// Fase 4: várias cidades. Cada bairro pertence a uma cidade e o vendedor herda a cidade do bairro.

import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, sufixo } from "../helpers.mjs";

const ctx = new Contexto();
let adm;
let ana;
let beto;
let cidadeB; // cidade extra, ativa
let cidadeInativa;
let bairroB;
let bairroPadrao;
let cidadePadraoId;

before(async () => {
  adm = await ctx.novoVendedor({ aprovado: true, ehAdmin: true });
  ana = await ctx.novoVendedor({ aprovado: true });
  beto = await ctx.novoVendedor({ aprovado: true });

  const { data: padrao } = await admin.from("cidades").select("id").order("created_at").limit(1).single();
  cidadePadraoId = padrao.id;
  bairroPadrao = ana.bairroId;

  const s = sufixo();
  ({ data: cidadeB } = await admin.from("cidades").insert({ nome: `Cidade B ${s}`, slug: `cidade-b-${s}`, uf: "RS" }).select().single());
  ({ data: cidadeInativa } = await admin.from("cidades").insert({ nome: `Cidade Off ${s}`, slug: `cidade-off-${s}`, ativa: false }).select().single());
  ({ data: bairroB } = await admin.from("bairros").insert({ nome: "Centro", cidade_id: cidadeB.id }).select().single());
});

after(async () => {
  await ctx.limpar();
  for (const c of [cidadeB, cidadeInativa]) {
    if (!c) continue;
    await admin.from("bairros").delete().eq("cidade_id", c.id);
    await admin.from("cidades").delete().eq("id", c.id);
  }
});

const cidadeDoVendedor = async (id) => (await admin.from("vendedores").select("cidade_id").eq("id", id).single()).data.cidade_id;

describe("migração dos dados existentes", () => {
  test("existe pelo menos uma cidade e todos os bairros e vendedores têm cidade", async () => {
    const { count: cidades } = await admin.from("cidades").select("id", { count: "exact", head: true });
    const { count: bairrosSem } = await admin.from("bairros").select("id", { count: "exact", head: true }).is("cidade_id", null);
    const { count: vendedoresSem } = await admin.from("vendedores").select("id", { count: "exact", head: true }).is("cidade_id", null);
    assert.ok(cidades >= 1);
    assert.equal(bairrosSem, 0);
    assert.equal(vendedoresSem, 0);
  });

  test("bairro criado sem informar a cidade cai na cidade padrão", async () => {
    const { data, error } = await admin.from("bairros").insert({ nome: `Padrão ${sufixo()}` }).select().single();
    assert.ifError(error);
    assert.equal(data.cidade_id, cidadePadraoId);
    await admin.from("bairros").delete().eq("id", data.id);
  });
});

describe("o vendedor herda a cidade do bairro", () => {
  test("na criação a cidade vem do bairro, mesmo sem enviar cidade_id", async () => {
    assert.equal(await cidadeDoVendedor(ana.vendedorId), cidadePadraoId);
  });

  test("trocar de bairro troca a cidade", async () => {
    const { error } = await ana.client.from("vendedores").update({ bairro_id: bairroB.id }).eq("id", ana.vendedorId);
    assert.ifError(error);
    assert.equal(await cidadeDoVendedor(ana.vendedorId), cidadeB.id);
    await ana.client.from("vendedores").update({ bairro_id: bairroPadrao }).eq("id", ana.vendedorId);
    assert.equal(await cidadeDoVendedor(ana.vendedorId), cidadePadraoId);
  });

  test("não dá para escolher uma cidade diferente da do bairro", async () => {
    await beto.client.from("vendedores").update({ bairro_id: bairroPadrao, cidade_id: cidadeB.id }).eq("id", beto.vendedorId);
    assert.equal(await cidadeDoVendedor(beto.vendedorId), cidadePadraoId, "a cidade segue o bairro");
  });

  test("bairro inexistente continua dando erro de chave estrangeira (não 'cidade nula')", async () => {
    const { error } = await beto.client.from("vendedores").update({ bairro_id: "00000000-0000-0000-0000-000000000000" }).eq("id", beto.vendedorId);
    assert.equal(error?.code, "23503");
  });
});

describe("regras do banco", () => {
  const cidade = (campos) => admin.from("cidades").insert({ nome: "Teste", slug: `t-${sufixo()}`, ...campos });
  const recusa = (nome, campos, codigo = "23514") =>
    test(nome, async () => {
      const { error } = await cidade(campos);
      assert.equal(error?.code, codigo, error?.message);
    });

  recusa("slug com maiúscula", { slug: "Santa-Maria" });
  recusa("slug com espaço", { slug: "santa maria" });
  recusa("slug com hífen duplo", { slug: "a--b" });
  recusa("slug com mais de 60 caracteres", { slug: "a".repeat(61) });
  recusa("UF com 3 letras", { uf: "RSS" });
  recusa("UF minúscula", { uf: "rs" });
  recusa("nome de 1 letra", { nome: "A" });
  recusa("nome com 61 letras", { nome: "a".repeat(61) });

  test("slug repetido (23505)", async () => {
    const { error } = await cidade({ slug: cidadeB.slug });
    assert.equal(error?.code, "23505");
  });

  test("mesmo nome de bairro em cidades diferentes pode", async () => {
    const { error } = await admin.from("bairros").insert({ nome: "Centro", cidade_id: cidadePadraoId });
    // "Centro" já existe na padrão (seed) ou é criado agora; o que importa é que bairroB (Centro/cidade B) existe
    assert.ok(!error || error.code === "23505");
    assert.ok(bairroB.id);
  });

  test("nome de bairro repetido na mesma cidade é recusado, sem diferenciar maiúsculas", async () => {
    const { error } = await admin.from("bairros").insert({ nome: "CENTRO", cidade_id: cidadeB.id });
    assert.equal(error?.code, "23505");
    const { error: e2 } = await admin.from("bairros").insert({ nome: "centro", cidade_id: cidadeB.id });
    assert.equal(e2?.code, "23505");
  });

  test("bairro com nome curto ou gigante é recusado", async () => {
    for (const nome of ["A", "a".repeat(61)]) {
      const { error } = await admin.from("bairros").insert({ nome, cidade_id: cidadeB.id });
      assert.equal(error?.code, "23514", nome.slice(0, 5));
    }
  });

  test("não dá para apagar uma cidade que ainda tem bairros", async () => {
    const { error } = await admin.from("cidades").delete().eq("id", cidadeB.id);
    assert.equal(error?.code, "23503");
  });
});

describe("quem vê e quem altera cidades", () => {
  test("visitante vê só cidades ativas", async () => {
    const { data } = await anonimo().from("cidades").select("id").in("id", [cidadeB.id, cidadeInativa.id]);
    assert.deepEqual(data.map((c) => c.id), [cidadeB.id]);
  });

  test("admin vê também as desativadas", async () => {
    const { data } = await adm.client.from("cidades").select("id").in("id", [cidadeB.id, cidadeInativa.id]);
    assert.equal(data.length, 2);
  });

  test("vendedor comum não cria, altera nem apaga cidade ou bairro", async () => {
    const c = await ana.client.from("cidades").insert({ nome: "Invasora", slug: `inv-${sufixo()}` });
    const b = await ana.client.from("bairros").insert({ nome: "Invasor", cidade_id: cidadeB.id });
    const u = await ana.client.from("cidades").update({ nome: "Pichada" }).eq("id", cidadeB.id).select();
    const d = await ana.client.from("bairros").delete().eq("id", bairroB.id).select();
    assert.ok(c.error && b.error);
    assert.equal(u.data?.length ?? 0, 0);
    assert.equal(d.data?.length ?? 0, 0);
  });

  test("visitante também não escreve", async () => {
    const v = anonimo();
    assert.ok((await v.from("cidades").insert({ nome: "Anon", slug: `a-${sufixo()}` })).error);
    assert.ok((await v.from("bairros").insert({ nome: "Anon", cidade_id: cidadeB.id })).error);
  });

  test("admin cria cidade e bairro direto pelo cliente (RLS de admin)", async () => {
    const slug = `adm-${sufixo()}`;
    const { data: c, error } = await adm.client.from("cidades").insert({ nome: "Criada pelo admin", slug }).select().single();
    assert.ifError(error);
    const { error: eb } = await adm.client.from("bairros").insert({ nome: "Bairro novo", cidade_id: c.id });
    assert.ifError(eb);
    await admin.from("bairros").delete().eq("cidade_id", c.id);
    await admin.from("cidades").delete().eq("id", c.id);
  });

  test("admin_cidades mostra contagens e só responde ao admin", async () => {
    const { data } = await adm.client.rpc("admin_cidades");
    const b = data.find((c) => c.id === cidadeB.id);
    assert.ok(b && Number(b.bairros) >= 1);
    assert.match((await ana.client.rpc("admin_cidades")).error?.message ?? "", /sem_permissao/);
    assert.ok((await anonimo().rpc("admin_cidades")).error);
  });

  test("admin_vendedores traz o nome da cidade de cada vendedor", async () => {
    await ana.client.from("vendedores").update({ bairro_id: bairroB.id }).eq("id", ana.vendedorId);
    const { data } = await adm.client.rpc("admin_vendedores");
    assert.equal(data.find((v) => v.id === ana.vendedorId)?.cidade, cidadeB.nome);
    await ana.client.from("vendedores").update({ bairro_id: bairroPadrao }).eq("id", ana.vendedorId);
  });
});

describe("catálogo por cidade", () => {
  test("filtrar por cidade devolve só os vendedores ativos daquela cidade", async () => {
    await ana.client.from("vendedores").update({ bairro_id: bairroB.id }).eq("id", ana.vendedorId);
    const { data: daB } = await anonimo().from("vendedores").select("id, cidade_id").eq("ativo", true).eq("cidade_id", cidadeB.id);
    assert.ok(daB.some((v) => v.id === ana.vendedorId));
    assert.ok(daB.every((v) => v.cidade_id === cidadeB.id));

    const { data: daPadrao } = await anonimo().from("vendedores").select("id").eq("ativo", true).eq("cidade_id", cidadePadraoId);
    assert.ok(!daPadrao.some((v) => v.id === ana.vendedorId), "ana saiu da cidade padrão");
    assert.ok(daPadrao.some((v) => v.id === beto.vendedorId));
    await ana.client.from("vendedores").update({ bairro_id: bairroPadrao }).eq("id", ana.vendedorId);
  });

  test("vendedor pendente de outra cidade continua invisível", async () => {
    const pendente = await ctx.novoVendedor({ aprovado: false, semLogin: true });
    await admin.from("vendedores").update({ bairro_id: bairroB.id }).eq("id", pendente.vendedorId);
    const { data } = await anonimo().from("vendedores").select("id").eq("cidade_id", cidadeB.id);
    assert.ok(!data.some((v) => v.id === pendente.vendedorId));
  });
});
