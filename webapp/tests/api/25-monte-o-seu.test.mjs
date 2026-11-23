// "Monte o seu" (pizza, açaí...): tamanhos de preço fixo, escolhas incluídas (sabores) com máximo por tamanho e adicionais pagos.
// Quem decide o preço e confere os limites é o banco; o cliente manda só ids.

import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, zerarLimites } from "../helpers.mjs";

const ctx = new Contexto();
let loja; // aceita pedidos, aberta o dia todo
let outra;
let adm;
let salgadas; // categorias do menu
let doces;
let bebidas;
let calabresa, frango, mussarela, brigadeiro, refri, deOutra;
let pizza; // produto montável
let media, grande, broto;
let borda, bacon, ovo;

const tel = (n = 1) => `(11) 9${String(80000000 + n).padStart(8, "0")}`;
const brl = (n) => Math.round(n * 100) / 100;

const montagem = (extra = {}) => ({
  montavel_id: pizza,
  tamanho_id: media,
  escolhas: [calabresa, frango],
  adicionais: [],
  quantidade: 1,
  ...extra,
});

const pedir = (itens, extra = {}, cliente = anonimo()) =>
  cliente.rpc("criar_pedido", {
    p_vendedor: loja.vendedorId,
    p_itens: itens,
    p_modo: "retirada",
    p_nome: "Maria da Silva",
    p_telefone: tel(1),
    p_endereco: null,
    p_pagamento: "pix",
    p_troco: null,
    p_observacoes: null,
    ...extra,
  });
const ok = async (itens, extra) => {
  const { data, error } = await pedir(itens, extra);
  assert.ifError(error);
  return data;
};
const recusa = async (itens, codigo, extra) => {
  const { data, error } = await pedir(itens, extra);
  assert.ok(error, `deveria recusar (${codigo})`);
  assert.match(error.message, new RegExp(codigo), `esperava ${codigo}, veio: ${error.message}`);
  assert.ok(!data);
};
const pedidoDoBanco = async (numero) =>
  (await admin.from("pedidos").select("*, pedido_itens(*)").eq("vendedor_id", loja.vendedorId).eq("numero", numero).single()).data;

const horarioTodoDia = async (vendedorId) => {
  await admin.from("horarios_funcionamento").delete().eq("vendedor_id", vendedorId);
  const { error } = await admin
    .from("horarios_funcionamento")
    .insert(Array.from({ length: 7 }, (_, dia) => ({ vendedor_id: vendedorId, dia_semana: dia, abre: "00:00", fecha: "00:00" })));
  assert.ifError(error);
};

async function prepararProduto() {
  await admin.from("montaveis").delete().eq("vendedor_id", loja.vendedorId);
  const { data: m } = await admin
    .from("montaveis")
    .insert({ vendedor_id: loja.vendedorId, nome: "Pizza", rotulo_escolhas: "Sabores", max_adicionais: 2 })
    .select("id")
    .single();
  pizza = m.id;
  const { data: t } = await admin
    .from("montavel_tamanhos")
    .insert([
      { montavel_id: pizza, nome: "Média (30 cm)", preco: 54, max_escolhas: 2 },
      { montavel_id: pizza, nome: "Grande (35 cm)", preco: 62, max_escolhas: 3 },
      { montavel_id: pizza, nome: "Broto", preco: 30, max_escolhas: 0 },
    ])
    .select("id, nome");
  media = t.find((x) => x.nome.startsWith("Média")).id;
  grande = t.find((x) => x.nome.startsWith("Grande")).id;
  broto = t.find((x) => x.nome === "Broto").id;
  const { data: a } = await admin
    .from("montavel_adicionais")
    .insert([
      { montavel_id: pizza, nome: "Borda recheada", preco: 10 },
      { montavel_id: pizza, nome: "Bacon", preco: 3 },
      { montavel_id: pizza, nome: "Ovo", preco: 2 },
    ])
    .select("id, nome");
  borda = a.find((x) => x.nome === "Borda recheada").id;
  bacon = a.find((x) => x.nome === "Bacon").id;
  ovo = a.find((x) => x.nome === "Ovo").id;
  const { error } = await admin.from("montavel_categorias").insert([
    { montavel_id: pizza, categoria_produto_id: salgadas },
    { montavel_id: pizza, categoria_produto_id: doces },
  ]);
  assert.ifError(error);
}

