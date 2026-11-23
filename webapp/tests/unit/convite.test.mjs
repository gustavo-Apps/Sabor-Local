// Convite de avaliação: validações, e-mail do convite e envio (sem banco; o envio usa um fetch falso).

import test, { afterEach, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { MENSAGENS_AVALIACAO, mascararEmail, validarAvaliacao, validarConfiguracoes, validarEmailConvite, validarNomeDoAvaliador } from "../../src/lib/validacao.ts";
import { emailConfigurado, enviarEmail, montarConviteDeAvaliacao, podeSimularEmail } from "../../src/lib/email.ts";

describe("validarEmailConvite", () => {
  test("aceita e normaliza", () => {
    assert.deepEqual(validarEmailConvite("  Maria.Silva@Gmail.COM "), { ok: true, valor: "maria.silva@gmail.com" });
  });

  for (const [nome, entrada, esperado] of [
    ["vazio", "", /Digite o e-mail do cliente/],
    ["só espaços", "   ", /Digite o e-mail do cliente/],
    ["sem arroba", "mariagmail.com", /E-mail inválido/],
    ["sem domínio", "maria@", /E-mail inválido/],
    ["sem ponto no domínio", "maria@gmail", /E-mail inválido/],
    ["com espaço no meio", "ma ria@gmail.com", /E-mail inválido/],
    ["dois arrobas", "a@b@c.com", /E-mail inválido/],
    ["enorme", `${"a".repeat(250)}@x.com`, /E-mail inválido/],
  ]) {
    test(`recusa: ${nome}`, () => {
      const r = validarEmailConvite(entrada);
      assert.equal(r.ok, false);
      assert.match(r.erro, esperado);
    });
  }

  test("entradas hostis não derrubam", () => {
    for (const e of ["\0", "💥".repeat(5000), "<script>@x.com", "a\r\nBcc: x@y.com@z.com", "x@y.com\nBcc: outro@z.com"]) {
      assert.doesNotThrow(() => validarEmailConvite(e));
    }
  });

  test("quebra de linha no meio não passa (evita injeção de cabeçalho de e-mail)", () => {
    assert.equal(validarEmailConvite("x@y.com\nBcc: outro@z.com").ok, false);
    assert.equal(validarEmailConvite("x@y.com\r\nBcc: outro@z.com").ok, false);
  });
});

describe("mascararEmail", () => {
  test("mostra só a primeira letra", () => {
    assert.equal(mascararEmail("Maria@Gmail.com"), "m***@gmail.com");
    assert.equal(mascararEmail("a@b.co"), "a***@b.co");
  });
  test("não quebra com entrada estranha", () => {
    assert.doesNotThrow(() => mascararEmail(""));
    assert.doesNotThrow(() => mascararEmail("sem-arroba"));
  });
});

describe("validarAvaliacao", () => {
  test("aceita nota de 1 a 5 e comentário vazio ou até 500", () => {
    assert.deepEqual(validarAvaliacao({ nota: 5, comentario: "  " }), { ok: true, valor: { nota: 5, comentario: null } });
    assert.equal(validarAvaliacao({ nota: 1, comentario: "a".repeat(500) }).ok, true);
  });
  test("recusa nota fora da faixa ou quebrada", () => {
    for (const nota of [0, 6, -1, 2.5, NaN, Infinity]) assert.match(validarAvaliacao({ nota, comentario: "" }).erro, /nota de 1 a 5/);
  });
  test("recusa comentário acima de 500 e diz quantos tem", () => {
    assert.match(validarAvaliacao({ nota: 5, comentario: "a".repeat(501) }).erro, /no máximo 500 caracteres \(agora tem 501\)/);
  });
});

describe("MENSAGENS_AVALIACAO", () => {
  test("todo resultado de erro da função do banco tem texto para o cliente", () => {
    for (const r of ["convite_invalido", "convite_usado", "convite_expirado", "comentario_longo", "nota_invalida", "muitas_tentativas"]) {
      assert.ok(MENSAGENS_AVALIACAO[r], r);
    }
  });
});

describe("montarConviteDeAvaliacao", () => {
  const link = "https://saborlocal.com.br/avaliar/" + "a".repeat(64);

  test("o link aparece no texto e no HTML, e o assunto cita a loja", () => {
    const m = montarConviteDeAvaliacao("Pizzaria do Zé", link);
    assert.match(m.assunto, /Pizzaria do Zé/);
    assert.ok(m.texto.includes(link));
    assert.ok(m.html.includes(`href="${link}"`));
  });

  test("nome da loja com HTML não vira marcação no e-mail", () => {
    const m = montarConviteDeAvaliacao('<img src=x onerror="alert(1)">', link);
    assert.ok(!m.html.includes("<img"), "tag solta no HTML");
    assert.ok(m.html.includes("&#60;img"));
  });

  test("aviso de segurança: link pessoal, 30 dias, ignorar se não pediu", () => {
    const m = montarConviteDeAvaliacao("Loja", link);
    for (const t of ["só seu", "30 dias", "ignorar"]) assert.ok(m.texto.includes(t), t);
  });
});

describe("enviarEmail", () => {
  const original = { fetch: globalThis.fetch, env: { ...process.env }, info: console.info };
  let chamadas;

  beforeEach(() => {
    chamadas = [];
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_REMETENTE;
    delete process.env.RESEND_API_URL;
    console.info = () => {};
  });
  afterEach(() => {
    globalThis.fetch = original.fetch;
    console.info = original.info;
    for (const k of ["RESEND_API_KEY", "EMAIL_REMETENTE", "RESEND_API_URL", "NODE_ENV"]) {
      if (original.env[k] === undefined) delete process.env[k];
      else process.env[k] = original.env[k];
    }
  });

  const msg = { para: "cliente@exemplo.com", assunto: "Olá", texto: "corpo", html: "<p>corpo</p>" };
  const configurar = () => {
    process.env.RESEND_API_KEY = "chave-secreta";
    process.env.EMAIL_REMETENTE = "Sabor Local <avisos@exemplo.com>";
  };

  test("com chave, chama o Resend com o formato certo", async () => {
    configurar();
    globalThis.fetch = async (url, opcoes) => {
      chamadas.push({ url, opcoes });
      return { ok: true };
    };
    assert.deepEqual(await enviarEmail(msg), { ok: true, modo: "resend" });
    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0].url, "https://api.resend.com/emails");
    assert.equal(chamadas[0].opcoes.method, "POST");
    assert.equal(chamadas[0].opcoes.headers.Authorization, "Bearer chave-secreta");
    assert.deepEqual(JSON.parse(chamadas[0].opcoes.body), {
      from: "Sabor Local <avisos@exemplo.com>",
      to: ["cliente@exemplo.com"],
      subject: "Olá",
      text: "corpo",
      html: "<p>corpo</p>",
    });
  });

  test("RESEND_API_URL troca o endereço (servidor falso nos testes)", async () => {
    configurar();
    process.env.RESEND_API_URL = "http://localhost:4010/emails";
    globalThis.fetch = async (url) => {
      chamadas.push(url);
      return { ok: true };
    };
    await enviarEmail(msg);
    assert.deepEqual(chamadas, ["http://localhost:4010/emails"]);
  });

  test("resposta de erro do provedor vira falha_no_envio", async () => {
    configurar();
    globalThis.fetch = async () => ({ ok: false, status: 422 });
    assert.deepEqual(await enviarEmail(msg), { ok: false, erro: "falha_no_envio" });
  });

  test("falha de rede ou tempo esgotado vira falha_no_envio, sem lançar erro", async () => {
    configurar();
    globalThis.fetch = async () => {
      throw new Error("rede caiu");
    };
    assert.deepEqual(await enviarEmail(msg), { ok: false, erro: "falha_no_envio" });
  });

  test("a chave nunca aparece no corpo enviado", async () => {
    configurar();
    globalThis.fetch = async (_url, opcoes) => {
      chamadas.push(opcoes.body);
      return { ok: true };
    };
    await enviarEmail(msg);
    assert.ok(!chamadas[0].includes("chave-secreta"));
  });

  test("sem chave, fora de produção: modo log (o e-mail sai no terminal)", async () => {
    process.env.NODE_ENV = "development";
    globalThis.fetch = async () => assert.fail("não deveria chamar a rede");
    assert.equal(podeSimularEmail(), true);
    assert.deepEqual(await enviarEmail(msg), { ok: true, modo: "log" });
  });

  test("sem chave, em produção: recusa (não finge que enviou)", async () => {
    process.env.NODE_ENV = "production";
    globalThis.fetch = async () => assert.fail("não deveria chamar a rede");
    assert.equal(podeSimularEmail(), false);
    assert.deepEqual(await enviarEmail(msg), { ok: false, erro: "nao_configurado" });
  });

  test("só a chave, sem remetente, conta como não configurado", () => {
    process.env.RESEND_API_KEY = "x";
    assert.equal(emailConfigurado(), false);
    process.env.EMAIL_REMETENTE = "a@b.com";
    assert.equal(emailConfigurado(), true);
  });
});

