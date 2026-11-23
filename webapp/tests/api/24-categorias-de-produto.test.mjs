// Categorias de produto: opcionais e de cada vendedor; a chave (sem acento, maiúsculas e plural) vale entre lojas.

import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto } from "../helpers.mjs";

const ctx = new Contexto();
let ana;
let beto;
let adm;
let itemAna;
let itemBeto;

const criar = (usuario, nome, extra = {}) =>
  usuario.client.from("categorias_produto").insert({ vendedor_id: usuario.vendedorId, nome, ...extra }).select("*").single();
const chaveDe = async (nome) => (await admin.rpc("chave_categoria", { p_nome: nome })).data;
const limpar = () => admin.from("categorias_produto").delete().in("vendedor_id", [ana.vendedorId, beto.vendedorId]);

before(async () => {
  ana = await ctx.novoVendedor({ aprovado: true });
  beto = await ctx.novoVendedor({ aprovado: true });
  adm = await ctx.novoVendedor({ aprovado: true, ehAdmin: true });
  const { data } = await admin
    .from("itens_cardapio")
    .insert([
      { vendedor_id: ana.vendedorId, nome: "Pastel de carne", preco: 8 },
      { vendedor_id: beto.vendedorId, nome: "Suco", preco: 6 },
    ])
    .select("id, vendedor_id");
  itemAna = data.find((i) => i.vendedor_id === ana.vendedorId).id;
  itemBeto = data.find((i) => i.vendedor_id === beto.vendedorId).id;
});
beforeEach(async () => {
  await limpar();
  await admin.from("itens_cardapio").update({ categoria_produto_id: null }).in("id", [itemAna, itemBeto]);
});
after(async () => {
  await limpar();
  await ctx.limpar();
});

describe("a chave de comparação", () => {
  const casos = [
    ["Bebidas", "bebida"],
    ["bebida", "bebida"],
    ["  BEBIDAS  ", "bebida"],
    ["Cachorros-Quentes", "cachorro quente"],
    ["Cachorro quente", "cachorro quente"],
    ["Xis", "xis"],
    ["Pastéis & Doces!", "pastei doce"],
    ["Açaí", "acai"],
    ["Lanches", "lanche"],
    ["Pizzas", "pizza"],
    ["Gás", "gas"],
  ];
  for (const [nome, esperado] of casos) test(`"${nome}" vira "${esperado}"`, async () => assert.equal(await chaveDe(nome), esperado));

  test("só símbolos ou vazio dá chave vazia", async () => {
    for (const n of ["", "   ", "!!!", "---"]) assert.equal(await chaveDe(n), "");
  });
});