before(async () => {
  loja = await ctx.novoVendedor({ aprovado: true });
  outra = await ctx.novoVendedor({ aprovado: true });
  adm = await ctx.novoVendedor({ aprovado: true, ehAdmin: true });
  await admin.from("vendedores").update({ aceita_pedidos: true, taxa_entrega: 5 }).eq("id", loja.vendedorId);
  await horarioTodoDia(loja.vendedorId);

  const { data: cats } = await admin
    .from("categorias_produto")
    .insert([
      { vendedor_id: loja.vendedorId, nome: "Pizzas salgadas" },
      { vendedor_id: loja.vendedorId, nome: "Pizzas doces" },
      { vendedor_id: loja.vendedorId, nome: "Bebidas" },
      { vendedor_id: outra.vendedorId, nome: "Pizzas" },
    ])
    .select("id, vendedor_id, nome");
  salgadas = cats.find((c) => c.nome === "Pizzas salgadas").id;
  doces = cats.find((c) => c.nome === "Pizzas doces").id;
  bebidas = cats.find((c) => c.nome === "Bebidas").id;
  const catDaOutra = cats.find((c) => c.vendedor_id === outra.vendedorId).id;

  const { data: itens } = await admin
    .from("itens_cardapio")
    .insert([
      { vendedor_id: loja.vendedorId, nome: "Calabresa", preco: null, categoria_produto_id: salgadas, ordem: 1 },
      { vendedor_id: loja.vendedorId, nome: "Frango com catupiry", preco: null, categoria_produto_id: salgadas, ordem: 2 },
      { vendedor_id: loja.vendedorId, nome: "Mussarela", preco: null, categoria_produto_id: salgadas, ordem: 3 },
      { vendedor_id: loja.vendedorId, nome: "Brigadeiro", preco: null, categoria_produto_id: doces, ordem: 4 },
      { vendedor_id: loja.vendedorId, nome: "Refrigerante", preco: 7, categoria_produto_id: bebidas, ordem: 5 },
      { vendedor_id: outra.vendedorId, nome: "Portuguesa", preco: null, categoria_produto_id: catDaOutra, ordem: 1 },
    ])
    .select("id, nome");
  const id = (nome) => itens.find((i) => i.nome === nome).id;
  calabresa = id("Calabresa");
  frango = id("Frango com catupiry");
  mussarela = id("Mussarela");
  brigadeiro = id("Brigadeiro");
  refri = id("Refrigerante");
  deOutra = id("Portuguesa");
});
beforeEach(async () => {
  await zerarLimites();
  await admin.from("pedidos").delete().eq("vendedor_id", loja.vendedorId);
  await admin.from("clientes_bloqueados").delete().eq("vendedor_id", loja.vendedorId);
  await admin.from("itens_cardapio").update({ disponivel: true, indisponivel_ate: null }).eq("vendedor_id", loja.vendedorId);
  await admin
    .from("vendedores")
    .update({ aceita_pedidos: true, taxa_entrega: 5, modo_atendimento: "ambos", pagamentos_aceitos: ["pix", "dinheiro", "cartao"], status_manual: "normal", status_manual_ate: null, ativo: true })
    .eq("id", loja.vendedorId);
  await prepararProduto();
});
after(async () => {
  await admin.from("pedidos").delete().in("vendedor_id", [loja.vendedorId, outra.vendedorId]);
  await ctx.limpar();
});

