// Fale conosco: envio público com validação e limite, leitura só do administrador e retenção.

import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, zerarLimites } from "../helpers.mjs";

const ctx = new Contexto();
const MARCA = "TESTE-FEEDBACK";
let dono;
let adm;

before(async () => {
  dono = await ctx.novoVendedor({ aprovado: true });
  adm = await ctx.novoVendedor({ aprovado: true, ehAdmin: true });
});
beforeEach(async () => {
  await zerarLimites();
  await admin.from("feedbacks").delete().like("mensagem", `${MARCA}%`);
});
after(async () => {
  await admin.from("feedbacks").delete().like("mensagem", `${MARCA}%`);
  await ctx.limpar();
});

const enviar = (c, extra = {}) =>
  c.rpc("enviar_feedback", {
    p_tipo: "problema",
    p_mensagem: `${MARCA} o botão não responde`,
    p_pagina: "/painel",
    p_contato: "contato@exemplo.com",
    ...extra,
  });

describe("enviar_feedback: validação", () => {
  test("visitante envia, e a mensagem chega com status novo", async () => {
    assert.ifError((await enviar(anonimo())).error);
    const { data } = await admin.from("feedbacks").select("*").like("mensagem", `${MARCA}%`);
    assert.equal(data.length, 1);
    assert.equal(data[0].status, "novo");
    assert.equal(data[0].pagina, "/painel");
    assert.ok(data[0].ip_hash, "guarda só o hash do IP, para o limite");
  });

  for (const [rotulo, extra, esperado] of [
    ["tipo inexistente", { p_tipo: "hack" }, /tipo_invalido/],
    ["tipo vazio", { p_tipo: "" }, /tipo_invalido/],
    ["mensagem curta", { p_mensagem: "oi" }, /mensagem_curta/],
    ["mensagem só de espaços", { p_mensagem: "          " }, /mensagem_curta/],
    ["mensagem longa demais", { p_mensagem: `${MARCA} ${"a".repeat(1001)}` }, /mensagem_longa/],
  ]) {
    test(`recusa: ${rotulo}`, async () => {
      const { error } = await enviar(anonimo(), extra);
      assert.match(error?.message ?? "", esperado);
    });
  }

  test("corta página e contato nos limites e guarda vazio como nulo", async () => {
    await enviar(anonimo(), { p_pagina: "/" + "x".repeat(400), p_contato: "   " });
    const { data } = await admin.from("feedbacks").select("pagina, contato").like("mensagem", `${MARCA}%`).single();
    assert.equal(data.pagina.length, 200);
    assert.equal(data.contato, null);
  });

  test("aceita texto com HTML e emoji sem alterar (a tela é que escapa)", async () => {
    const texto = `${MARCA} <script>alert(1)</script> 😀 'aspas'`;
    assert.ifError((await enviar(anonimo(), { p_mensagem: texto })).error);
    const { data } = await admin.from("feedbacks").select("mensagem").like("mensagem", `${MARCA}%`).single();
    assert.equal(data.mensagem, texto);
  });

  test("faltando parâmetros, o PostgREST recusa", async () => {
    const { error } = await anonimo().rpc("enviar_feedback", { p_tipo: "problema", p_mensagem: `${MARCA} sem os outros campos` });
    assert.ok(error);
  });
});

describe("enviar_feedback: limites", () => {
  test("o 6º envio seguido da mesma origem é barrado", async () => {
    for (let i = 0; i < 5; i++) assert.ifError((await enviar(anonimo(), { p_mensagem: `${MARCA} mensagem número ${i}` })).error);
    const { error } = await enviar(anonimo(), { p_mensagem: `${MARCA} mensagem número 6` });
    assert.match(error?.message ?? "", /muitos_feedbacks/);
  });

  test("com a fila de novos cheia, ninguém consegue enviar", async () => {
    const linhas = Array.from({ length: 300 }, (_, i) => ({ tipo: "duvida", mensagem: `${MARCA} enchendo a fila ${i}` }));
    const { error: e1 } = await admin.from("feedbacks").insert(linhas);
    assert.ifError(e1);
    const { error } = await enviar(anonimo());
    assert.match(error?.message ?? "", /caixa_cheia/);
  });
});