describe("o vendedor cria as categorias dele", () => {
  test("cria e o banco calcula a chave e a ordem (o que o navegador mandar é ignorado)", async () => {
    const a = await criar(ana, "  Bebidas ", { chave: "forjada", ordem: 99 });
    assert.ifError(a.error);
    assert.equal(a.data.nome, "Bebidas");
    assert.equal(a.data.chave, "bebida");
    assert.equal(a.data.ordem, 1);
    const b = await criar(ana, "Salgados");
    assert.equal(b.data.ordem, 2);
  });

  test("nomes que o banco recusa: curto, longo, só símbolos, endereço de site e e-mail", async () => {
    for (const nome of ["a", "x".repeat(31), "!!!", "www.loja.com", "https://x.com", "contato@x.com"]) {
      const r = await criar(ana, nome);
      assert.ok(r.error, nome);
    }
  });

  test("não repete: 'Bebidas', 'bebida' e 'BEBIDA' são a mesma categoria na mesma loja", async () => {
    assert.ifError((await criar(ana, "Bebidas")).error);
    for (const igual of ["bebida", "BEBIDAS", " Bebída "]) assert.equal((await criar(ana, igual)).error?.code, "23505", igual);
  });

  test("lojas diferentes podem ter a mesma categoria (é individual)", async () => {
    assert.ifError((await criar(ana, "Bebidas")).error);
    assert.ifError((await criar(beto, "Bebidas")).error);
  });

  test("no máximo 15 por loja", async () => {
    for (let i = 1; i <= 15; i++) assert.ifError((await criar(ana, `Categoria ${String.fromCharCode(64 + i)}${i}`)).error);
    const r = await criar(ana, "Categoria extra");
    assert.equal(r.error?.code, "23514");
    assert.match(r.error?.message ?? "", /limite_categorias/);
    assert.ifError((await criar(beto, "Categoria extra")).error, "o limite é por loja");
  });

  test("renomear recalcula a chave e não deixa duplicar", async () => {
    const a = await criar(ana, "Bebidas");
    await criar(ana, "Doces");
    const ok = await ana.client.from("categorias_produto").update({ nome: "Sucos e vitaminas" }).eq("id", a.data.id).select("chave").single();
    assert.equal(ok.data.chave, "suco e vitamina");
    const dup = await ana.client.from("categorias_produto").update({ nome: "doce" }).eq("id", a.data.id);
    assert.equal(dup.error?.code, "23505");
  });

  test("a ordem pode ser trocada pelo dono", async () => {
    const a = await criar(ana, "Primeira");
    const b = await criar(ana, "Segunda");
    await ana.client.from("categorias_produto").update({ ordem: 2 }).eq("id", a.data.id);
    await ana.client.from("categorias_produto").update({ ordem: 1 }).eq("id", b.data.id);
    const { data } = await ana.client.from("categorias_produto").select("nome").eq("vendedor_id", ana.vendedorId).order("ordem");
    assert.deepEqual(data.map((c) => c.nome), ["Segunda", "Primeira"]);
  });
});

describe("colocar produtos nas categorias", () => {
  test("o dono coloca um item na categoria e tira (é opcional)", async () => {
    const c = await criar(ana, "Salgados");
    const r = await ana.client.from("itens_cardapio").update({ categoria_produto_id: c.data.id }).eq("id", itemAna).select("categoria_produto_id");
    assert.equal(r.data[0].categoria_produto_id, c.data.id);
    const sem = await ana.client.from("itens_cardapio").update({ categoria_produto_id: null }).eq("id", itemAna).select("categoria_produto_id");
    assert.equal(sem.data[0].categoria_produto_id, null);
  });

  test("o menu público traz a categoria junto do item", async () => {
    const c = await criar(ana, "Salgados");
    await admin.from("itens_cardapio").update({ categoria_produto_id: c.data.id }).eq("id", itemAna);
    const { data } = await anonimo()
      .from("itens_cardapio")
      .select("nome, categoria:categorias_produto ( nome, chave )")
      .eq("id", itemAna)
      .single();
    assert.deepEqual(data.categoria, { nome: "Salgados", chave: "salgado" });
  });

  test("item não entra na categoria de outra loja (nem por engano nem de propósito)", async () => {
    const deBeto = await criar(beto, "Bebidas");
    const r = await ana.client.from("itens_cardapio").update({ categoria_produto_id: deBeto.data.id }).eq("id", itemAna);
    assert.equal(r.error?.code, "23514");
    assert.match(r.error?.message ?? "", /categoria_invalida/);
    const novo = await ana.client.from("itens_cardapio").insert({ vendedor_id: ana.vendedorId, nome: "X", categoria_produto_id: deBeto.data.id });
    assert.ok(novo.error);
    const feito = await admin.from("itens_cardapio").select("categoria_produto_id").eq("id", itemAna).single();
    assert.equal(feito.data.categoria_produto_id, null);
  });

  test("apagar a categoria não apaga o item: ele só fica sem categoria", async () => {
    const c = await criar(ana, "Salgados");
    await admin.from("itens_cardapio").update({ categoria_produto_id: c.data.id }).eq("id", itemAna);
    assert.ifError((await ana.client.from("categorias_produto").delete().eq("id", c.data.id)).error);
    const { data } = await admin.from("itens_cardapio").select("nome, categoria_produto_id").eq("id", itemAna).single();
    assert.equal(data.nome, "Pastel de carne");
    assert.equal(data.categoria_produto_id, null);
  });

  test("apagar o item não apaga a categoria", async () => {
    const c = await criar(ana, "Salgados");
    const { data: tmp } = await admin.from("itens_cardapio").insert({ vendedor_id: ana.vendedorId, nome: "Temp", categoria_produto_id: c.data.id }).select("id").single();
    await admin.from("itens_cardapio").delete().eq("id", tmp.id);
    assert.equal((await admin.from("categorias_produto").select("id").eq("id", c.data.id)).data.length, 1);
  });
});