describe("o vendedor monta o produto (regras do cadastro)", () => {
  const dono = () => loja.client;

  test("cria produto, tamanho e adicional; o banco limpa os nomes e põe na ordem", async () => {
    const { data: m, error } = await dono().from("montaveis").insert({ vendedor_id: loja.vendedorId, nome: "  Açaí   da   casa ", rotulo_escolhas: " Acompanhamentos " }).select("*").single();
    assert.ifError(error);
    assert.equal(m.nome, "Açaí da casa");
    assert.equal(m.rotulo_escolhas, "Acompanhamentos");
    assert.equal(m.escolha_obrigatoria, true);
    assert.equal(m.max_adicionais, 5);
    assert.equal(m.disponivel, true);

    const { data: t } = await dono().from("montavel_tamanhos").insert({ montavel_id: m.id, nome: " 300 ml ", preco: 15.5, max_escolhas: 3 }).select("*").single();
    assert.equal(t.nome, "300 ml");
    const { data: t2 } = await dono().from("montavel_tamanhos").insert({ montavel_id: m.id, nome: "500 ml", preco: 21 }).select("*").single();
    assert.ok(t2.ordem > t.ordem, "o tamanho novo vai para o fim");
    assert.equal(t2.max_escolhas, 1, "padrão: 1 escolha");

    const { data: a } = await dono().from("montavel_adicionais").insert({ montavel_id: m.id, nome: "Granola" }).select("*").single();
    assert.equal(Number(a.preco), 0, "sem preço = sem custo");
  });

  test("limites: 5 produtos por loja, 6 tamanhos por produto, 30 adicionais por produto", async () => {
    // já existe a Pizza do beforeEach
    for (let i = 2; i <= 5; i++) {
      const { error } = await dono().from("montaveis").insert({ vendedor_id: loja.vendedorId, nome: `Produto ${i}` });
      assert.ifError(error);
    }
    const { error: sexto } = await dono().from("montaveis").insert({ vendedor_id: loja.vendedorId, nome: "Produto 6" });
    assert.match(sexto.message, /limite_montaveis/);

    for (let i = 4; i <= 6; i++) {
      const { error } = await dono().from("montavel_tamanhos").insert({ montavel_id: pizza, nome: `Tam ${i}`, preco: 10 + i });
      assert.ifError(error);
    }
    const { error: setimo } = await dono().from("montavel_tamanhos").insert({ montavel_id: pizza, nome: "Tam 7", preco: 99 });
    assert.match(setimo.message, /limite_tamanhos/);

    await admin.from("montavel_adicionais").insert(Array.from({ length: 27 }, (_, i) => ({ montavel_id: pizza, nome: `Extra ${i}` })));
    const { error: trinta1 } = await dono().from("montavel_adicionais").insert({ montavel_id: pizza, nome: "Extra demais" });
    assert.match(trinta1.message, /limite_adicionais/);
  });

  test("valores inválidos são recusados", async () => {
    const tam = (dados) => dono().from("montavel_tamanhos").insert({ montavel_id: pizza, nome: "X", preco: 10, ...dados });
    assert.ok((await tam({ preco: 0 })).error, "preço zero");
    assert.ok((await tam({ preco: -5 })).error, "preço negativo");
    assert.ok((await tam({ preco: 2500 })).error, "preço absurdo");
    assert.ok((await tam({ max_escolhas: -1 })).error);
    assert.ok((await tam({ max_escolhas: 11 })).error);
    assert.ok((await tam({ nome: "" })).error);
    assert.ok((await tam({ nome: "Veja www.golpe.com" })).error, "link no nome");

    const add = (dados) => dono().from("montavel_adicionais").insert({ montavel_id: pizza, nome: "Y", ...dados });
    assert.ok((await add({ preco: -1 })).error);
    assert.ok((await add({ preco: 501 })).error);
    assert.ok((await add({ nome: "fale@comigo.com" })).error, "e-mail no nome");

    const prod = (dados) => dono().from("montaveis").insert({ vendedor_id: loja.vendedorId, nome: "Z", ...dados });
    await admin.from("montaveis").delete().eq("vendedor_id", loja.vendedorId);
    assert.ok((await prod({ nome: "A" })).error, "nome curto demais");
    assert.ok((await prod({ max_adicionais: 21 })).error);
    assert.ok((await prod({ max_adicionais: -1 })).error);
    assert.ok((await prod({ descricao: "x".repeat(201) })).error);
    assert.ok((await prod({ rotulo_escolhas: "https://golpe.com" })).error);
  });

  test("cada loja mexe só nos seus produtos", async () => {
    const intruso = outra.client;
    const { error: criar } = await intruso.from("montaveis").insert({ vendedor_id: loja.vendedorId, nome: "Invasor" });
    assert.ok(criar, "criar produto em loja alheia");

    const { error: tamanho } = await intruso.from("montavel_tamanhos").insert({ montavel_id: pizza, nome: "Invasor", preco: 1 });
    assert.ok(tamanho, "criar tamanho em produto alheio");

    await intruso.from("montavel_tamanhos").update({ preco: 1 }).eq("id", media);
    await intruso.from("montavel_adicionais").delete().eq("id", bacon);
    await intruso.from("montaveis").update({ nome: "Sequestrado" }).eq("id", pizza);
    await intruso.from("montaveis").delete().eq("id", pizza);

    const { data: t } = await admin.from("montavel_tamanhos").select("preco").eq("id", media).single();
    assert.equal(Number(t.preco), 54, "o preço não mudou");
    const { data: p } = await admin.from("montaveis").select("nome").eq("id", pizza).single();
    assert.equal(p.nome, "Pizza");
    const { count } = await admin.from("montavel_adicionais").select("id", { count: "exact", head: true }).eq("montavel_id", pizza);
    assert.equal(count, 3);
  });

  test("as escolhas só podem vir de categorias da própria loja", async () => {
    const { data: deOutraLoja } = await admin.from("categorias_produto").select("id").eq("vendedor_id", outra.vendedorId).single();
    const { error } = await loja.client.from("montavel_categorias").insert({ montavel_id: pizza, categoria_produto_id: deOutraLoja.id });
    assert.ok(error);
    assert.match(error.message, /categoria_invalida/);
    const { error: certa } = await loja.client.from("montavel_categorias").insert({ montavel_id: pizza, categoria_produto_id: bebidas });
    assert.ifError(certa);
  });

  test("visitante vê os produtos de loja no ar, mas não os de loja desativada", async () => {
    const visitante = anonimo();
    const { data: visto } = await visitante.from("montaveis").select("id, tamanhos:montavel_tamanhos(id), adicionais:montavel_adicionais(id)").eq("vendedor_id", loja.vendedorId);
    assert.equal(visto.length, 1);
    assert.equal(visto[0].tamanhos.length, 3);
    assert.equal(visto[0].adicionais.length, 3);

    await admin.from("vendedores").update({ ativo: false }).eq("id", loja.vendedorId);
    const { data: escondido } = await visitante.from("montaveis").select("id").eq("vendedor_id", loja.vendedorId);
    assert.equal(escondido.length, 0);
    const { data: tamanhos } = await visitante.from("montavel_tamanhos").select("id").eq("montavel_id", pizza);
    assert.equal(tamanhos.length, 0);
    const { data: doDono } = await loja.client.from("montaveis").select("id").eq("vendedor_id", loja.vendedorId);
    assert.equal(doDono.length, 1, "o dono continua vendo");
    await admin.from("vendedores").update({ ativo: true }).eq("id", loja.vendedorId);
  });

  test("visitante não escreve nada", async () => {
    const visitante = anonimo();
    assert.ok((await visitante.from("montaveis").insert({ vendedor_id: loja.vendedorId, nome: "Anônimo" })).error);
    await visitante.from("montavel_tamanhos").update({ preco: 1 }).eq("id", media);
    await visitante.from("montavel_adicionais").delete().eq("montavel_id", pizza);
    const { data: t } = await admin.from("montavel_tamanhos").select("preco").eq("id", media).single();
    assert.equal(Number(t.preco), 54);
    const { count } = await admin.from("montavel_adicionais").select("id", { count: "exact", head: true }).eq("montavel_id", pizza);
    assert.equal(count, 3);
  });

  test("o administrador mexe em qualquer produto", async () => {
    const { error } = await adm.client.from("montavel_tamanhos").update({ nome: "Média revisada" }).eq("id", media);
    assert.ifError(error);
    const { data } = await admin.from("montavel_tamanhos").select("nome").eq("id", media).single();
    assert.equal(data.nome, "Média revisada");
  });

  test("apagar o produto leva tamanhos, adicionais e vínculos; os itens do menu ficam", async () => {
    await loja.client.from("montaveis").delete().eq("id", pizza);
    for (const tabela of ["montavel_tamanhos", "montavel_adicionais", "montavel_categorias"]) {
      const { count } = await admin.from(tabela).select("*", { count: "exact", head: true }).eq("montavel_id", pizza);
      assert.equal(count, 0, tabela);
    }
    const { count: itens } = await admin.from("itens_cardapio").select("id", { count: "exact", head: true }).in("id", [calabresa, frango, mussarela, brigadeiro]);
    assert.equal(itens, 4);
  });

  test("apagar a categoria só desfaz o vínculo", async () => {
    const { data: temporaria } = await admin.from("categorias_produto").insert({ vendedor_id: loja.vendedorId, nome: "Temporária" }).select("id").single();
    await admin.from("montavel_categorias").insert({ montavel_id: pizza, categoria_produto_id: temporaria.id });
    await admin.from("categorias_produto").delete().eq("id", temporaria.id);
    const { data } = await admin.from("montavel_categorias").select("categoria_produto_id").eq("montavel_id", pizza);
    assert.deepEqual(data.map((d) => d.categoria_produto_id).sort(), [salgadas, doces].sort());
  });

  test("a mudança de produto entra no histórico", async () => {
    await loja.client.from("montaveis").update({ disponivel: false }).eq("id", pizza);
    const { data } = await admin.from("historico").select("acao").eq("entidade", "montaveis").eq("entidade_id", pizza);
    assert.ok(data.some((h) => h.acao === "update"));
  });

  test("'Baixar meus dados' inclui os produtos montáveis", async () => {
    const { data, error } = await loja.client.rpc("exportar_meus_dados");
    assert.ifError(error);
    const produto = data.monte_o_seu.find((p) => p.nome === "Pizza");
    assert.ok(produto);
    assert.deepEqual(produto.tamanhos.map((t) => t.nome), ["Média (30 cm)", "Grande (35 cm)", "Broto"]);
    assert.equal(produto.adicionais.length, 3);
    assert.deepEqual(produto.categorias_das_escolhas.sort(), ["Pizzas doces", "Pizzas salgadas"]);
  });
});