describe("feedbacks: quem lê e quem trata", () => {
  test("visitante e vendedor comum não leem, não editam e não apagam", async () => {
    await enviar(anonimo());
    for (const cliente of [anonimo(), dono.client]) {
      const { data } = await cliente.from("feedbacks").select("*");
      assert.equal(data?.length ?? 0, 0);
      const up = await cliente.from("feedbacks").update({ status: "resolvido" }).like("mensagem", `${MARCA}%`).select();
      assert.equal(up.data?.length ?? 0, 0);
      const del = await cliente.from("feedbacks").delete().like("mensagem", `${MARCA}%`).select();
      assert.equal(del.data?.length ?? 0, 0);
    }
    const { data } = await admin.from("feedbacks").select("status").like("mensagem", `${MARCA}%`).single();
    assert.equal(data.status, "novo");
  });

  test("administrador lê e trata", async () => {
    await enviar(anonimo());
    const { data } = await adm.client.from("feedbacks").select("id, contato").like("mensagem", `${MARCA}%`);
    assert.equal(data.length, 1);
    assert.equal(data[0].contato, "contato@exemplo.com");
    const up = await adm.client.from("feedbacks").update({ status: "aceito", issue_url: "https://github.com/x/y/issues/1" }).eq("id", data[0].id).select();
    assert.equal(up.data[0].status, "aceito");
  });

  test("status e tipo fora da lista são recusados pelo banco", async () => {
    const { error: e1 } = await admin.from("feedbacks").insert({ tipo: "problema", mensagem: `${MARCA} status ruim`, status: "pendente" });
    const { error: e2 } = await admin.from("feedbacks").insert({ tipo: "outro", mensagem: `${MARCA} tipo ruim` });
    assert.ok(e1 && e2);
  });
});

describe("retenção (LGPD)", () => {
  test("limpar_dados_antigos tira o IP em 7 dias, o contato em 180 e apaga o tratado em 12 meses", async () => {
    const dias = (n) => new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();
    const base = { tipo: "duvida", contato: "alguem@exemplo.com", ip_hash: "abc", status: "novo" };
    const { error } = await admin.from("feedbacks").insert([
      { ...base, mensagem: `${MARCA} recente`, created_at: dias(1) },
      { ...base, mensagem: `${MARCA} sem ip`, created_at: dias(8) },
      { ...base, mensagem: `${MARCA} novo antigo`, created_at: dias(200), status: "novo" },
      { ...base, mensagem: `${MARCA} tratado antigo`, created_at: dias(200), status: "recusado" },
      { ...base, mensagem: `${MARCA} tratado muito antigo`, created_at: dias(400), status: "resolvido" },
    ]);
    assert.ifError(error);

    assert.ifError((await admin.rpc("limpar_dados_antigos")).error);

    const { data } = await admin.from("feedbacks").select("mensagem, contato, ip_hash").like("mensagem", `${MARCA}%`);
    const por = Object.fromEntries(data.map((f) => [f.mensagem.replace(`${MARCA} `, ""), f]));
    assert.equal(por["recente"].ip_hash, "abc");
    assert.equal(por["sem ip"].ip_hash, null);
    assert.equal(por["sem ip"].contato, "alguem@exemplo.com");
    assert.equal(por["novo antigo"].contato, "alguem@exemplo.com", "ainda não tratado: o contato fica para a resposta");
    assert.equal(por["tratado antigo"].contato, null);
    assert.equal(por["tratado muito antigo"], undefined, "tratado há mais de 12 meses é apagado");
  });
});
