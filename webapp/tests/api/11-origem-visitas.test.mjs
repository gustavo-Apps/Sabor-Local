// Origem das visitas: registro com origem, ignorar origem estranha e o resumo por origem do próprio vendedor.

import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, zerarLimites } from "../helpers.mjs";

const ctx = new Contexto();
let ana;
let beto;

before(async () => {
  ana = await ctx.novoVendedor({ aprovado: true });
  beto = await ctx.novoVendedor({ aprovado: true });
});
beforeEach(async () => {
  await zerarLimites();
  await admin.from("eventos").delete().in("vendedor_id", [ana.vendedorId, beto.vendedorId]);
});
after(() => ctx.limpar());

const visita = (c, vendedorId, origem) =>
  c.rpc("registrar_evento", { p_tipo: "visita_vendedor", p_vendedor: vendedorId, ...(origem === undefined ? {} : { p_origem: origem }) });
const origens = async (vendedorId) =>
  (await admin.from("eventos").select("origem").eq("vendedor_id", vendedorId).order("id")).data.map((e) => e.origem);

describe("registrar_evento com origem", () => {
  test("guarda a origem conhecida na visita ao perfil", async () => {
    for (const o of ["whatsapp", "facebook", "instagram", "link", "qr"]) assert.ifError((await visita(anonimo(), ana.vendedorId, o)).error);
    assert.deepEqual(await origens(ana.vendedorId), ["whatsapp", "facebook", "instagram", "link", "qr"]);
  });

  test("a chamada antiga, sem origem, continua funcionando", async () => {
    assert.ifError((await visita(anonimo(), ana.vendedorId)).error);
    assert.deepEqual(await origens(ana.vendedorId), [null]);
  });

  test("origem desconhecida ou hostil vira nula e não derruba a visita", async () => {
    for (const o of ["twitter", "WHATSAPP", "", " whatsapp", "' or 1=1 --", "<script>alert(1)</script>", "💥", "a".repeat(5000)]) {
      assert.ifError((await visita(anonimo(), ana.vendedorId, o)).error, JSON.stringify(o.slice(0, 20)));
    }
    assert.ok((await origens(ana.vendedorId)).every((o) => o === null));
  });

  test("toque no WhatsApp e visita ao site não guardam origem", async () => {
    await anonimo().rpc("registrar_evento", { p_tipo: "whatsapp", p_vendedor: ana.vendedorId, p_origem: "whatsapp" });
    await anonimo().rpc("registrar_evento", { p_tipo: "visita_site", p_vendedor: null, p_origem: "facebook" });
    assert.deepEqual(await origens(ana.vendedorId), [null]);
    const { data } = await admin.from("eventos").select("origem").eq("tipo", "visita_site").not("origem", "is", null);
    assert.equal(data.length, 0);
  });

  test("o banco recusa origem fora da lista se alguém gravar direto", async () => {
    const { error } = await admin.from("eventos").insert({ tipo: "visita_vendedor", vendedor_id: ana.vendedorId, origem: "twitter" });
    assert.equal(error?.code, "23514");
  });
});

describe("visitas_por_origem", () => {
  const resumo = async (c, dias) => (await c.rpc("visitas_por_origem", dias === undefined ? {} : { p_dias: dias }));

  test("o vendedor vê as visitas por origem, da maior para a menor, com 'direto' para as sem origem", async () => {
    for (const o of ["whatsapp", "whatsapp", "whatsapp", "qr", "qr", undefined]) await visita(anonimo(), ana.vendedorId, o);
    const { data, error } = await resumo(ana.client);
    assert.ifError(error);
    assert.deepEqual(data.map((r) => [r.origem, Number(r.visitas)]), [["whatsapp", 3], ["qr", 2], ["direto", 1]]);
  });

  test("cada vendedor só enxerga o próprio resumo", async () => {
    await visita(anonimo(), ana.vendedorId, "whatsapp");
    await visita(anonimo(), beto.vendedorId, "facebook");
    const a = (await resumo(ana.client)).data.map((r) => r.origem);
    const b = (await resumo(beto.client)).data.map((r) => r.origem);
    assert.deepEqual(a, ["whatsapp"]);
    assert.deepEqual(b, ["facebook"]);
  });

  test("não conta toques no WhatsApp, só visitas ao perfil", async () => {
    await anonimo().rpc("registrar_evento", { p_tipo: "whatsapp", p_vendedor: ana.vendedorId });
    assert.equal((await resumo(ana.client)).data.length, 0);
  });

  test("respeita a janela de dias e limita o valor (1 a 90)", async () => {
    const velho = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString();
    await admin.from("eventos").insert({ tipo: "visita_vendedor", vendedor_id: ana.vendedorId, origem: "qr", created_at: velho });
    assert.equal((await resumo(ana.client, 30)).data.length, 0);
    assert.equal((await resumo(ana.client, 60)).data.length, 1);
    for (const dias of [0, -5, 999999, null]) assert.ifError((await resumo(ana.client, dias)).error, String(dias));
  });

  test("visitante sem login não consegue chamar a função", async () => {
    const { error } = await anonimo().rpc("visitas_por_origem", { p_dias: 30 });
    assert.ok(error, "anônimo não pode ler métricas");
  });

  test("quem não tem perfil recebe lista vazia, sem erro", async () => {
    const sem = await ctx.novoVendedor({ semPerfil: true });
    const { data, error } = await resumo(sem.client);
    assert.ifError(error);
    assert.deepEqual(data, []);
  });
});