describe("pedido com produto montado: o preço é do tamanho", () => {
  test("a média custa R$ 54 qualquer que seja o sabor", async () => {
    const a = await ok([montagem({ escolhas: [calabresa, frango] })]);
    assert.equal(Number(a.total), 54);
    const b = await ok([montagem({ escolhas: [calabresa, brigadeiro] })], { p_telefone: tel(2) });
    assert.equal(Number(b.total), 54, "salgado + doce, mesmo preço");
    const c = await ok([montagem({ escolhas: [mussarela] })], { p_telefone: tel(3) });
    assert.equal(Number(c.total), 54, "um sabor só, mesmo preço");
  });

  test("a grande custa R$ 62 com até 3 sabores", async () => {
    const r = await ok([montagem({ tamanho_id: grande, escolhas: [calabresa, frango, mussarela] })]);
    assert.equal(Number(r.subtotal), 62);
  });

  test("o pedido guarda nome, preço e escolhas 'congelados'", async () => {
    const r = await ok([montagem({ escolhas: [frango, calabresa], adicionais: [borda] })]);
    assert.equal(Number(r.total), 64);
    const p = await pedidoDoBanco(r.numero);
    assert.equal(p.pedido_itens.length, 1);
    const i = p.pedido_itens[0];
    assert.equal(i.nome, "Pizza Média (30 cm)");
    assert.equal(Number(i.preco_unit), 64);
    assert.equal(i.montavel_id, pizza);
    assert.equal(i.item_id, null);
    assert.deepEqual(i.detalhes, [
      { rotulo: "Sabores", opcoes: [{ nome: "Calabresa" }, { nome: "Frango com catupiry" }] }, // na ordem do menu, não na que o cliente clicou
      { rotulo: "Adicionais", opcoes: [{ nome: "Borda recheada", preco: 10 }] },
    ]);

    // mudar o preço depois não mexe no pedido
    await admin.from("montavel_tamanhos").update({ preco: 99 }).eq("id", media);
    await admin.from("itens_cardapio").update({ nome: "Calabresa nova" }).eq("id", calabresa);
    const depois = await pedidoDoBanco(r.numero);
    assert.equal(Number(depois.pedido_itens[0].preco_unit), 64);
    assert.equal(depois.pedido_itens[0].detalhes[0].opcoes[0].nome, "Calabresa");
  });

  test("adicionais somam ao tamanho", async () => {
    const um = await ok([montagem({ adicionais: [bacon] })]);
    assert.equal(Number(um.total), 57);
    const dois = await ok([montagem({ adicionais: [borda, bacon] })], { p_telefone: tel(2) });
    assert.equal(Number(dois.total), 67);
  });

  test("quantidade multiplica; duas montagens iguais ou diferentes viram linhas separadas", async () => {
    const r = await ok([
      montagem({ quantidade: 2 }),
      montagem({ tamanho_id: grande, escolhas: [mussarela], adicionais: [ovo] }),
      montagem({ tamanho_id: grande, escolhas: [mussarela], adicionais: [ovo] }),
    ]);
    assert.equal(Number(r.subtotal), brl(2 * 54 + 2 * 64));
    const p = await pedidoDoBanco(r.numero);
    assert.equal(p.pedido_itens.length, 3);
  });

  test("mistura com itens comuns, taxa de entrega e troco", async () => {
    const r = await ok([montagem(), { item_id: refri, quantidade: 2 }], { p_modo: "entrega", p_endereco: "Rua das Flores, 100, Centro", p_pagamento: "dinheiro", p_troco: 100 });
    assert.equal(Number(r.subtotal), 54 + 14);
    assert.equal(Number(r.taxa_entrega), 5);
    assert.equal(Number(r.total), 73);
    assert.equal(r.tem_item_sob_consulta, false);
  });

  test("tamanho que não inclui escolhas (Broto) vai sem sabores", async () => {
    const r = await ok([montagem({ tamanho_id: broto, escolhas: [] })]);
    assert.equal(Number(r.total), 30);
    const p = await pedidoDoBanco(r.numero);
    assert.deepEqual(p.pedido_itens[0].detalhes, []);
    await recusa([montagem({ tamanho_id: broto, escolhas: [calabresa] })], "montagem_invalida");
  });

  test("o preço que o cliente mandar é ignorado", async () => {
    const r = await ok([{ ...montagem(), preco: 1, preco_unit: 1, total: 1 }], { p_troco: null });
    assert.equal(Number(r.total), 54);
  });

  test("o cliente que acompanha vê os detalhes", async () => {
    const r = await ok([montagem({ adicionais: [bacon] })]);
    const { data } = await anonimo().rpc("pedido_por_token", { p_token: r.token });
    assert.equal(data.itens.length, 1);
    assert.equal(data.itens[0].nome, "Pizza Média (30 cm)");
    assert.equal(Number(data.itens[0].preco_unit), 57);
    assert.equal(data.itens[0].detalhes[0].rotulo, "Sabores");
    assert.deepEqual(data.itens[0].detalhes[1].opcoes, [{ nome: "Bacon", preco: 3 }]);
  });

  test("a loja lê os detalhes; outra loja não lê o pedido", async () => {
    const r = await ok([montagem()]);
    const { data } = await loja.client.from("pedidos").select("numero, pedido_itens(nome, detalhes)").eq("numero", r.numero).single();
    assert.equal(data.pedido_itens[0].detalhes[0].opcoes.length, 2);
    const { data: alheio } = await outra.client.from("pedido_itens").select("id").eq("montavel_id", pizza);
    assert.equal(alheio.length, 0);
  });

  test("escolha opcional: o produto sem 'obrigatória' aceita zero sabores", async () => {
    await admin.from("montaveis").update({ escolha_obrigatoria: false }).eq("id", pizza);
    const r = await ok([montagem({ escolhas: [] })]);
    assert.equal(Number(r.total), 54);
  });
});

