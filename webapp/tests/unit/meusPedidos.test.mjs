// "Meus pedidos": a lista guardada no navegador e os carrinhos que ficaram pela metade (sem navegador, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  guardarPedido,
  lerPedidosGuardados,
  MAX_PEDIDOS_GUARDADOS,
  pedidoGuardadoValido,
  pedidosParaGuardar,
  removerPedidoGuardado,
  tokensParaConsultar,
} from "../../src/lib/meusPedidos.ts";
import { carrinhosPendentes, chaveDoCarrinho, PREFIXO_DO_CARRINHO } from "../../src/lib/carrinho.ts";
import { chaveDaMontagem } from "../../src/lib/montaveis.ts";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const token = (n) => String(n).padStart(64, "a");
const dia = (n) => new Date(Date.UTC(2026, 9, n, 15, 0, 0)).toISOString();
const pedido = (n, extra = {}) => ({ token: token(n), lojaId: id(1), lojaNome: "Pizzaria do Bairro", numero: n, total: 64, criadoEm: dia(n), ...extra });

describe("pedido guardado", () => {
  test("registro certo passa, com a data em formato padrão", () => {
    const p = pedidoGuardadoValido({ ...pedido(1), criadoEm: "2026-10-14T20:35:00-03:00" });
    assert.equal(p.criadoEm, "2026-10-14T23:35:00.000Z");
    assert.equal(p.numero, 1);
  });
  test("token em maiúsculas vira minúsculas", () => {
    assert.equal(pedidoGuardadoValido(pedido(1, { token: "A".repeat(64) })).token, "a".repeat(64));
  });
  test("registro estragado ou adulterado é recusado", () => {
    const ruins = [
      null, undefined, "texto", 42, [], {},
      pedido(1, { token: "curto" }),
      pedido(1, { token: "g".repeat(64) }),
      pedido(1, { token: `${"a".repeat(63)}/` }),
      pedido(1, { token: `${"a".repeat(64)}x` }),
      pedido(1, { lojaId: "lixo" }),
      pedido(1, { lojaId: 7 }),
      pedido(1, { lojaNome: "" }),
      pedido(1, { lojaNome: "   " }),
      pedido(1, { lojaNome: 5 }),
      pedido(1, { numero: 0 }),
      pedido(1, { numero: 1.5 }),
      pedido(1, { numero: "3" }),
      pedido(1, { total: -1 }),
      pedido(1, { total: NaN }),
      pedido(1, { total: Infinity }),
      pedido(1, { total: "64" }),
      pedido(1, { criadoEm: "ontem" }),
      pedido(1, { criadoEm: "" }),
      pedido(1, { criadoEm: 1700000000000 }),
    ];
    for (const r of ruins) assert.equal(pedidoGuardadoValido(r), null, JSON.stringify(r));
  });
  test("o nome da loja perde caracteres de controle e é cortado em 80", () => {
    assert.equal(pedidoGuardadoValido(pedido(1, { lojaNome: "Pizza\u0000ria\n" })).lojaNome, "Pizza ria");
    assert.equal(pedidoGuardadoValido(pedido(1, { lojaNome: "x".repeat(500) })).lojaNome.length, 80);
  });
  test("texto com HTML fica como texto (a tela escapa)", () => {
    assert.equal(pedidoGuardadoValido(pedido(1, { lojaNome: "<img src=x onerror=alert(1)>" })).lojaNome, "<img src=x onerror=alert(1)>");
  });
});

describe("ler o que estava guardado", () => {
  test("vazio, nulo ou quebrado dá lista vazia", () => {
    for (const t of [null, undefined, "", "{", "null", "42", '"x"', "{}", "[1,2]"]) assert.deepEqual(lerPedidosGuardados(t), [], String(t));
  });
  test("ordena do mais novo ao mais antigo", () => {
    const lista = lerPedidosGuardados(JSON.stringify([pedido(2), pedido(5), pedido(3)]));
    assert.deepEqual(lista.map((p) => p.numero), [5, 3, 2]);
  });
  test("descarta o inválido e o repetido, sem derrubar os bons", () => {
    const lista = lerPedidosGuardados(JSON.stringify([pedido(1), { token: "x" }, pedido(1, { numero: 9 }), null, pedido(2)]));
    assert.deepEqual(lista.map((p) => p.numero).sort(), [1, 2]);
  });
  test("guarda no máximo 30", () => {
    const muitos = Array.from({ length: 80 }, (_, i) => pedido(i + 1, { token: token(i + 1) }));
    const lista = lerPedidosGuardados(JSON.stringify(muitos));
    assert.equal(lista.length, MAX_PEDIDOS_GUARDADOS);
  });
  test("__proto__ e chaves estranhas não passam para o registro", () => {
    const lista = lerPedidosGuardados('[{"token":"' + token(1) + '","lojaId":"' + id(1) + '","lojaNome":"A","numero":1,"total":1,"criadoEm":"' + dia(1) + '","__proto__":{"x":1},"extra":"y"}]');
    assert.equal(lista.length, 1);
    assert.deepEqual(Object.keys(lista[0]).sort(), ["criadoEm", "lojaId", "lojaNome", "numero", "token", "total"]);
  });
  test("ida e volta pelo texto", () => {
    const lista = [pedido(3), pedido(2)];
    assert.deepEqual(lerPedidosGuardados(pedidosParaGuardar(lista)), lista);
  });
});

