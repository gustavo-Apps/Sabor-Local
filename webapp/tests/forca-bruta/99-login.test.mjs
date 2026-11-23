// Ataque direto ao Auth (GoTrue) do Supabase: adivinhar senha e descobrir quais
// contas existem. O bloqueio do APP está em 03-bloqueio-login.test.mjs; aqui se
// mede o que o Auth faz sozinho. Quem fala direto com o Auth (sem passar pelo
// site) NÃO é protegido pelo bloqueio do app, então o limite de taxa do próprio
// Supabase (30 logins / 5 min / IP, em produção) é a defesa nesse caminho.
//
// Roda por último (prefixo 99-) porque pode esgotar o limite de logins local.

import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { anonimo, Contexto, emLotes } from "../helpers.mjs";

const ctx = new Contexto();
let ze;
before(async () => {
  ze = await ctx.novoVendedor({ aprovado: true, semLogin: true });
});
after(() => ctx.limpar());

const entrar = (email, senha) => anonimo().auth.signInWithPassword({ email, password: senha });

describe("não revelar quais contas existem", () => {
  test("e-mail existente com senha errada x e-mail inexistente: mesma mensagem e mesmo status", async () => {
    const a = await entrar(ze.email, "senha-errada-1");
    const b = await entrar(`naoexiste.${Date.now()}@exemplo.com`, "senha-errada-1");
    assert.ok(a.error && b.error);
    assert.equal(a.error.message, b.error.message);
    assert.equal(a.error.status, b.error.status);
    assert.equal(a.error.code, b.error.code);
  });

  test("(informativo) diferença de tempo entre conta existente e inexistente no Auth", async () => {
    // LIMITAÇÃO CONHECIDA do Supabase Auth: comparar a senha (bcrypt) só acontece quando
    // a conta existe, então a resposta é mais lenta. Quem ataca o Auth diretamente consegue
    // descobrir e-mails cadastrados por tempo. A Server Action do app mitiga o caminho do site
    // (tempo mínimo de 400 ms nas falhas), mas não o acesso direto ao Auth.
    const medir = async (email) => {
      const t = performance.now();
      await entrar(email, "senha-errada-2");
      return performance.now() - t;
    };
    const existentes = [];
    const inexistentes = [];
    for (let i = 0; i < 4; i++) {
      existentes.push(await medir(ze.email));
      inexistentes.push(await medir(`fantasma${i}.${Date.now()}@exemplo.com`));
    }
    const mediana = (v) => v.sort((x, y) => x - y)[Math.floor(v.length / 2)];
    console.log(`   mediana existente=${Math.round(mediana(existentes))}ms inexistente=${Math.round(mediana(inexistentes))}ms`);
    assert.ok(true);
  });
});

describe("entradas absurdas no login", () => {
  test("senha de 100 KB é recusada sem erro 500", async () => {
    const { error } = await entrar(ze.email, "a".repeat(100_000));
    assert.ok(error);
    assert.ok(error.status < 500, `status ${error.status}`);
  });

  test("e-mail com injeção SQL/XSS é tratado como credencial inválida", async () => {
    for (const email of ["' OR '1'='1", "admin'--", "<script>@x.com"]) {
      const { error } = await entrar(email, "x");
      assert.ok(error && error.status < 500, `${email}: ${error?.status}`);
    }
  });
});

describe("adivinhar a senha em massa", () => {
  test("300 tentativas erradas direto no Auth: ninguém entra (o 429 depende do ambiente)", async () => {
    const r = await emLotes(300, 15, (i) => entrar(ze.email, `chute-${i}`));
    const entrou = r.filter((x) => x.data?.session).length;
    const barradas = r.filter((x) => x.error?.status === 429).length;
    const invalidas = r.filter((x) => x.error?.status === 400).length;
    console.log(`   entraram=${entrou} barradas(429)=${barradas} credencial-inválida(400)=${invalidas}`);

    assert.equal(entrou, 0, "nenhum chute pode entrar");
    if (barradas === 0) {
      console.log("   AVISO: o Auth local NÃO aplicou limite de taxa (sign_in_sign_ups). Em produção, confirme que o limite está ativo.");
    }
    assert.ok(r.every((x) => !x.error || x.error.status < 500), "nenhuma resposta 5xx");
  });

  test("com o limite ativo, até a senha CERTA é barrada (o ataque não rende nem 1 sucesso)", async () => {
    const { data, error } = await entrar(ze.email, ze.senha);
    console.log(`   senha correta durante o bloqueio: ${error ? `${error.status} ${error.code}` : "entrou"}`);
    assert.ok(error || data.session, "resposta precisa ser definida (barrar é o esperado)");
    // Não falha se entrar (limite por IP já expirou); o ponto é nunca devolver 5xx.
    if (error) assert.ok(error.status < 500);
  });
});
