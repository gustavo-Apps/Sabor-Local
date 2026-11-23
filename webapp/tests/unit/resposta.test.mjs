// Responder a quem escreveu no Fale conosco: classificar o contato e montar o link (sem banco, sem rede).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { classificarContato, linkResposta, textoBaseDaResposta } from "../../src/lib/feedback.ts";

describe("classificarContato: e-mail", () => {
  test("aceita e normaliza para minúsculas", () => {
    assert.deepEqual(classificarContato("  Maria.Silva@Exemplo.COM "), { tipo: "email", valor: "maria.silva@exemplo.com" });
  });
  for (const ruim of ["maria@", "@exemplo.com", "maria@exemplo", "ma ria@exemplo.com", "a@b@c.com", "maria@exemplo.com, outro@x.com", "<maria@exemplo.com>", 'maria"@exemplo.com', "a@b.c"]) {
    test(`não é e-mail confiável: ${JSON.stringify(ruim)}`, () => assert.equal(classificarContato(ruim).tipo, "desconhecido"));
  }
  test("e-mail enorme é descartado", () => {
    assert.equal(classificarContato(`${"a".repeat(260)}@exemplo.com`).tipo, "desconhecido");
  });
});

describe("classificarContato: telefone", () => {
  const casos = [
    ["com máscara e DDD", "(55) 99999-1234", "5555999991234"],
    ["só dígitos com 11", "11999991234", "5511999991234"],
    ["fixo com 10 dígitos", "(11) 3333-4444", "551133334444"],
    ["já com 55", "5511999991234", "5511999991234"],
    ["com +55", "+55 11 99999-1234", "5511999991234"],
    ["com pontos e hífens", "11.99999-1234", "5511999991234"],
  ];
  for (const [nome, entrada, esperado] of casos) {
    test(nome, () => assert.deepEqual(classificarContato(entrada), { tipo: "whatsapp", valor: esperado }));
  }

  const recusas = [
    ["curto demais", "99999-123"],
    ["longo demais", "5511999991234567"],
    ["12 dígitos que não começam com 55", "441234567890"],
    ["texto no meio", "ligue 11 99999-1234"],
    ["só texto", "me chama"],
    ["letras e números", "11999991234abc"],
    ["vários telefones", "11999991234 / 11988887777"],
    ["vazio", ""],
    ["só espaços", "   "],
  ];
  for (const [nome, entrada] of recusas) {
    test(`não é telefone confiável: ${nome}`, () => assert.equal(classificarContato(entrada).tipo, "desconhecido"));
  }

  test("nulo e indefinido são desconhecidos", () => {
    assert.equal(classificarContato(null).tipo, "desconhecido");
    assert.equal(classificarContato(undefined).tipo, "desconhecido");
  });
});

describe("linkResposta", () => {
  const f = { tipo: "problema", mensagem: "O botão  não\nresponde", contato: null };

  test("WhatsApp: wa.me com o texto-base citando a mensagem", () => {
    const u = new URL(linkResposta({ ...f, contato: "(11) 99999-1234" }));
    assert.equal(u.origin + u.pathname, "https://wa.me/5511999991234");
    const texto = u.searchParams.get("text");
    assert.match(texto, /Aqui é a equipe do Sabor Local/);
    assert.match(texto, /sobre o problema que você relatou/);
    assert.match(texto, /“O botão não responde”/, "espaços e quebras de linha da mensagem viram um espaço");
  });

  test("e-mail: mailto com assunto e texto-base", () => {
    const l = linkResposta({ ...f, tipo: "duvida", contato: "Maria@Exemplo.com" });
    assert.ok(l.startsWith("mailto:maria@exemplo.com?"));
    const u = new URL(l);
    assert.equal(u.searchParams.get("subject"), "Sabor Local: resposta à sua mensagem");
    assert.match(u.searchParams.get("body"), /sobre a sua dúvida/);
  });

  test("sem contato confiável não há link", () => {
    for (const contato of [null, "", "ligue pra mim", "javascript:alert(1)", "http://evil.com", "11999991234; rm -rf"]) {
      assert.equal(linkResposta({ ...f, contato }), null, String(contato));
    }
  });

  test("nada que a pessoa digitou na mensagem consegue trocar o destino do link", () => {
    const hostil = 'oi&to=outro@x.com&cc=a@b.com\n\nBcc: x@y.com "><script>alert(1)</script>';
    const mail = new URL(linkResposta({ ...f, mensagem: hostil, contato: "maria@exemplo.com" }));
    assert.equal(mail.pathname, "maria@exemplo.com");
    assert.equal(mail.searchParams.get("to"), null);
    assert.equal(mail.searchParams.get("cc"), null);
    const wa = new URL(linkResposta({ ...f, mensagem: hostil, contato: "11999991234" }));
    assert.equal(wa.searchParams.get("phone"), null);
    assert.equal(wa.pathname, "/5511999991234");
  });

  test("mensagem longa é resumida e o texto-base tem um tamanho razoável", () => {
    const t = textoBaseDaResposta({ tipo: "sugestao", mensagem: "a".repeat(1000) });
    assert.ok(t.length < 260, `tamanho ${t.length}`);
    assert.ok(t.includes("..."));
    assert.match(t, /sobre a sua sugestão/);
  });

  test("os três tipos de mensagem têm texto", () => {
    for (const tipo of ["problema", "sugestao", "duvida"]) assert.match(textoBaseDaResposta({ tipo, mensagem: "x" }), /respondendo sobre/);
  });
});
