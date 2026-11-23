// Categorias de produto: seções do menu, opções do filtro do catálogo e busca por tipo de produto (sem banco, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { agruparPorCategoria, categoriasEmUso, opcoesDeCategoria, SUGESTOES_DE_CATEGORIA } from "../../src/lib/categoriasProduto.ts";
import { buscarNaLoja } from "../../src/lib/busca.ts";

const cat = (nome, chave, ordem = 0) => ({ id: `id-${chave}`, nome, chave, ordem });
const BEBIDA = cat("Bebidas", "bebida", 2);
const SALGADO = cat("Salgados", "salgado", 1);
const DOCE = cat("Doces", "doce", 3);
const item = (nome, categoria = null, descricao = null) => ({ nome, descricao, categoria });

describe("agruparPorCategoria", () => {
  test("loja sem categorias: uma seção só, sem título", () => {
    const r = agruparPorCategoria([item("A"), item("B")]);
    assert.equal(r.length, 1);
    assert.equal(r[0].categoria, null);
    assert.equal(r[0].itens.length, 2);
  });
  test("menu vazio: nenhuma seção", () => assert.deepEqual(agruparPorCategoria([]), []));
  test("seções na ordem definida pelo vendedor, itens sem categoria no fim", () => {
    const r = agruparPorCategoria([item("Suco", BEBIDA), item("Pastel", SALGADO), item("Brigadeiro", DOCE), item("Brinde"), item("Coxinha", SALGADO)]);
    assert.deepEqual(r.map((s) => s.categoria?.nome ?? "Outros"), ["Salgados", "Bebidas", "Doces", "Outros"]);
    assert.deepEqual(r[0].itens.map((i) => i.nome), ["Pastel", "Coxinha"]);
  });
  test("mesma ordem: desempata pelo nome", () => {
    const r = agruparPorCategoria([item("x", cat("Zeta", "zeta", 1)), item("y", cat("Alfa", "alfa", 1))]);
    assert.deepEqual(r.map((s) => s.categoria.nome), ["Alfa", "Zeta"]);
  });
  test("categoriasEmUso lista só as que têm item, na ordem", () => {
    assert.deepEqual(categoriasEmUso([item("Suco", BEBIDA), item("Pastel", SALGADO), item("Sem")]).map((c) => c.nome), ["Salgados", "Bebidas"]);
    assert.deepEqual(categoriasEmUso([item("Sem")]), []);
  });
});

describe("opcoesDeCategoria (filtro do catálogo)", () => {
  const lojas = [
    { itens_cardapio: [item("Suco", cat("Bebidas", "bebida")), item("Refri", cat("Bebidas", "bebida")), item("Pastel", cat("Salgados", "salgado"))] },
    { itens_cardapio: [item("Água", cat("bebida", "bebida")), item("Xis", cat("Xis", "xis"))] },
    { itens_cardapio: [item("Sem categoria")] },
    { itens_cardapio: [item("Suco", cat("Bebidas", "bebida"))] },
  ];
  test("junta categorias de lojas diferentes pela chave e conta lojas (não itens)", () => {
    const r = opcoesDeCategoria(lojas);
    assert.deepEqual(r.find((o) => o.chave === "bebida"), { chave: "bebida", nome: "Bebidas", lojas: 3 });
    assert.equal(r.find((o) => o.chave === "salgado").lojas, 1);
  });
  test("o nome mostrado é o mais usado; as mais presentes vêm primeiro; empate por ordem alfabética", () => {
    const r = opcoesDeCategoria(lojas);
    assert.deepEqual(r.map((o) => o.chave), ["bebida", "salgado", "xis"]);
  });
  test("categoria sem produto não aparece, e sem categorias a lista é vazia", () => {
    assert.deepEqual(opcoesDeCategoria([{ categorias_produto: [cat("Vazia", "vazia")], itens_cardapio: [item("A")] }]), []);
    assert.deepEqual(opcoesDeCategoria([]), []);
  });
});

describe("buscarNaLoja", () => {
  const esquina = {
    nome: "Lanchonete da Esquina",
    descricao: "Lanches artesanais",
    itens_cardapio: [
      item("Cheeseburger", cat("Lanches", "lanche")),
      item("Suco de laranja", BEBIDA),
      item("Refrigerante", BEBIDA),
      item("Pastel de carne", SALGADO),
    ],
  };
  const semCategorias = { nome: "Tia Fran", itens_cardapio: [item("Suco de uva"), item("Coxinha")] };

  test("sem categoria escolhida: o comportamento de sempre", () => {
    assert.deepEqual(buscarNaLoja(esquina, "pastel", "tudo", "").itens.map((i) => i.nome), ["Pastel de carne"]);
    assert.equal(buscarNaLoja(esquina, "", "tudo", "").itens.length, 0);
    assert.equal(buscarNaLoja(esquina, "pizza", "tudo", "").passa, false);
    assert.equal(buscarNaLoja(esquina, "esquina", "loja", "").itens.length, 0);
  });
  test("só a categoria: mostra os produtos dela", () => {
    const r = buscarNaLoja(esquina, "", "tudo", "bebida");
    assert.equal(r.passa, true);
    assert.deepEqual(r.itens.map((i) => i.nome), ["Suco de laranja", "Refrigerante"]);
  });
  test("loja sem produto na categoria (ou sem categorias) não passa", () => {
    assert.equal(buscarNaLoja(esquina, "", "tudo", "doce").passa, false);
    assert.equal(buscarNaLoja(semCategorias, "", "tudo", "bebida").passa, false);
  });
  test("texto + categoria: o MESMO item precisa bater com os dois", () => {
    const r = buscarNaLoja(esquina, "suco", "produto", "bebida");
    assert.deepEqual(r.itens.map((i) => i.nome), ["Suco de laranja"]);
    // "pastel" existe na loja e "bebida" também, mas não no mesmo item
    assert.equal(buscarNaLoja(esquina, "pastel", "produto", "bebida").passa, false);
    assert.equal(buscarNaLoja(esquina, "pastel", "tudo", "bebida").passa, false);
  });
  test("modo Tudo: o texto também pode ser o nome da loja (mostra as bebidas dela)", () => {
    const r = buscarNaLoja(esquina, "esquina", "tudo", "bebida");
    assert.equal(r.passa, true);
    assert.equal(r.itens.length, 2);
    assert.equal(buscarNaLoja(esquina, "esquina", "produto", "bebida").passa, false);
  });
  test("modo Nome da loja: o texto vale para o nome e a categoria para os produtos", () => {
    assert.equal(buscarNaLoja(esquina, "esquina", "loja", "bebida").passa, true);
    assert.equal(buscarNaLoja(esquina, "tia fran", "loja", "bebida").passa, false);
    assert.equal(buscarNaLoja(esquina, "esquina", "loja", "doce").passa, false);
  });
  test("sem acento e sem maiúsculas", () => {
    assert.equal(buscarNaLoja(esquina, "SUCO", "produto", "bebida").itens.length, 1);
  });
});

describe("sugestões", () => {
  test("há sugestões e nenhuma repete", () => {
    assert.ok(SUGESTOES_DE_CATEGORIA.length >= 5);
    assert.equal(new Set(SUGESTOES_DE_CATEGORIA.map((s) => s.toLowerCase())).size, SUGESTOES_DE_CATEGORIA.length);
  });
});
