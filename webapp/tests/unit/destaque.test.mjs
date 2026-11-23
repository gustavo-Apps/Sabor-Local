// Plano destaque: validação do pagamento e ordem do catálogo (funções puras).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { validarPagamento } from "../../src/lib/validacao.ts";
import { emDestaque, ordenarPorPrioridade } from "../../src/lib/ordenacao.ts";

const erro = (r) => (r.ok ? null : r.erro);

describe("validação do pagamento do destaque", () => {
  const ok = { dias: "30", valor: "30,00", forma: "pix", obs: "" };

  test("Pix com valor e dias válidos", () => {
    assert.deepEqual(validarPagamento(ok).valor, { dias: 30, valor: 30, forma: "pix", observacao: null });
  });

  test("aceita vírgula, ponto e milhar no valor", () => {
    assert.equal(validarPagamento({ ...ok, valor: "1.250,50" }).valor.valor, 1250.5);
    assert.equal(validarPagamento({ ...ok, valor: "29.9" }).valor.valor, 29.9);
  });

  test("cortesia ignora o valor digitado e grava zero", () => {
    const r = validarPagamento({ ...ok, forma: "cortesia", valor: "999" });
    assert.equal(r.valor.valor, 0);
  });

  test("cortesia não exige valor", () => {
    assert.equal(validarPagamento({ ...ok, forma: "cortesia", valor: "" }).ok, true);
  });

  const casos = [
    ["forma inventada", { forma: "cheque" }, "Escolha a forma de pagamento: Pix, dinheiro ou cortesia."],
    ["forma vazia", { forma: "" }, "Escolha a forma de pagamento: Pix, dinheiro ou cortesia."],
    ["dias vazio", { dias: "" }, "Informe quantos dias de destaque, de 1 a 365."],
    ["dias zero", { dias: "0" }, "Informe quantos dias de destaque, de 1 a 365."],
    ["dias negativo", { dias: "-7" }, "Informe quantos dias de destaque, de 1 a 365."],
    ["dias 366", { dias: "366" }, "Informe quantos dias de destaque, de 1 a 365."],
    ["dias com fração", { dias: "7.5" }, "Informe quantos dias de destaque, de 1 a 365."],
    ["dias em texto", { dias: "uma semana" }, "Informe quantos dias de destaque, de 1 a 365."],
    ["valor vazio no Pix", { valor: "" }, "Informe o valor recebido, maior que zero, por exemplo 30,00. Para não cobrar, escolha Cortesia."],
    ["valor zero no Pix", { valor: "0" }, "Informe o valor recebido, maior que zero, por exemplo 30,00. Para não cobrar, escolha Cortesia."],
    ["valor negativo", { valor: "-10" }, "Informe o valor recebido, maior que zero, por exemplo 30,00. Para não cobrar, escolha Cortesia."],
    ["valor em texto", { valor: "trinta" }, "Informe o valor recebido, maior que zero, por exemplo 30,00. Para não cobrar, escolha Cortesia."],
    ["observação longa", { obs: "a".repeat(201) }, "A observação pode ter no máximo 200 caracteres (agora tem 201)."],
  ];
  for (const [nome, parcial, mensagem] of casos) {
    test(nome, () => assert.equal(erro(validarPagamento({ ...ok, ...parcial })), mensagem));
  }
});

describe("destaque ativo", () => {
  const agora = new Date("2026-10-05T12:00:00Z").getTime();

  test("só é destaque se o prazo ainda não venceu", () => {
    assert.equal(emDestaque({ destaque_ate: "2026-10-06T00:00:00Z" }, agora), true);
    assert.equal(emDestaque({ destaque_ate: "2026-10-05T11:59:59Z" }, agora), false);
    assert.equal(emDestaque({ destaque_ate: null }, agora), false);
    assert.equal(emDestaque({}, agora), false);
  });
});

describe("ordem do catálogo", () => {
  const agora = new Date("2026-10-05T12:00:00Z").getTime();
  const futuro = "2026-11-01T00:00:00Z";
  const passado = "2026-09-01T00:00:00Z";
  const nomes = (lista) => lista.map((v) => v.nome);
  const sempreFechado = () => false;

  test("destaque ativo vem antes dos demais, mesmo fechado", () => {
    const lista = [
      { nome: "Aberto comum", aberto: true },
      { nome: "Destaque fechado", aberto: false, destaque_ate: futuro },
      { nome: "Fechado comum", aberto: false },
    ];
    const r = ordenarPorPrioridade(lista, agora, (v) => v.aberto);
    assert.deepEqual(nomes(r), ["Destaque fechado", "Aberto comum", "Fechado comum"]);
  });

  test("destaque vencido não ganha prioridade", () => {
    const lista = [{ nome: "B" }, { nome: "A", destaque_ate: passado }];
    assert.deepEqual(nomes(ordenarPorPrioridade(lista, agora, sempreFechado)), ["A", "B"]); // só pela ordem alfabética
    const lista2 = [{ nome: "A", destaque_ate: passado }, { nome: "B", aberto: true }];
    assert.deepEqual(nomes(ordenarPorPrioridade(lista2, agora, (v) => Boolean(v.aberto))), ["B", "A"]);
  });

  test("destaque e aberto vencem destaque fechado; empates em ordem alfabética (com acento)", () => {
    const lista = [
      { nome: "Zeca", destaque_ate: futuro, aberto: false },
      { nome: "Ágata", destaque_ate: futuro, aberto: true },
      { nome: "Bia", destaque_ate: futuro, aberto: true },
    ];
    assert.deepEqual(nomes(ordenarPorPrioridade(lista, agora, (v) => v.aberto)), ["Ágata", "Bia", "Zeca"]);
  });

  test("não altera a lista original e não perde ninguém", () => {
    const lista = [{ nome: "C" }, { nome: "A", destaque_ate: futuro }, { nome: "B" }];
    const copia = JSON.stringify(lista);
    const r = ordenarPorPrioridade(lista, agora, sempreFechado);
    assert.equal(JSON.stringify(lista), copia);
    assert.equal(r.length, 3);
  });

  test("lista vazia e de um item", () => {
    assert.deepEqual(ordenarPorPrioridade([], agora, sempreFechado), []);
    assert.deepEqual(ordenarPorPrioridade([{ nome: "Só" }], agora, sempreFechado), [{ nome: "Só" }]);
  });

  test("500 vendedores: ordena rápido e todos os destaques ficam no topo", () => {
    const lista = Array.from({ length: 500 }, (_, i) => ({
      nome: `V${String(i).padStart(3, "0")}`,
      destaque_ate: i % 50 === 0 ? futuro : null,
    }));
    const t = performance.now();
    const r = ordenarPorPrioridade(lista, agora, sempreFechado);
    assert.ok(performance.now() - t < 200, "deve ordenar em menos de 200 ms");
    assert.ok(r.slice(0, 10).every((v) => emDestaque(v, agora)));
    assert.ok(r.slice(10).every((v) => !emDestaque(v, agora)));
  });
});
