// Busca do catálogo e do menu: sem acento, sem maiúsculas, todas as palavras precisam aparecer (sem banco, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { casaComBusca, itemCasa, itensQueCasam, lojaCasa, normalizar } from "../../src/lib/busca.ts";

describe("normalizar", () => {
  test("tira acento, maiúsculas e espaços sobrando", () => {
    assert.equal(normalizar("  Açaí   do  ZÉ "), "acai do ze");
  });
  test("texto vazio continua vazio", () => assert.equal(normalizar("   "), ""));
});

describe("casaComBusca", () => {
  const casos = [
    ["sem acento acha com acento", "Açaí na tigela", "acai", true],
    ["com acento acha sem acento", "Acai na tigela", "açaí", true],
    ["maiúsculas não importam", "PASTEL de carne", "pastel", true],
    ["todas as palavras, em qualquer ordem", "Pastel de carne com queijo", "carne pastel", true],
    ["falta uma palavra: não casa", "Pastel de queijo", "pastel carne", false],
    ["parte da palavra casa", "Chocolate quente", "choco", true],
    ["busca vazia casa tudo", "qualquer coisa", "   ", true],
    ["nada a ver", "Marmita executiva", "chocolate", false],
  ];
  for (const [nome, texto, busca, esperado] of casos) {
    test(nome, () => assert.equal(casaComBusca(texto, busca), esperado));
  }
});

describe("itens do menu", () => {
  const itens = [
    { id: 1, nome: "Pastel de carne", descricao: null },
    { id: 2, nome: "Pastel de queijo", descricao: "Com orégano" },
    { id: 3, nome: "Brigadeiro", descricao: "Chocolate belga" },
    { id: 4, nome: "Suco de laranja", descricao: null },
  ];

  test("acha pelo nome", () => assert.deepEqual(itensQueCasam(itens, "pastel").map((i) => i.id), [1, 2]));
  test("acha pela descrição", () => assert.deepEqual(itensQueCasam(itens, "chocolate").map((i) => i.id), [3]));
  test("acha sem acento", () => assert.deepEqual(itensQueCasam(itens, "oregano").map((i) => i.id), [2]));
  test("sem resultado devolve lista vazia", () => assert.deepEqual(itensQueCasam(itens, "pizza"), []));
  test("itemCasa aceita descrição ausente", () => assert.equal(itemCasa({ nome: "Coxinha" }, "coxinha"), true));
});

describe("lojaCasa", () => {
  const loja = {
    nome: "Lanchonete da Esquina",
    descricao: "Lanches artesanais",
    itens_cardapio: [{ nome: "Pastel de carne", descricao: null }, { nome: "Brigadeiro", descricao: "Chocolate belga" }],
  };

  test("modo loja: só o nome conta (não a descrição nem o menu)", () => {
    assert.equal(lojaCasa(loja, "esquina", "loja"), true);
    assert.equal(lojaCasa(loja, "artesanais", "loja"), false);
    assert.equal(lojaCasa(loja, "pastel", "loja"), false);
  });
  test("modo produto: só o menu conta (não o nome da loja)", () => {
    assert.equal(lojaCasa(loja, "pastel", "produto"), true);
    assert.equal(lojaCasa(loja, "chocolate", "produto"), true);
    assert.equal(lojaCasa(loja, "esquina", "produto"), false);
  });
  test("modo tudo: nome, descrição ou menu", () => {
    assert.equal(lojaCasa(loja, "esquina", "tudo"), true);
    assert.equal(lojaCasa(loja, "artesanais", "tudo"), true);
    assert.equal(lojaCasa(loja, "pastel", "tudo"), true);
    assert.equal(lojaCasa(loja, "pizza", "tudo"), false);
  });
  test("busca vazia mostra todas as lojas, até as sem menu", () => {
    assert.equal(lojaCasa({ nome: "Sem menu" }, "", "produto"), true);
  });
});
