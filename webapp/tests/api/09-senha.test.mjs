// Troca de senha: o mecanismo que a tela /redefinir-senha usa (sessão + updateUser).
// O envio do e-mail não é testado aqui (o CI sobe o Supabase sem o servidor de e-mail).

import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { anonimo, cfg, Contexto } from "../helpers.mjs";

const ctx = new Contexto();
let ana;

before(async () => {
  ana = await ctx.novoVendedor({ aprovado: true });
});
after(() => ctx.limpar());

const entrar = (email, senha) => anonimo().auth.signInWithPassword({ email, password: senha });

describe("trocar a senha pela sessão", () => {
  test("com a nova senha entra; com a antiga não", async () => {
    const nova = `Nova-${ana.senha}-x`;
    const { error } = await ana.client.auth.updateUser({ password: nova });
    assert.ifError(error);

    assert.ifError((await entrar(ana.email, nova)).error);
    const antiga = await entrar(ana.email, ana.senha);
    assert.ok(antiga.error, "a senha antiga não pode mais funcionar");
  });

  test("senha igual à atual é recusada (same_password)", async () => {
    const nova = `Outra-${ana.senha}-y`;
    assert.ifError((await ana.client.auth.updateUser({ password: nova })).error);
    const { error } = await ana.client.auth.updateUser({ password: nova });
    assert.equal(error?.code, "same_password");
  });

  test("senha curta demais é recusada pelo Auth (a tela já barra antes)", async () => {
    const { error } = await ana.client.auth.updateUser({ password: "123" });
    assert.ok(error);
  });

  test("sem sessão ninguém troca a senha de ninguém", async () => {
    const { error } = await anonimo().auth.updateUser({ password: "Qualquer-coisa-123" });
    assert.ok(error, "visitante sem sessão não pode trocar senha");
  });

  test("trocar a própria senha não mexe na senha de outra conta", async () => {
    const outro = await ctx.novoVendedor({ aprovado: true });
    const senhaAntes = outro.senha;
    await ana.client.auth.updateUser({ password: `Troca-${ana.senha}-z` });
    assert.ifError((await entrar(outro.email, senhaAntes)).error);
  });
});

describe("e-mail de recuperação não revela contas", () => {
  test("a função que acha o e-mail pelo usuário não é pública", async () => {
    const pub = createClient(cfg.url, cfg.pub, { auth: { persistSession: false } });
    const { data, error } = await pub.rpc("email_por_username", { p_username: "qualquer" });
    assert.ok(error || !data, "visitante não pode consultar e-mail por usuário");
  });
});
