// Novo aceite dos Termos: o vendedor atualiza só o próprio registro, e só com uma versão em formato válido.

import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto } from "../helpers.mjs";
import { TERMOS_VERSAO } from "../../src/lib/legal.ts";

const ctx = new Contexto();
let ana;
let beto;

const registro = async (vendedor) =>
  (await admin.from("perfis_vendedor").select("termos_versao, termos_aceitos_em").eq("username", vendedor.username).single()).data;

before(async () => {
  ana = await ctx.novoVendedor({ aprovado: true });
  beto = await ctx.novoVendedor({ aprovado: true });
  const antigo = new Date(Date.now() - 90 * 86_400_000).toISOString();
  await admin.from("perfis_vendedor").update({ termos_versao: "2020-01", termos_aceitos_em: antigo }).in("username", [ana.username, beto.username]);
});
after(() => ctx.limpar());

describe("aceitar_termos", () => {
  test("grava a versão e a data de agora no perfil de quem chamou, e só nele", async () => {
    const { error } = await ana.client.rpc("aceitar_termos", { p_versao: "2027-03" });
    assert.ifError(error);
    const a = await registro(ana);
    assert.equal(a.termos_versao, "2027-03");
    assert.ok(Date.parse(a.termos_aceitos_em) > Date.now() - 60_000, "a data deve ser de agora");
    assert.equal((await registro(beto)).termos_versao, "2020-01", "o outro vendedor não muda");
  });

  test("a versão atual do código é aceita pelo banco", async () => {
    assert.ifError((await beto.client.rpc("aceitar_termos", { p_versao: TERMOS_VERSAO })).error);
    assert.equal((await registro(beto)).termos_versao, TERMOS_VERSAO);
  });

  test("aceitar de novo atualiza a data", async () => {
    const antes = (await registro(ana)).termos_aceitos_em;
    await new Promise((r) => setTimeout(r, 30));
    await ana.client.rpc("aceitar_termos", { p_versao: "2027-03-b" });
    const depois = await registro(ana);
    assert.equal(depois.termos_versao, "2027-03-b");
    assert.ok(Date.parse(depois.termos_aceitos_em) > Date.parse(antes));
  });

  for (const versao of ["", "x", "2026", "2026-1", "2026-10-", "2026-10-ABC", "2026-10 b", "2026-10'; drop table perfis_vendedor;--", "2026-10-aaaaaaaaaaa", null]) {
    test(`recusa versão fora do formato: ${JSON.stringify(versao)}`, async () => {
      const { error } = await ana.client.rpc("aceitar_termos", { p_versao: versao });
      assert.match(error?.message ?? "", /versao_invalida/);
    });
  }

  test("visitante sem login não consegue", async () => {
    const { error } = await anonimo().rpc("aceitar_termos", { p_versao: "2027-03" });
    assert.ok(error);
  });

  test("quem ainda não tem perfil de vendedor não dá erro (nada a atualizar)", async () => {
    const sem = await ctx.novoVendedor({ semPerfil: true });
    assert.ifError((await sem.client.rpc("aceitar_termos", { p_versao: "2027-03" })).error);
  });
});

describe("não há outro caminho para mexer no registro do aceite", () => {
  test("o vendedor não edita perfis_vendedor direto (0 linhas)", async () => {
    const { data } = await ana.client.from("perfis_vendedor").update({ termos_versao: "2099-01" }).eq("username", ana.username).select();
    assert.equal(data?.length ?? 0, 0);
    assert.notEqual((await registro(ana)).termos_versao, "2099-01");
  });

  test("nem apagar nem inserir pelo cliente", async () => {
    const apagar = await ana.client.from("perfis_vendedor").delete().eq("username", ana.username).select();
    assert.equal(apagar.data?.length ?? 0, 0);
    const inserir = await ana.client.from("perfis_vendedor").insert({ user_id: ana.id, username: `x_${ana.username}` });
    assert.ok(inserir.error);
  });

  test("o aceite aparece no arquivo 'Baixar meus dados'", async () => {
    await ana.client.rpc("aceitar_termos", { p_versao: "2027-04" });
    const { data } = await ana.client.rpc("exportar_meus_dados");
    assert.equal(data.conta.termos_versao, "2027-04");
    assert.ok(data.conta.termos_aceitos_em);
  });
});
