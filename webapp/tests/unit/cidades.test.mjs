// Fase 4 (várias cidades) e produção: slug, validação de cidade/bairro, escolha da cidade e aceite dos termos.

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { gerarSlug, validarBairro, validarCadastro, validarCidade } from "../../src/lib/validacao.ts";
import { escolherCidade } from "../../src/lib/cidades-util.ts";

const erro = (r) => (r.ok ? null : r.erro);

describe("slug da cidade", () => {
  const casos = [
    ["Santa Maria", "santa-maria"],
    ["São José dos Pinhais", "sao-jose-dos-pinhais"],
    ["  Foz   do Iguaçu ", "foz-do-iguacu"],
    ["Ji-Paraná", "ji-parana"],
    ["Cidade D'Oeste", "cidade-d-oeste"],
    ["ÀÉÎÕÜ Ç", "aeiou-c"],
    ["123", "123"],
    ["---", ""],
    ["💥", ""],
    ["", ""],
  ];
  for (const [nome, esperado] of casos) {
    test(`${JSON.stringify(nome)} -> ${JSON.stringify(esperado)}`, () => assert.equal(gerarSlug(nome), esperado));
  }

  test("nome enorme é cortado em 60 e não termina com hífen", () => {
    const slug = gerarSlug(`${"a".repeat(59)} b${"c".repeat(40)}`);
    assert.ok(slug.length <= 60);
    assert.ok(!slug.endsWith("-"));
  });

  test("o resultado sempre respeita o formato aceito pelo banco", () => {
    for (const [nome] of casos) {
      const s = gerarSlug(nome);
      if (s) assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

describe("validação de cidade", () => {
  test("nome e UF corretos geram o slug", () => {
    assert.deepEqual(validarCidade({ nome: " Santa  Maria ", uf: "rs" }).valor, { nome: "Santa Maria", uf: "RS", slug: "santa-maria" });
  });
  test("UF é opcional", () => assert.equal(validarCidade({ nome: "Cidade", uf: "" }).valor.uf, null));
  test("slug informado é respeitado", () => assert.equal(validarCidade({ nome: "Santa Maria", uf: "", slug: "sm" }).valor.slug, "sm"));

  const casos = [
    ["nome vazio", { nome: "  ", uf: "" }, "Digite o nome da cidade."],
    ["nome de 1 letra", { nome: "A", uf: "" }, "O nome da cidade precisa ter pelo menos 2 letras."],
    ["nome de 61", { nome: "a".repeat(61), uf: "" }, "O nome da cidade pode ter no máximo 60 caracteres (agora tem 61)."],
    ["UF com 3 letras", { nome: "Cidade", uf: "RSS" }, "O estado (UF) tem 2 letras, por exemplo MG. Deixe em branco se não souber."],
    ["UF com número", { nome: "Cidade", uf: "R1" }, "O estado (UF) tem 2 letras, por exemplo MG. Deixe em branco se não souber."],
    ["nome só de símbolos (slug vazio)", { nome: "!!!", uf: "" }, "O endereço da cidade (slug) só pode ter letras minúsculas, números e hífen, por exemplo santa-maria."],
    ["slug com maiúscula/espaço", { nome: "Cidade", uf: "", slug: "Santa Maria" }, "O endereço da cidade (slug) só pode ter letras minúsculas, números e hífen, por exemplo santa-maria."],
    ["slug com hífen duplo", { nome: "Cidade", uf: "", slug: "a--b" }, "O endereço da cidade (slug) só pode ter letras minúsculas, números e hífen, por exemplo santa-maria."],
    ["slug com injeção", { nome: "Cidade", uf: "", slug: "x'; drop table--" }, "O endereço da cidade (slug) só pode ter letras minúsculas, números e hífen, por exemplo santa-maria."],
  ];
  for (const [nome, entrada, mensagem] of casos) {
    test(nome, () => assert.equal(erro(validarCidade(entrada)), mensagem));
  }
});

describe("validação de bairro", () => {
  test("remove espaços repetidos", () => assert.equal(validarBairro("  Vila   Nova ").valor, "Vila Nova"));
  test("vazio", () => assert.equal(erro(validarBairro("  ")), "Digite o nome do bairro."));
  test("curto", () => assert.equal(erro(validarBairro("A")), "O nome do bairro precisa ter pelo menos 2 letras."));
  test("longo", () => assert.equal(erro(validarBairro("a".repeat(61))), "O nome do bairro pode ter no máximo 60 caracteres (agora tem 61)."));
});

describe("qual cidade mostrar", () => {
  const lista = [{ slug: "santa-maria" }, { slug: "sao-pedro" }, { slug: "agudo" }];

  test("a da URL vence o cookie", () => assert.equal(escolherCidade(lista, "agudo", "sao-pedro").slug, "agudo"));
  test("sem URL, usa o cookie", () => assert.equal(escolherCidade(lista, undefined, "sao-pedro").slug, "sao-pedro"));
  test("sem nada, usa a primeira", () => assert.equal(escolherCidade(lista).slug, "santa-maria"));
  test("slug desconhecido na URL cai para o cookie", () => assert.equal(escolherCidade(lista, "nao-existe", "agudo").slug, "agudo"));
  test("slug desconhecido nos dois cai para a primeira", () => assert.equal(escolherCidade(lista, "x", "y").slug, "santa-maria"));
  test("lista vazia devolve null", () => assert.equal(escolherCidade([], "a", "b"), null));
  test("valores estranhos não quebram", () => {
    for (const x of ["", " ", "__proto__", "constructor", "<script>", "a".repeat(10_000), null]) {
      assert.doesNotThrow(() => escolherCidade(lista, x, x));
    }
  });
});

describe("aceite dos Termos no cadastro", () => {
  const ok = { email: "ze@exemplo.com", username: "pizzaria.do.ze", senha: "senhaboa123", categoriaIds: ["c1"], aceitouTermos: true };

  test("com aceite passa", () => assert.equal(validarCadastro(ok).ok, true));

  test("sem aceite explica o que fazer", () => {
    assert.equal(
      erro(validarCadastro({ ...ok, aceitouTermos: false })),
      "Para criar a conta, marque que você leu e aceita os Termos de Uso e a Política de Privacidade.",
    );
  });

  test("aceite ausente (campo não enviado) conta como não aceito", () => {
    const { aceitouTermos, ...semCampo } = ok;
    void aceitouTermos;
    assert.equal(validarCadastro(semCampo).ok, false);
  });

  test("os outros erros continuam vindo antes do aceite", () => {
    assert.equal(erro(validarCadastro({ ...ok, senha: "123", aceitouTermos: false })), "A senha precisa ter pelo menos 8 caracteres.");
  });
});
