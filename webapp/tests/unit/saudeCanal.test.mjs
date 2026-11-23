// Saúde do Fale conosco: contagem por situação e taxa de aproveitamento (sem banco, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { saudeDoCanal } from "../../src/lib/feedback.ts";
import { lerContagemFeedback } from "../../src/lib/validacao.ts";

describe("saudeDoCanal", () => {
  test("canal vazio: tudo zero e taxa nula (nada tratado ainda)", () => {
    assert.deepEqual(saudeDoCanal({ novo: 0, aceito: 0, recusado: 0, resolvido: 0 }), {
      total: 0, tratadas: 0, pendentes: 0, aproveitadas: 0, taxaDeAproveitamento: null,
    });
  });

  test("só mensagens novas: pendentes, sem taxa", () => {
    const s = saudeDoCanal({ novo: 7, aceito: 0, recusado: 0, resolvido: 0 });
    assert.equal(s.total, 7);
    assert.equal(s.pendentes, 7);
    assert.equal(s.taxaDeAproveitamento, null);
  });

  test("aceitas e resolvidas contam como aproveitadas; recusadas, não", () => {
    const s = saudeDoCanal({ novo: 2, aceito: 3, recusado: 5, resolvido: 2 });
    assert.deepEqual(s, { total: 12, tratadas: 10, pendentes: 2, aproveitadas: 5, taxaDeAproveitamento: 50 });
  });

  test("a taxa é só sobre as tratadas (as novas não puxam para baixo)", () => {
    assert.equal(saudeDoCanal({ novo: 100, aceito: 1, recusado: 1, resolvido: 0 }).taxaDeAproveitamento, 50);
  });

  test("arredonda para o inteiro mais próximo", () => {
    assert.equal(saudeDoCanal({ novo: 0, aceito: 1, recusado: 2, resolvido: 0 }).taxaDeAproveitamento, 33);
    assert.equal(saudeDoCanal({ novo: 0, aceito: 2, recusado: 1, resolvido: 0 }).taxaDeAproveitamento, 67);
  });

  test("100% e 0%", () => {
    assert.equal(saudeDoCanal({ novo: 0, aceito: 4, recusado: 0, resolvido: 0 }).taxaDeAproveitamento, 100);
    assert.equal(saudeDoCanal({ novo: 0, aceito: 0, recusado: 4, resolvido: 0 }).taxaDeAproveitamento, 0);
  });
});

describe("lerContagemFeedback", () => {
  const l = (status) => ({ status });

  test("conta por situação", () => {
    assert.deepEqual(lerContagemFeedback([l("novo"), l("novo"), l("aceito"), l("recusado"), l("resolvido"), l("resolvido")]), {
      novo: 2, aceito: 1, recusado: 1, resolvido: 2,
    });
  });

  test("ignora situação desconhecida, linha estranha e coisa que não é lista", () => {
    assert.deepEqual(lerContagemFeedback([l("novo"), l("pendente"), l(null), l(5), null, undefined, "novo", 7, {}, []]), {
      novo: 1, aceito: 0, recusado: 0, resolvido: 0,
    });
    for (const ruim of [null, undefined, {}, "texto", 42, true]) {
      assert.deepEqual(lerContagemFeedback(ruim), { novo: 0, aceito: 0, recusado: 0, resolvido: 0 });
    }
  });

  test("não confunde nomes herdados de objeto (__proto__, constructor) com situações", () => {
    const c = lerContagemFeedback([l("__proto__"), l("constructor"), l("toString")]);
    assert.deepEqual(c, { novo: 0, aceito: 0, recusado: 0, resolvido: 0 });
  });

  test("aguenta muitas linhas", () => {
    const linhas = Array.from({ length: 5000 }, (_, i) => l(["novo", "aceito", "recusado", "resolvido"][i % 4]));
    const c = lerContagemFeedback(linhas);
    assert.equal(c.novo + c.aceito + c.recusado + c.resolvido, 5000);
  });

  test("a leitura e o resumo trabalham juntos", () => {
    const s = saudeDoCanal(lerContagemFeedback([l("aceito"), l("recusado"), l("novo")]));
    assert.deepEqual([s.total, s.tratadas, s.pendentes, s.taxaDeAproveitamento], [3, 2, 1, 50]);
  });
});
