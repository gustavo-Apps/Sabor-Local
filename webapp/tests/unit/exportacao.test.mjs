// Arquivo de "Baixar meus dados": conferência do formato e remoção de chaves sensíveis (sem banco, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { CHAVES_PROIBIDAS, nomeDoArquivo, prepararExportacao, removerCamposSensiveis } from "../../src/lib/exportacao.ts";

const valido = (extra = {}) => ({
  gerado_em: "2031-10-06T12:00:00Z",
  conta: { email: "ana@exemplo.com", usuario: "ana" },
  perfil: { nome: "Lanchonete da Ana" },
  ramos: ["Lanches"],
  horarios: [],
  datas_especiais: [],
  menu: [],
  avaliacoes_recebidas: [],
  pagamentos_do_destaque: [],
  ...extra,
});

describe("nomeDoArquivo", () => {
  test("usa a data de Brasília, não a de Greenwich", () => {
    // 01:00 UTC de 7/10 ainda é 22:00 de 6/10 em Brasília
    assert.equal(nomeDoArquivo(new Date("2031-10-07T01:00:00Z")), "sabor-local-meus-dados-2031-10-06.json");
    assert.equal(nomeDoArquivo(new Date("2031-10-07T12:00:00Z")), "sabor-local-meus-dados-2031-10-07.json");
  });

  test("só tem letras minúsculas, números, hífen e ponto (seguro para o cabeçalho de download)", () => {
    assert.match(nomeDoArquivo(), /^[a-z0-9.-]+\.json$/);
  });
});

describe("removerCamposSensiveis", () => {
  test("remove as chaves proibidas em qualquer nível, inclusive dentro de listas", () => {
    const sujo = {
      nome: "x",
      owner_id: "u1",
      perfil: { ip_hash: "abc", ok: 1, fundo: { codigo_verificacao: "AB12", ok: 2 } },
      lista: [{ denuncias: [1, 2], ok: 3 }, { password: "x", encrypted_password: "y", ok: 4 }],
    };
    assert.deepEqual(removerCamposSensiveis(sujo), {
      nome: "x",
      perfil: { ok: 1, fundo: { ok: 2 } },
      lista: [{ ok: 3 }, { ok: 4 }],
    });
  });

  test("não altera o original e mantém números, nulos e textos", () => {
    const original = { owner_id: "u1", n: 0, nulo: null, t: "oi", l: [1, "a", null] };
    const copia = removerCamposSensiveis(original);
    assert.ok("owner_id" in original, "o original não pode ser alterado");
    assert.deepEqual(copia, { n: 0, nulo: null, t: "oi", l: [1, "a", null] });
  });

  test("valores que não são objeto voltam como vieram", () => {
    for (const v of [null, undefined, 5, "texto", true]) assert.equal(removerCamposSensiveis(v), v);
  });

  test("todas as chaves proibidas são tratadas", () => {
    const todas = Object.fromEntries(CHAVES_PROIBIDAS.map((k) => [k, "segredo"]));
    assert.deepEqual(removerCamposSensiveis({ ...todas, ok: 1 }), { ok: 1 });
  });
});

describe("prepararExportacao", () => {
  const agora = new Date("2031-10-06T15:00:00Z");

  test("devolve o texto do arquivo (JSON legível) e o nome", () => {
    const r = prepararExportacao(valido(), agora);
    assert.equal(r.ok, true);
    assert.equal(r.nome, "sabor-local-meus-dados-2031-10-06.json");
    assert.deepEqual(JSON.parse(r.corpo).conta, { email: "ana@exemplo.com", usuario: "ana" });
    assert.match(r.corpo, /\n {2}"conta"/, "com recuo, para quem abrir no bloco de notas");
  });

  test("remove chaves sensíveis mesmo que o banco as devolva", () => {
    const r = prepararExportacao(valido({ perfil: { nome: "x", owner_id: "u1" }, avaliacoes_recebidas: [{ nota: 5, codigo_verificacao: "AB12" }] }), agora);
    assert.ok(!r.corpo.includes("owner_id"));
    assert.ok(!r.corpo.includes("codigo_verificacao"));
  });

  test("aceita quem ainda não criou o perfil (perfil nulo)", () => {
    assert.equal(prepararExportacao(valido({ perfil: null }), agora).ok, true);
  });

  for (const [nome, entrada] of [
    ["resposta nula", null],
    ["texto", "oi"],
    ["número", 42],
    ["lista", []],
    ["objeto vazio", {}],
  ]) {
    test(`recusa: ${nome}`, () => assert.equal(prepararExportacao(entrada, agora).ok, false));
  }

  test("recusa arquivo sem alguma seção e diz qual faltou", () => {
    const { menu, ...semMenu } = valido();
    void menu;
    const r = prepararExportacao(semMenu, agora);
    assert.equal(r.ok, false);
    assert.match(r.erro, /faltou: menu/);
  });

  test("recusa conta sem e-mail", () => {
    assert.equal(prepararExportacao(valido({ conta: {} }), agora).ok, false);
    assert.equal(prepararExportacao(valido({ conta: null }), agora).ok, false);
  });
});
