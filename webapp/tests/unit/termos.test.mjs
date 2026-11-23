// Novo aceite dos Termos por versão (sem banco, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { FORMATO_VERSAO_TERMOS, precisaAceitarTermos } from "../../src/lib/termos.ts";
import { TERMOS_VERSAO } from "../../src/lib/legal.ts";
import { validarAceiteTermos } from "../../src/lib/validacao.ts";

describe("precisaAceitarTermos", () => {
  test("mesma versão: não precisa", () => assert.equal(precisaAceitarTermos("2026-10", "2026-10"), false));
  test("versão antiga: precisa", () => assert.equal(precisaAceitarTermos("2026-10", "2027-03"), true));

  test("nunca aceitou (nulo, indefinido, vazio ou só espaços): precisa", () => {
    for (const v of [null, undefined, "", "   "]) assert.equal(precisaAceitarTermos(v, "2026-10"), true, JSON.stringify(v));
  });

  test("espaços nas pontas da versão gravada não atrapalham", () => {
    assert.equal(precisaAceitarTermos(" 2026-10 ", "2026-10"), false);
  });

  test("a comparação é exata: 2026-10 e 2026-10-b são versões diferentes", () => {
    assert.equal(precisaAceitarTermos("2026-10", "2026-10-b"), true);
    assert.equal(precisaAceitarTermos("2026-10-b", "2026-10"), true);
    assert.equal(precisaAceitarTermos("2026-10-B", "2026-10-b"), true);
  });
});

describe("versão atual dos Termos", () => {
  test("segue o formato que o banco aceita (senão ninguém conseguiria aceitar)", () => {
    assert.match(TERMOS_VERSAO, FORMATO_VERSAO_TERMOS);
  });

  test("o formato recusa lixo", () => {
    for (const v of ["", "2026", "2026-1", "26-10", "2026-10-", "2026-10-ABC", "2026-10 b", "2026-10'; drop", "2026-10-" + "a".repeat(11), "abc"]) {
      assert.doesNotMatch(v, FORMATO_VERSAO_TERMOS, JSON.stringify(v));
    }
    for (const v of ["2026-10", "2027-03", "2027-03-b", "2030-12-rev2"]) assert.match(v, FORMATO_VERSAO_TERMOS, v);
  });
});

describe("validarAceiteTermos", () => {
  test("marcado: sem erro", () => assert.equal(validarAceiteTermos(true), null));
  test("sem marcar: mensagem clara", () => assert.match(validarAceiteTermos(false), /marque que você leu e aceita os Termos de Uso e a Política de Privacidade/));
});
