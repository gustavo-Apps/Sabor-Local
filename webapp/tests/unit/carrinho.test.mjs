// Carrinho do pedido pelo site (sem navegador, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  chaveDoCarrinho,
  definirQuantidade,
  itensParaEnviar,
  LINHAS_MAXIMAS,
  lerCarrinho,
  linhasDoCarrinho,
  QUANTIDADE_MAXIMA,
  totalDeUnidades,
} from "../../src/lib/carrinho.ts";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("definirQuantidade", () => {
  test("adiciona, troca e remove", () => {
    let c = definirQuantidade({}, id(1), 2);
    assert.deepEqual(c, { [id(1)]: 2 });
    c = definirQuantidade(c, id(1), 5);
    assert.equal(c[id(1)], 5);
    c = definirQuantidade(c, id(1), 0);
    assert.deepEqual(c, {});
  });
  test("o limite é 20 por item e valores estranhos viram remoção", () => {
    assert.equal(definirQuantidade({}, id(1), 99)[id(1)], QUANTIDADE_MAXIMA);
    for (const q of [-3, NaN, Infinity, -Infinity]) assert.deepEqual(definirQuantidade({ [id(1)]: 2 }, id(1), q), {});
    assert.equal(definirQuantidade({}, id(1), 2.9)[id(1)], 2);
  });
  test("não passa de 30 linhas diferentes, mas troca a quantidade das que já estão", () => {
    let c = {};
    for (let i = 1; i <= LINHAS_MAXIMAS; i++) c = definirQuantidade(c, id(i), 1);
    assert.equal(Object.keys(c).length, LINHAS_MAXIMAS);
    assert.deepEqual(definirQuantidade(c, id(999), 1), c);
    assert.equal(definirQuantidade(c, id(1), 4)[id(1)], 4);
  });
  test("não altera o carrinho original", () => {
    const c = { [id(1)]: 1 };
    definirQuantidade(c, id(1), 5);
    assert.deepEqual(c, { [id(1)]: 1 });
  });
});

describe("lerCarrinho", () => {
  test("lê o que foi guardado", () => {
    assert.deepEqual(lerCarrinho(JSON.stringify({ [id(1)]: 2, [id(2)]: 1 })), { [id(1)]: 2, [id(2)]: 1 });
  });
  test("texto quebrado, vazio ou de outro tipo vira carrinho vazio", () => {
    for (const t of [null, undefined, "", "{", "null", "[]", "123", '"x"', "[1,2]", "true"]) assert.deepEqual(lerCarrinho(t), {}, String(t));
  });
  test("descarta id falso, quantidade fora da faixa, decimal ou texto", () => {
    const sujo = { [id(1)]: 2, "../../etc": 1, "<script>": 1, [id(2)]: 0, [id(3)]: 21, [id(4)]: 1.5, [id(5)]: "2", [id(6)]: -1 };
    assert.deepEqual(lerCarrinho(JSON.stringify(sujo)), { [id(1)]: 2 });
  });
  test("não carrega mais de 30 linhas", () => {
    const muitos = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [id(i + 1), 1]));
    assert.equal(Object.keys(lerCarrinho(JSON.stringify(muitos))).length, LINHAS_MAXIMAS);
  });
  test("__proto__ não contamina nada", () => {
    lerCarrinho('{"__proto__": {"x": 1}}');
    assert.equal({}.x, undefined);
  });
});

describe("linhas do carrinho e envio", () => {
  const cardapio = [
    { id: id(1), nome: "Pastel", preco: 8.5 },
    { id: id(2), nome: "Bolo", preco: null },
  ];
  test("junta com o cardápio de agora; item que saiu ou ficou indisponível some", () => {
    const linhas = linhasDoCarrinho({ [id(1)]: 2, [id(2)]: 1, [id(9)]: 3 }, cardapio);
    assert.deepEqual(linhas.map((l) => [l.nome, l.quantidade, l.preco]), [["Pastel", 2, 8.5], ["Bolo", 1, null]]);
    assert.deepEqual(linhasDoCarrinho({ [id(1)]: 2 }, []), []);
  });
  test("para o banco vai só id e quantidade: nunca preço nem nome", () => {
    const enviar = itensParaEnviar(linhasDoCarrinho({ [id(1)]: 2 }, cardapio));
    assert.deepEqual(enviar, [{ item_id: id(1), quantidade: 2 }]);
    assert.ok(!JSON.stringify(enviar).includes("preco"));
  });
  test("total de unidades e chave guardada por loja", () => {
    assert.equal(totalDeUnidades({ [id(1)]: 2, [id(2)]: 3 }), 5);
    assert.notEqual(chaveDoCarrinho(id(1)), chaveDoCarrinho(id(2)));
  });
});