describe("pedido com produto montado: o banco recusa o que não vale", () => {
  test("mais sabores que o tamanho aceita", async () => {
    await recusa([montagem({ escolhas: [calabresa, frango, mussarela] })], "montagem_invalida"); // média aceita 2
    await recusa([montagem({ tamanho_id: grande, escolhas: [calabresa, frango, mussarela, brigadeiro] })], "montagem_invalida"); // grande aceita 3
  });

  test("nenhum sabor quando a escolha é obrigatória", async () => {
    await recusa([montagem({ escolhas: [] })], "montagem_invalida");
  });

  test("sabor repetido, adicional repetido", async () => {
    await recusa([montagem({ escolhas: [calabresa, calabresa] })], "montagem_invalida");
    await recusa([montagem({ adicionais: [bacon, bacon] })], "montagem_invalida");
  });

  test("mais adicionais que o máximo do produto", async () => {
    await recusa([montagem({ adicionais: [borda, bacon, ovo] })], "montagem_invalida"); // máximo 2
    await admin.from("montaveis").update({ max_adicionais: 0 }).eq("id", pizza);
    await recusa([montagem({ adicionais: [bacon] })], "montagem_invalida");
  });

  test("sabor fora das categorias marcadas, de outra loja ou que não existe", async () => {
    await recusa([montagem({ escolhas: [refri] })], "montagem_indisponivel"); // Bebidas não está nas categorias do produto
    await recusa([montagem({ escolhas: [deOutra] })], "montagem_indisponivel");
    await recusa([montagem({ escolhas: ["00000000-0000-4000-8000-000000000000"] })], "montagem_indisponivel");
  });

  test("sabor indisponível não entra; 'indisponível até ontem' já voltou", async () => {
    await admin.from("itens_cardapio").update({ disponivel: false }).eq("id", calabresa);
    await recusa([montagem({ escolhas: [calabresa] })], "montagem_indisponivel");
    await admin.from("itens_cardapio").update({ disponivel: false, indisponivel_ate: "2000-01-01" }).eq("id", calabresa);
    await ok([montagem({ escolhas: [calabresa] })]);
  });

  test("adicional em falta", async () => {
    await admin.from("montavel_adicionais").update({ disponivel: false }).eq("id", bacon);
    await recusa([montagem({ adicionais: [bacon] })], "montagem_indisponivel");
  });

  test("produto pausado, tamanho de outro produto, produto de outra loja", async () => {
    const { data: outro } = await admin.from("montaveis").insert({ vendedor_id: loja.vendedorId, nome: "Açaí" }).select("id").single();
    const { data: tamanhoDoOutro } = await admin.from("montavel_tamanhos").insert({ montavel_id: outro.id, nome: "300 ml", preco: 15 }).select("id").single();
    await recusa([montagem({ tamanho_id: tamanhoDoOutro.id })], "montagem_indisponivel");

    const { data: alheio } = await admin.from("montaveis").insert({ vendedor_id: outra.vendedorId, nome: "Pizza da outra" }).select("id").single();
    const { data: tamanhoAlheio } = await admin.from("montavel_tamanhos").insert({ montavel_id: alheio.id, nome: "Média", preco: 1 }).select("id").single();
    await recusa([montagem({ montavel_id: alheio.id, tamanho_id: tamanhoAlheio.id, escolhas: [] })], "montagem_indisponivel");

    await admin.from("montaveis").update({ disponivel: false }).eq("id", pizza);
    await recusa([montagem()], "montagem_indisponivel");
  });

  test("formato quebrado", async () => {
    await recusa([montagem({ montavel_id: "lixo" })], "montagem_invalida");
    await recusa([montagem({ tamanho_id: null })], "montagem_invalida");
    await recusa([montagem({ escolhas: "calabresa" })], "montagem_invalida");
    await recusa([montagem({ escolhas: [123] })], "montagem_invalida");
    await recusa([montagem({ adicionais: { a: 1 } })], "montagem_invalida");
    await recusa([montagem({ escolhas: Array.from({ length: 11 }, () => calabresa) })], "montagem_invalida");
  });

  test("quantidade inválida e linhas demais", async () => {
    await recusa([montagem({ quantidade: 0 })], "itens_invalidos");
    await recusa([montagem({ quantidade: 21 })], "itens_invalidos");
    await recusa([montagem({ quantidade: "muitas" })], "itens_invalidos");
    await recusa([montagem({ quantidade: null })], "itens_invalidos");
    await recusa(Array.from({ length: 31 }, () => montagem()), "itens_invalidos");
    await recusa([], "itens_invalidos");
    await recusa("pizza", "itens_invalidos");
  });

  test("a linha sem 'item_id' nem 'montavel_id' não vale; o item comum repetido continua recusado", async () => {
    await recusa([{ quantidade: 1 }], "itens_invalidos");
    await recusa([{ item_id: refri, quantidade: 1 }, { item_id: refri, quantidade: 1 }], "itens_invalidos");
    await recusa([{ item_id: "lixo", quantidade: 1 }], "itens_invalidos");
    await recusa([{ item_id: deOutra, quantidade: 1 }], "item_indisponivel");
  });

  test("o valor máximo do pedido vale também para montagens", async () => {
    await admin.from("montavel_tamanhos").update({ preco: 600 }).eq("id", grande);
    await recusa(Array.from({ length: 9 }, () => montagem({ tamanho_id: grande, escolhas: [calabresa] })), "pedido_grande");
  });

  test("as regras de sempre continuam: loja fechada, sem login de dono, telefone", async () => {
    await admin.from("vendedores").update({ status_manual: "ferias" }).eq("id", loja.vendedorId);
    await recusa([montagem()], "loja_fechada");
    await admin.from("vendedores").update({ status_manual: "normal" }).eq("id", loja.vendedorId);
    await recusa([montagem()], "telefone_invalido", { p_telefone: "123" });
    const { error } = await pedir([montagem()], {}, loja.client);
    assert.match(error.message, /loja_propria/);
  });
});

describe("o item sem preço que é só sabor", () => {
  test("a tela não o oferece sozinho, mas se alguém pedir o banco o trata como 'sob consulta', como qualquer item sem preço", async () => {
    const r = await ok([{ item_id: calabresa, quantidade: 1 }]);
    assert.equal(r.tem_item_sob_consulta, true);
    assert.equal(Number(r.total), 0);
  });
});
