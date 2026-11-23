// Bloqueio de login do próprio app (migration 0007): 10 erros por conta e
// 30 por IP em 15 minutos. Testa as funções do banco que a Server Action usa.

import test, { after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, emLotes } from "../helpers.mjs";

const ctx = new Contexto();
after(async () => {
  await admin.from("tentativas_login").delete().gte("id", 0);
  await ctx.limpar();
});
beforeEach(() => admin.from("tentativas_login").delete().gte("id", 0));

const falhar = (conta, ip = "9.9.9.9") => admin.rpc("registrar_falha_login", { p_conta: conta, p_ip: ip });
const bloqueado = async (conta, ip = "9.9.9.9") => (await admin.rpc("login_bloqueado", { p_conta: conta, p_ip: ip })).data;

describe("bloqueio por conta", () => {
  test("9 erros ainda deixam tentar; o 10º bloqueia", async () => {
    for (let i = 0; i < 9; i++) await falhar("ze", `1.1.1.${i}`);
    assert.equal(await bloqueado("ze", "2.2.2.2"), false);
    await falhar("ze", "1.1.1.99");
    assert.equal(await bloqueado("ze", "2.2.2.2"), true, "mesmo de outro IP");
  });

  test("não distingue maiúsculas nem espaços (ZE, ' ze ')", async () => {
    for (let i = 0; i < 10; i++) await falhar(i % 2 ? "ZE" : " ze ", `3.3.3.${i}`);
    assert.equal(await bloqueado("Ze", "4.4.4.4"), true);
  });

  test("bloquear uma conta não bloqueia as outras", async () => {
    for (let i = 0; i < 10; i++) await falhar("vitima", `5.5.5.${i}`);
    assert.equal(await bloqueado("vitima"), true);
    assert.equal(await bloqueado("outra.pessoa", "6.6.6.6"), false);
  });

  test("login correto zera o contador da conta", async () => {
    for (let i = 0; i < 9; i++) await falhar("ze", `1.1.1.${i}`);
    await admin.rpc("limpar_falhas_login", { p_conta: "ze" });
    for (let i = 0; i < 9; i++) await falhar("ze", `1.1.2.${i}`);
    assert.equal(await bloqueado("ze", "2.2.2.2"), false);
  });

  test("falhas com mais de 15 minutos não contam", async () => {
    for (let i = 0; i < 10; i++) await falhar("antigo", `7.7.7.${i}`);
    await admin.from("tentativas_login").update({ created_at: new Date(Date.now() - 16 * 60 * 1000).toISOString() }).eq("tipo", "conta");
    assert.equal(await bloqueado("antigo", "8.8.8.8"), false);
  });
});

describe("bloqueio por IP (credential stuffing: muitas contas, um atacante)", () => {
  test("30 erros de um IP em contas DIFERENTES bloqueiam o IP", async () => {
    for (let i = 0; i < 30; i++) await falhar(`conta${i}`, "66.66.66.66");
    assert.equal(await bloqueado("conta-nova", "66.66.66.66"), true);
    assert.equal(await bloqueado("conta-nova", "77.77.77.77"), false, "outro IP segue livre");
  });

  test("IP vazio (cabeçalho ausente) não bloqueia todo mundo", async () => {
    for (let i = 0; i < 40; i++) await falhar(`c${i}`, "");
    assert.equal(await bloqueado("alguem", ""), false);
  });
});

describe("ataque em massa contra a conta de um vendedor real", () => {
  test("500 tentativas paralelas: o contador trava a conta logo no começo", async () => {
    const ze = await ctx.novoVendedor({ aprovado: true, semLogin: true });
    let processadas = 0;
    await emLotes(500, 25, async (i) => {
      if (await bloqueado(ze.username, `10.0.${i % 250}.1`)) return;
      processadas++; // só chega aqui quem NÃO foi barrado: a Server Action tentaria a senha
      await falhar(ze.username, `10.0.${i % 250}.1`);
    });
    console.log(`   senhas efetivamente testadas: ${processadas} de 500`);
    assert.ok(processadas <= 10 + 25, `${processadas} tentativas passaram`);
  });
});

describe("permissões", () => {
  test("ninguém além do backend executa as funções de bloqueio", async () => {
    const ze = await ctx.novoVendedor({ semPerfil: true });
    for (const cliente of [anonimo(), ze.client]) {
      for (const [fn, args] of [
        ["login_bloqueado", { p_conta: "x", p_ip: "1.1.1.1" }],
        ["registrar_falha_login", { p_conta: "x", p_ip: "1.1.1.1" }],
        ["limpar_falhas_login", { p_conta: "x" }],
      ]) {
        const { error } = await cliente.rpc(fn, args);
        assert.ok(error, `${fn} não pode ser chamada por visitante/vendedor (senão dá para travar contas alheias)`);
      }
    }
  });

  test("a tabela de tentativas não é legível pela API", async () => {
    await falhar("x");
    const { data, error } = await anonimo().from("tentativas_login").select("*");
    assert.ok(error || data.length === 0);
  });
});