describe("quem pode ver e mudar", () => {
  test("qualquer pessoa vê as categorias de lojas no ar", async () => {
    await criar(ana, "Bebidas");
    const { data } = await anonimo().from("categorias_produto").select("nome").eq("vendedor_id", ana.vendedorId);
    assert.deepEqual(data.map((c) => c.nome), ["Bebidas"]);
  });

  test("loja suspensa some para o público, mas o dono continua vendo", async () => {
    await criar(ana, "Bebidas");
    await admin.from("vendedores").update({ ativo: false }).eq("id", ana.vendedorId);
    assert.equal((await anonimo().from("categorias_produto").select("id").eq("vendedor_id", ana.vendedorId)).data.length, 0);
    assert.equal((await ana.client.from("categorias_produto").select("id").eq("vendedor_id", ana.vendedorId)).data.length, 1);
    await admin.from("vendedores").update({ ativo: true }).eq("id", ana.vendedorId);
  });

  test("outro vendedor e visitante não criam, mudam nem apagam as categorias alheias", async () => {
    const c = await criar(ana, "Bebidas");
    for (const cliente of [beto.client, anonimo()]) {
      const novo = await cliente.from("categorias_produto").insert({ vendedor_id: ana.vendedorId, nome: "Invasão" });
      assert.ok(novo.error);
      const mud = await cliente.from("categorias_produto").update({ nome: "Hackeada" }).eq("id", c.data.id).select();
      assert.equal(mud.data?.length ?? 0, 0);
      const del = await cliente.from("categorias_produto").delete().eq("id", c.data.id).select();
      assert.equal(del.data?.length ?? 0, 0);
    }
    assert.equal((await admin.from("categorias_produto").select("nome").eq("id", c.data.id).single()).data.nome, "Bebidas");
  });

  test("o administrador remove categoria imprópria", async () => {
    const c = await criar(ana, "Bebidas");
    const r = await adm.client.from("categorias_produto").delete().eq("id", c.data.id).select();
    assert.equal(r.data.length, 1);
  });

  test("o histórico registra a categoria", async () => {
    const c = await criar(ana, "Bebidas");
    const { data } = await admin.from("historico").select("acao").eq("entidade", "categorias_produto").eq("entidade_id", c.data.id);
    assert.ok(data.length >= 1);
  });

  test("excluir a conta apaga as categorias", async () => {
    const temp = await ctx.novoVendedor({ aprovado: true });
    await criar(temp, "Bebidas");
    await admin.from("vendedores").delete().eq("id", temp.vendedorId);
    assert.equal((await admin.from("categorias_produto").select("id").eq("vendedor_id", temp.vendedorId)).data.length, 0);
  });
});

describe("baixar meus dados", () => {
  test("traz as categorias do menu e a categoria de cada item, só da própria loja", async () => {
    const c = await criar(ana, "Salgados");
    await criar(beto, "Segredo do Beto");
    await admin.from("itens_cardapio").update({ categoria_produto_id: c.data.id }).eq("id", itemAna);
    const { data, error } = await ana.client.rpc("exportar_meus_dados");
    assert.ifError(error);
    assert.deepEqual(data.categorias_do_menu, ["Salgados"]);
    assert.equal(data.menu.find((i) => i.nome === "Pastel de carne").categoria, "Salgados");
    assert.ok(!JSON.stringify(data).includes("Segredo do Beto"));
  });
});
