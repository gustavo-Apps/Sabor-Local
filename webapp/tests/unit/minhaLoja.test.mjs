// "Esta é a minha loja" (sem banco, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { ehMinhaLoja } from "../../src/lib/minhaLoja.ts";

const A = "774545e3-d167-4fb0-9679-dfa0e2c6f150";
const B = "1dbb581e-45c6-4eb3-a48e-c610d76eeff5";

describe("ehMinhaLoja", () => {
  test("é a minha quando os ids são iguais", () => assert.equal(ehMinhaLoja(A, A), true));
  test("não é a minha quando os ids são diferentes", () => assert.equal(ehMinhaLoja(A, B), false));

  test("visitante (sem login) ou vendedor sem perfil nunca é dono de nada", () => {
    for (const meu of [null, undefined, ""]) {
      assert.equal(ehMinhaLoja(meu, A), false, String(meu));
      assert.equal(ehMinhaLoja(meu, meu), false, "nulo não é igual a nulo");
    }
  });

  test("perfil sem id não casa com ninguém", () => {
    assert.equal(ehMinhaLoja(A, null), false);
    assert.equal(ehMinhaLoja(A, undefined), false);
    assert.equal(ehMinhaLoja(A, ""), false);
  });

  test("diferença de maiúsculas não engana (ids vêm sempre do banco, em minúsculas)", () => {
    assert.equal(ehMinhaLoja(A, A.toUpperCase()), false);
  });
});
