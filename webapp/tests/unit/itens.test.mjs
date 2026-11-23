// "Indisponível hoje": regras de disponibilidade dos itens (sem banco, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { camposDoModo, disponibilidadeDoItem, ordenarParaPerfil, seloIndisponivel } from "../../src/lib/itens.ts";

const HOJE = "2031-10-06";

describe("disponibilidadeDoItem", () => {
  const casos = [
    ["item novo (campos ausentes)", {}, "disponivel"],
    ["disponivel true", { disponivel: true, indisponivel_ate: null }, "disponivel"],
    ["sem previsão", { disponivel: false, indisponivel_ate: null }, "indisponivel"],
    ["só hoje", { disponivel: false, indisponivel_ate: HOJE }, "indisponivel_hoje"],
    ["até uma data futura", { disponivel: false, indisponivel_ate: "2031-10-09" }, "indisponivel_hoje"],
    ["a data já passou: volta sozinho", { disponivel: false, indisponivel_ate: "2031-10-05" }, "disponivel"],
    ["data sem o item indisponível é ignorada", { disponivel: true, indisponivel_ate: HOJE }, "disponivel"],
  ];
  for (const [nome, item, esperado] of casos) {
    test(nome, () => assert.equal(disponibilidadeDoItem(item, HOJE), esperado));
  }

  test("virada do dia: indisponível só hoje deixa de valer à meia-noite", () => {
    const item = { disponivel: false, indisponivel_ate: HOJE };
    assert.equal(disponibilidadeDoItem(item, "2031-10-06"), "indisponivel_hoje");
    assert.equal(disponibilidadeDoItem(item, "2031-10-07"), "disponivel");
  });
});

describe("camposDoModo", () => {
  test("cada botão do painel grava as colunas certas", () => {
    assert.deepEqual(camposDoModo("disponivel", HOJE), { disponivel: true, indisponivel_ate: null });
    assert.deepEqual(camposDoModo("hoje", HOJE), { disponivel: false, indisponivel_ate: HOJE });
    assert.deepEqual(camposDoModo("sem_previsao", HOJE), { disponivel: false, indisponivel_ate: null });
  });

  test("o resultado sempre respeita a regra do banco (data só com item indisponível)", () => {
    for (const modo of ["disponivel", "hoje", "sem_previsao"]) {
      const c = camposDoModo(modo, HOJE);
      assert.ok(c.indisponivel_ate === null || c.disponivel === false, modo);
    }
  });

  test("modo desconhecido ou hostil não grava nada", () => {
    for (const modo of ["", "HOJE", "true", "false", "hoje; drop table", "__proto__", "💥"]) {
      assert.equal(camposDoModo(modo, HOJE), null, JSON.stringify(modo));
    }
  });
});

describe("ordenarParaPerfil", () => {
  const item = (nome, ordem, extra = {}) => ({ nome, ordem, ...extra });

  test("indisponíveis vão para o fim, cada grupo na ordem do vendedor", () => {
    const itens = [
      item("a", 0, { disponivel: false }),
      item("b", 1),
      item("c", 2, { disponivel: false, indisponivel_ate: HOJE }),
      item("d", 3),
      item("e", 4, { disponivel: false, indisponivel_ate: "2031-10-01" }), // venceu: volta ao grupo dos disponíveis
    ];
    assert.deepEqual(ordenarParaPerfil(itens, HOJE).map((i) => i.nome), ["b", "d", "e", "a", "c"]);
  });

  test("não altera a lista original e aguenta lista vazia", () => {
    const itens = [item("x", 1, { disponivel: false }), item("y", 0)];
    ordenarParaPerfil(itens, HOJE);
    assert.deepEqual(itens.map((i) => i.nome), ["x", "y"]);
    assert.deepEqual(ordenarParaPerfil([], HOJE), []);
  });
});

describe("seloIndisponivel", () => {
  test("textos mostrados ao cliente", () => {
    assert.equal(seloIndisponivel("disponivel"), null);
    assert.equal(seloIndisponivel("indisponivel_hoje"), "Indisponível hoje");
    assert.equal(seloIndisponivel("indisponivel"), "Indisponível no momento");
  });
});