describe("validarNomeDoAvaliador", () => {
  const casos = [
    ["vazio é anônimo", "", null],
    ["só espaços é anônimo", "   ", null],
    ["tira espaços sobrando", "  Maria   Silva ", "Maria Silva"],
    ["aceita apelido com acento", "Zé do Açaí", "Zé do Açaí"],
    ["tira caracteres de controle", "Ma\u0000ri\u0007a", "Maria"],
  ];
  for (const [nome, entrada, esperado] of casos) {
    test(nome, () => assert.deepEqual(validarNomeDoAvaliador(entrada), { ok: true, valor: esperado }));
  }

  test("aceita 40 caracteres e recusa 41", () => {
    assert.equal(validarNomeDoAvaliador("a".repeat(40)).ok, true);
    assert.match(validarNomeDoAvaliador("a".repeat(41)).erro, /no máximo 40 caracteres \(agora tem 41\)/);
  });

  for (const ruim of ["maria@gmail.com", "www.loja.com", "https://x.com", "11999990000", "Fulano 12345"]) {
    test(`recusa site, e-mail ou telefone no lugar do nome: ${ruim}`, () => {
      assert.match(validarNomeDoAvaliador(ruim).erro, /site, e-mail nem telefone/);
    });
  }

  test("número curto no apelido passa (ex.: Zé 10)", () => assert.equal(validarNomeDoAvaliador("Zé 10").ok, true));
});

describe("validarConfiguracoes", () => {
  test("exigir/liberar viram verdadeiro/falso", () => {
    assert.deepEqual(validarConfiguracoes({ avaliacoes: "exigir", vendedores: "liberar" }), {
      ok: true,
      valor: { avaliacoes_exigem_aprovacao: true, vendedores_exigem_aprovacao: false },
    });
    assert.deepEqual(validarConfiguracoes({ avaliacoes: "liberar", vendedores: "exigir" }).valor, {
      avaliacoes_exigem_aprovacao: false,
      vendedores_exigem_aprovacao: true,
    });
  });
  test("qualquer outro valor é recusado (nada de gravar por engano)", () => {
    for (const [avaliacoes, vendedores] of [["", "exigir"], ["exigir", ""], ["true", "exigir"], ["exigir", "talvez"]]) {
      assert.equal(validarConfiguracoes({ avaliacoes, vendedores }).ok, false);
    }
  });
});
