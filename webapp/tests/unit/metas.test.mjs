// Metas e leitura do resumo por cidade (sem banco, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { idadeEmDias, META_PERFIS_COMPLETOS, progressoMeta, ROTULOS_SITUACAO, situacaoDaCidade } from "../../src/lib/metas.ts";
import { lerResumoCidades } from "../../src/lib/validacao.ts";

const AGORA = new Date("2031-10-06T12:00:00Z");
const dias = (n) => new Date(AGORA.getTime() - n * 86_400_000).toISOString();
const cidade = (extra = {}) => ({
  cidade_id: "c1",
  nome: "Santa Maria",
  uf: "RS",
  slug: "santa-maria",
  ativa: true,
  criada_em: dias(10),
  vendedores_ativos: 0,
  vendedores_pendentes: 0,
  vendedores_suspensos: 0,
  perfis_completos: 0,
  destaques_ativos: 0,
  visitas_perfis_30d: 0,
  toques_whatsapp_30d: 0,
  avaliacoes_publicadas: 0,
  ...extra,
});

describe("progressoMeta", () => {
  const casos = [
    [0, 10, 0],
    [1, 10, 10],
    [5, 10, 50],
    [10, 10, 100],
    [25, 10, 100], // passou da meta: a barra para em 100
    [1, 3, 33],
    [-4, 10, 0],
    [5, 0, 0], // meta inválida
    [5, -10, 0],
    [NaN, 10, 0],
    [Infinity, 10, 0],
  ];
  for (const [valor, meta, esperado] of casos) test(`${valor} de ${meta} = ${esperado}%`, () => assert.equal(progressoMeta(valor, meta), esperado));
});

describe("idadeEmDias", () => {
  test("conta dias inteiros", () => {
    assert.equal(idadeEmDias(dias(0), AGORA), 0);
    assert.equal(idadeEmDias(dias(27), AGORA), 27);
    assert.equal(idadeEmDias(dias(28), AGORA), 28);
  });
  test("data no futuro, vazia ou inválida conta como 0", () => {
    assert.equal(idadeEmDias(dias(-5), AGORA), 0);
    assert.equal(idadeEmDias("", AGORA), 0);
    assert.equal(idadeEmDias("não é data", AGORA), 0);
  });
});

describe("situacaoDaCidade", () => {
  test("cidade desativada está pausada, mesmo com a base pronta", () => {
    assert.equal(situacaoDaCidade(cidade({ ativa: false, perfis_completos: 12 }), AGORA), "pausada");
  });

  test("com 10 perfis completos está pronta para divulgar", () => {
    assert.equal(situacaoDaCidade(cidade({ perfis_completos: META_PERFIS_COMPLETOS }), AGORA), "pronta");
    assert.equal(situacaoDaCidade(cidade({ perfis_completos: 9 }), AGORA), "montando");
  });

  test("4 semanas ou mais com menos de 5 ativos pede atenção", () => {
    assert.equal(situacaoDaCidade(cidade({ criada_em: dias(28), vendedores_ativos: 4 }), AGORA), "atencao");
    assert.equal(situacaoDaCidade(cidade({ criada_em: dias(90), vendedores_ativos: 0 }), AGORA), "atencao");
  });

  test("ainda dentro das 4 semanas, ou com 5 ativos, segue montando a base", () => {
    assert.equal(situacaoDaCidade(cidade({ criada_em: dias(27), vendedores_ativos: 0 }), AGORA), "montando");
    assert.equal(situacaoDaCidade(cidade({ criada_em: dias(60), vendedores_ativos: 5 }), AGORA), "montando");
  });

  test("a meta de perfis completos vence o alerta de atenção", () => {
    assert.equal(situacaoDaCidade(cidade({ criada_em: dias(90), vendedores_ativos: 3, perfis_completos: 10 }), AGORA), "pronta");
  });

  test("todo estado tem um rótulo para a tela", () => {
    for (const s of ["pausada", "pronta", "atencao", "montando"]) assert.ok(ROTULOS_SITUACAO[s]);
  });
});

describe("lerResumoCidades", () => {
  const linha = (extra = {}) => ({ ...cidade(), ...extra });

  test("converte contagens que chegam como texto (bigint)", () => {
    const [c] = lerResumoCidades([linha({ vendedores_ativos: "7", perfis_completos: "3", visitas_perfis_30d: "120" })]);
    assert.equal(c.vendedores_ativos, 7);
    assert.equal(c.perfis_completos, 3);
    assert.equal(c.visitas_perfis_30d, 120);
  });

  test("número inválido, negativo ou ausente vira 0", () => {
    const [c] = lerResumoCidades([linha({ vendedores_ativos: "abc", perfis_completos: -3, toques_whatsapp_30d: null, destaques_ativos: undefined, avaliacoes_publicadas: NaN })]);
    assert.equal(c.vendedores_ativos, 0);
    assert.equal(c.perfis_completos, 0);
    assert.equal(c.toques_whatsapp_30d, 0);
    assert.equal(c.destaques_ativos, 0);
    assert.equal(c.avaliacoes_publicadas, 0);
  });

  test("descarta linhas sem identificação e entradas que não são lista", () => {
    assert.equal(lerResumoCidades([linha({ cidade_id: undefined }), linha({ nome: 5 }), linha({ slug: null }), null, 7, "x", []]).length, 0);
    for (const ruim of [null, undefined, {}, "texto", 42, true]) assert.deepEqual(lerResumoCidades(ruim), []);
  });

  test("UF ausente vira null e cidade sem 'ativa' conta como ativa", () => {
    const [c] = lerResumoCidades([linha({ uf: undefined, ativa: undefined })]);
    assert.equal(c.uf, null);
    assert.equal(c.ativa, true);
    assert.equal(lerResumoCidades([linha({ ativa: false })])[0].ativa, false);
  });

  test("mantém a ordem recebida", () => {
    const r = lerResumoCidades([linha({ cidade_id: "a", slug: "a" }), linha({ cidade_id: "b", slug: "b" })]);
    assert.deepEqual(r.map((c) => c.cidade_id), ["a", "b"]);
  });
});
