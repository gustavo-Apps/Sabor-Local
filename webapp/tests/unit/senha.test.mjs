// "Esqueci minha senha": validação do pedido e da nova senha (sem banco, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { validarNovaSenha, validarRecuperacao } from "../../src/lib/validacao.ts";

describe("validarRecuperacao", () => {
  test("aceita e-mail e usuário, em minúsculas e sem espaços nas pontas", () => {
    assert.deepEqual(validarRecuperacao("  Maria@Exemplo.COM "), { ok: true, valor: "maria@exemplo.com" });
    assert.deepEqual(validarRecuperacao("pizzaria.do_ze"), { ok: true, valor: "pizzaria.do_ze" });
  });

  const recusas = [
    ["vazio", "", /Digite seu e-mail ou usuário/],
    ["só espaços", "   ", /Digite seu e-mail ou usuário/],
    ["e-mail sem domínio", "maria@", /e-mail completo/],
    ["e-mail com espaço", "maria @exemplo.com", /e-mail completo/],
    ["usuário com espaço", "pizzaria do ze", /sem espaços/],
    ["usuário curto demais", "ab", /sem espaços/],
    ["usuário com acento", "açaí", /sem espaços/],
    ["texto enorme", "a".repeat(300), /longo demais/],
  ];
  for (const [nome, entrada, esperado] of recusas) {
    test(`recusa: ${nome}`, () => {
      const r = validarRecuperacao(entrada);
      assert.equal(r.ok, false);
      assert.match(r.erro, esperado);
    });
  }

  test("entradas hostis não derrubam a validação", () => {
    for (const e of ["\0", "💥".repeat(5000), "{}", "null", "a\r\nb@c.d", "<script>@x.com"]) {
      assert.doesNotThrow(() => validarRecuperacao(e));
    }
  });
});

describe("validarNovaSenha", () => {
  test("aceita senha de 8 a 72 caracteres igual à confirmação", () => {
    assert.equal(validarNovaSenha("abcdefg1", "abcdefg1"), null);
    assert.equal(validarNovaSenha("a".repeat(72), "a".repeat(72)), null);
  });

  test("senha curta, longa, só espaços e confirmação diferente", () => {
    assert.match(validarNovaSenha("abc", "abc"), /pelo menos 8/);
    assert.match(validarNovaSenha("a".repeat(73), "a".repeat(73)), /no máximo 72/);
    assert.match(validarNovaSenha(" ".repeat(10), " ".repeat(10)), /só espaços/);
    assert.match(validarNovaSenha("abcdefg1", "abcdefg2"), /não são iguais/);
  });
});