describe("guardar e remover", () => {
  test("pedido novo entra no topo; o mesmo pedido não se repete (e é atualizado)", () => {
    let l = guardarPedido([], pedido(1));
    l = guardarPedido(l, pedido(2));
    l = guardarPedido(l, pedido(1, { total: 99 }));
    assert.deepEqual(l.map((p) => p.numero), [2, 1]);
    assert.equal(l.find((p) => p.numero === 1).total, 99);
  });
  test("registro inválido não entra e a lista fica como estava", () => {
    const l = [pedido(1)];
    assert.deepEqual(guardarPedido(l, { token: "x" }), l);
  });
  test("passando de 30, os mais antigos saem", () => {
    let l = [];
    for (let i = 1; i <= 35; i++) l = guardarPedido(l, pedido(i, { token: token(i) }));
    assert.equal(l.length, MAX_PEDIDOS_GUARDADOS);
    assert.equal(l[0].numero, 35);
    assert.equal(l.at(-1).numero, 6);
  });
  test("remover tira só aquele pedido", () => {
    const l = removerPedidoGuardado([pedido(2), pedido(1)], token(2));
    assert.deepEqual(l.map((p) => p.numero), [1]);
    assert.deepEqual(removerPedidoGuardado(l, token(9)), l);
  });
  test("não altera a lista recebida", () => {
    const l = Object.freeze([pedido(1)]);
    assert.doesNotThrow(() => guardarPedido(l, pedido(2)));
    assert.doesNotThrow(() => removerPedidoGuardado(l, token(1)));
    assert.equal(l.length, 1);
  });
});

describe("carrinhos que ficaram pela metade", () => {
  const item = id(50);
  test("lê todos os carrinhos do armazenamento e ignora o resto", () => {
    const entradas = [
      [chaveDoCarrinho(id(2)), JSON.stringify({ [item]: 2, [id(51)]: 1 })],
      [chaveDoCarrinho(id(1)), JSON.stringify({ [item]: 4 })],
      ["rastreio:visita_vendedor:x", "1"],
      ["sabor-local:meus-pedidos", "[]"],
      [`${PREFIXO_DO_CARRINHO}nao-e-id`, JSON.stringify({ [item]: 1 })],
    ];
    assert.deepEqual(carrinhosPendentes(entradas), [
      { vendedorId: id(1), unidades: 4 },
      { vendedorId: id(2), unidades: 3 },
    ]);
  });
  test("carrinho vazio, estragado ou com quantidade absurda não conta", () => {
    const entradas = [
      [chaveDoCarrinho(id(1)), "{}"],
      [chaveDoCarrinho(id(2)), "{"],
      [chaveDoCarrinho(id(3)), null],
      [chaveDoCarrinho(id(4)), JSON.stringify({ [item]: 999 })],
      [chaveDoCarrinho(id(5)), JSON.stringify({ lixo: 2 })],
    ];
    assert.deepEqual(carrinhosPendentes(entradas), []);
  });
  test("montagens (pizza, açaí) contam como unidades", () => {
    const k = chaveDaMontagem({ montavelId: id(7), tamanhoId: id(8), escolhas: [id(9)], adicionais: [] });
    assert.deepEqual(carrinhosPendentes([[chaveDoCarrinho(id(1)), JSON.stringify({ [k]: 2, [item]: 1 })]]), [{ vendedorId: id(1), unidades: 3 }]);
  });
  test("sem nada guardado, nada pendente", () => {
    assert.deepEqual(carrinhosPendentes([]), []);
  });
});

describe("quais pedidos consultar (issue 24)", () => {
  const abertos = ["novo", "em_preparo", "saiu_para_entrega", "pronto_para_retirada"];
  const [a, b, c, d] = [token(1), token(2), token(3), token(4)];

  test("na primeira vez consulta todos", () => {
    assert.deepEqual(tokensParaConsultar([a, b, c], {}, abertos), [a, b, c]);
  });
  test("depois, só os abertos: pedido concluído ou cancelado não é consultado de novo", () => {
    const conhecidos = { [a]: "concluido", [b]: "em_preparo", [c]: "cancelado", [d]: "novo" };
    assert.deepEqual(tokensParaConsultar([a, b, c, d], conhecidos, abertos), [b, d]);
  });
  test("só pedidos encerrados: nada a consultar (sem chamadas periódicas)", () => {
    assert.deepEqual(tokensParaConsultar([a, b], { [a]: "concluido", [b]: "cancelado" }, abertos), []);
  });
  test("o que falhou antes (status desconhecido) é tentado de novo, e o pedido novo na lista também", () => {
    assert.deepEqual(tokensParaConsultar([a, b, c], { [a]: "concluido" }, abertos), [b, c]);
  });
  test("pedido tirado da lista não entra, e a ordem da lista é mantida", () => {
    assert.deepEqual(tokensParaConsultar([c, a], { [b]: "novo" }, abertos), [c, a]);
  });
  test("sem pedidos, nada a consultar", () => {
    assert.deepEqual(tokensParaConsultar([], {}, abertos), []);
  });
  test("status estranho guardado conta como encerrado (não gasta chamada à toa)", () => {
    assert.deepEqual(tokensParaConsultar([a], { [a]: "qualquer-coisa" }, abertos), []);
  });
});
