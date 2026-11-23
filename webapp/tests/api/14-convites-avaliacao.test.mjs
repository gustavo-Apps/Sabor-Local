// Avaliação por convite: o vendedor não vê nem gera o link; o cliente avalia uma única vez.

import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { admin, anonimo, Contexto, sufixo, zerarLimites } from "../helpers.mjs";

const ctx = new Contexto();
let ana;
let beto;
let adm;

const sha = (t) => createHash("sha256").update(t).digest("hex");
const email = () => `cliente.${sufixo()}@exemplo.com`;
const criar = (vendedorId, e = email()) => admin.rpc("criar_convite_avaliacao", { p_vendedor: vendedorId, p_email: e });
const novo = async (vendedorId, e) => {
  const { data, error } = await criar(vendedorId, e);
  assert.ifError(error);
  return data; // { id, token, mascarado, expira_em }
};
const avaliar = (token, extra = {}, cliente = anonimo()) =>
  cliente.rpc("avaliar_por_convite", { p_token: token, p_nota: 5, p_comentario: "Muito bom", ...extra });

before(async () => {
  ana = await ctx.novoVendedor({ aprovado: true });
  beto = await ctx.novoVendedor({ aprovado: true });
  adm = await ctx.novoVendedor({ aprovado: true, ehAdmin: true });
});
beforeEach(async () => {
  await zerarLimites();
  await admin.from("convites_avaliacao").delete().in("vendedor_id", [ana.vendedorId, beto.vendedorId]);
  await admin.from("avaliacoes").delete().in("vendedor_id", [ana.vendedorId, beto.vendedorId]);
});
after(() => ctx.limpar());

describe("quem pode criar convite", () => {
  test("só o servidor (chave de serviço): vendedor, administrador e visitante não chamam a função", async () => {
    for (const cliente of [anonimo(), ana.client, adm.client]) {
      const { data, error } = await cliente.rpc("criar_convite_avaliacao", { p_vendedor: ana.vendedorId, p_email: email() });
      assert.ok(error, "não pode chamar");
      assert.ok(!data || !data.token, "nunca devolve token a quem não é o servidor");
    }
  });

  test("o vendedor não grava nem lê a tabela de convites direto", async () => {
    const n = await novo(ana.vendedorId);
    const ler = await ana.client.from("convites_avaliacao").select("*");
    assert.equal(ler.data?.length ?? 0, 0, "RLS sem policy: não vê nada");
    const gravar = await ana.client.from("convites_avaliacao").insert({ vendedor_id: ana.vendedorId, email_hash: "x", email_mascarado: "x***@x.com", token_hash: "y" });
    assert.ok(gravar.error);
    const apagar = await ana.client.from("convites_avaliacao").delete().eq("id", n.id).select();
    assert.equal(apagar.data?.length ?? 0, 0);
  });

  test("o vendedor não gera mais códigos de pedido (a saída antiga fechou)", async () => {
    const { error } = await ana.client.from("codigos_pedido").insert({ vendedor_id: ana.vendedorId, codigo: "SELF22" });
    assert.ok(error, "o vendedor não pode inserir códigos");
    const { data } = await ana.client.from("codigos_pedido").select("*");
    assert.equal(data.length, 0);
  });
});

describe("criar_convite_avaliacao: regras", () => {
  test("devolve token de 64 caracteres e o e-mail mascarado", async () => {
    const n = await novo(ana.vendedorId, "Maria.Silva@Exemplo.com");
    assert.match(n.token, /^[0-9a-f]{64}$/);
    assert.equal(n.mascarado, "m***@exemplo.com");
    assert.ok(Date.parse(n.expira_em) > Date.now() + 29 * 86_400_000);
  });

  test("o banco guarda só o hash do token e o hash do e-mail, nunca os originais", async () => {
    const e = email();
    const n = await novo(ana.vendedorId, e);
    const { data } = await admin.from("convites_avaliacao").select("*").eq("id", n.id).single();
    assert.equal(data.token_hash, sha(n.token));
    assert.equal(data.email_hash, sha(e));
    assert.notEqual(data.token_hash, n.token);
    const tudo = JSON.stringify(data);
    assert.ok(!tudo.includes(n.token) && !tudo.includes(e), "token e e-mail completo não ficam guardados");
  });

  test("tokens nunca se repetem", async () => {
    const tokens = new Set();
    for (let i = 0; i < 8; i++) tokens.add((await novo(ana.vendedorId)).token);
    assert.equal(tokens.size, 8);
  });

  test("recusa o e-mail da própria conta do vendedor, com maiúsculas e espaços também", async () => {
    for (const e of [ana.email, ana.email.toUpperCase(), `  ${ana.email}  `]) {
      const { error } = await criar(ana.vendedorId, e);
      assert.match(error?.message ?? "", /email_proprio/, e);
    }
  });

  test("o e-mail de outro vendedor é aceito (é só um e-mail)", async () => {
    assert.ifError((await criar(ana.vendedorId, beto.email)).error);
  });

  for (const [nome, e] of [["sem arroba", "abc"], ["sem domínio", "a@"], ["com espaço", "a b@c.com"], ["vazio", ""], ["nulo", null], ["enorme", `${"a".repeat(260)}@x.com`]]) {
    test(`recusa e-mail inválido: ${nome}`, async () => {
      const { error } = await criar(ana.vendedorId, e);
      assert.match(error?.message ?? "", /email_invalido/);
    });
  }

  test("vendedor inexistente é recusado", async () => {
    const { error } = await criar("00000000-0000-0000-0000-000000000000");
    assert.match(error?.message ?? "", /vendedor_invalido/);
  });

  test("o mesmo e-mail só recebe um convite por loja a cada 30 dias (mesmo com maiúsculas)", async () => {
    await novo(ana.vendedorId, "repetido@exemplo.com");
    const { error } = await criar(ana.vendedorId, "REPETIDO@exemplo.com");
    assert.match(error?.message ?? "", /convite_recente/);
  });

  test("outra loja pode convidar o mesmo e-mail, e depois de cancelar dá para convidar de novo", async () => {
    const n = await novo(ana.vendedorId, "cancela@exemplo.com");
    assert.ifError((await criar(beto.vendedorId, "cancela@exemplo.com")).error);
    assert.equal((await ana.client.rpc("cancelar_convite", { p_id: n.id })).data, true);
    assert.ifError((await criar(ana.vendedorId, "cancela@exemplo.com")).error);
  });

  test("limite de 20 convites em 24 horas por loja", async () => {
    const linhas = Array.from({ length: 20 }, (_, i) => ({
      vendedor_id: ana.vendedorId, email_hash: `h${i}`, email_mascarado: "x***@x.com", token_hash: `t${i}${sufixo()}`,
    }));
    assert.ifError((await admin.from("convites_avaliacao").insert(linhas)).error);
    const { error } = await criar(ana.vendedorId);
    assert.match(error?.message ?? "", /limite_diario/);
    assert.ifError((await criar(beto.vendedorId)).error, "o limite é por loja");
  });

  test("limite de 50 convites pendentes por loja", async () => {
    const antigo = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const linhas = Array.from({ length: 50 }, (_, i) => ({
      vendedor_id: ana.vendedorId, email_hash: `p${i}`, email_mascarado: "x***@x.com", token_hash: `tp${i}${sufixo()}`, criado_em: antigo,
    }));
    assert.ifError((await admin.from("convites_avaliacao").insert(linhas)).error);
    const { error } = await criar(ana.vendedorId);
    assert.match(error?.message ?? "", /limite_pendentes/);
  });
});

describe("o vendedor acompanha os convites sem ver o link", () => {
  test("meus_convites devolve só e-mail mascarado, datas e situação, e só os dele", async () => {
    await novo(ana.vendedorId, "um@exemplo.com");
    await novo(beto.vendedorId, "dois@exemplo.com");
    const { data, error } = await ana.client.rpc("meus_convites");
    assert.ifError(error);
    assert.equal(data.length, 1);
    assert.deepEqual(Object.keys(data[0]).sort(), ["criado_em", "email_mascarado", "estado", "expira_em", "id"]);
    assert.equal(data[0].email_mascarado, "u***@exemplo.com");
    assert.equal(data[0].estado, "pendente");
    assert.ok(!JSON.stringify(data).includes("token") && !JSON.stringify(data).includes("hash"));
  });

  test("situações: pendente, avaliou, cancelado e expirado", async () => {
    const a = await novo(ana.vendedorId);
    const b = await novo(ana.vendedorId);
    const c = await novo(ana.vendedorId);
    const d = await novo(ana.vendedorId);
    assert.equal((await avaliar(b.token)).data, "ok");
    await ana.client.rpc("cancelar_convite", { p_id: c.id });
    await admin.from("convites_avaliacao").update({ expira_em: new Date(Date.now() - 1000).toISOString() }).eq("id", d.id);
    const { data } = await ana.client.rpc("meus_convites");
    const por = Object.fromEntries(data.map((x) => [x.id, x.estado]));
    assert.deepEqual([por[a.id], por[b.id], por[c.id], por[d.id]], ["pendente", "avaliou", "cancelado", "expirado"]);
  });

  test("visitante sem login não consegue listar", async () => {
    const { error } = await anonimo().rpc("meus_convites");
    assert.ok(error);
  });

  test("só o dono cancela, e só convite pendente", async () => {
    const n = await novo(ana.vendedorId);
    assert.equal((await beto.client.rpc("cancelar_convite", { p_id: n.id })).data, false, "outro vendedor não cancela");
    assert.ok((await anonimo().rpc("cancelar_convite", { p_id: n.id })).error, "visitante não cancela");
    assert.equal((await ana.client.rpc("cancelar_convite", { p_id: n.id })).data, true);
    assert.equal((await ana.client.rpc("cancelar_convite", { p_id: n.id })).data, false, "já cancelado");
    const u = await novo(ana.vendedorId);
    await avaliar(u.token);
    assert.equal((await ana.client.rpc("cancelar_convite", { p_id: u.id })).data, false, "já usado");
  });
});

describe("convite_info (a página do link)", () => {
  const info = async (token) => (await anonimo().rpc("convite_info", { p_token: token })).data;

  test("convite válido mostra o nome da loja e se haverá conferência, e nada mais", async () => {
    const n = await novo(ana.vendedorId);
    const r = await info(n.token);
    assert.equal(r.estado, "ok");
    assert.ok(r.vendedor_nome);
    assert.equal(typeof r.moderada, "boolean");
    assert.deepEqual(Object.keys(r).sort(), ["estado", "moderada", "vendedor_nome"]);
  });

  test("não gasta o convite: pode abrir várias vezes antes de avaliar", async () => {
    const n = await novo(ana.vendedorId);
    for (let i = 0; i < 3; i++) assert.equal((await info(n.token)).estado, "ok");
    assert.equal((await avaliar(n.token)).data, "ok");
  });

  test("estados: usado, expirado, cancelado e inexistente", async () => {
    const u = await novo(ana.vendedorId);
    await avaliar(u.token);
    const e = await novo(ana.vendedorId);
    await admin.from("convites_avaliacao").update({ expira_em: new Date(Date.now() - 1000).toISOString() }).eq("id", e.id);
    const c = await novo(ana.vendedorId);
    await ana.client.rpc("cancelar_convite", { p_id: c.id });
    assert.equal((await info(u.token)).estado, "usado");
    assert.equal((await info(e.token)).estado, "expirado");
    assert.equal((await info(c.token)).estado, "invalido");
    for (const t of ["", "x", "0".repeat(64), "' or 1=1 --", null]) assert.equal((await info(t)).estado, "invalido", String(t));
  });

  test("o hash guardado no banco não serve como token", async () => {
    const n = await novo(ana.vendedorId);
    assert.equal((await info(sha(n.token))).estado, "invalido");
  });
});

describe("avaliar_por_convite", () => {
  test("cria a avaliação pendente de moderação, sem nome, e queima o convite", async () => {
    const n = await novo(ana.vendedorId);
    assert.equal((await avaliar(n.token, { p_nota: 4, p_comentario: "  Chegou quente  " })).data, "ok");
    const { data: av } = await admin.from("avaliacoes").select("nota, comentario, aprovada").eq("vendedor_id", ana.vendedorId);
    assert.deepEqual(av, [{ nota: 4, comentario: "Chegou quente", aprovada: false }]);
    const { data: c } = await admin.from("convites_avaliacao").select("usado_em, avaliacao_id").eq("id", n.id).single();
    assert.ok(c.usado_em && c.avaliacao_id);
  });

  test("comentário vazio vale (fica nulo)", async () => {
    const n = await novo(ana.vendedorId);
    assert.equal((await avaliar(n.token, { p_comentario: "   " })).data, "ok");
    const { data } = await admin.from("avaliacoes").select("comentario").eq("vendedor_id", ana.vendedorId).single();
    assert.equal(data.comentario, null);
  });

  test("cada link vale uma vez, mesmo em 10 tentativas ao mesmo tempo", async () => {
    const n = await novo(ana.vendedorId);
    const r = await Promise.all(Array.from({ length: 10 }, () => avaliar(n.token)));
    assert.equal(r.filter((x) => x.data === "ok").length, 1);
    assert.equal(r.filter((x) => x.data === "convite_usado").length, 9);
    const { data } = await admin.from("avaliacoes").select("id").eq("vendedor_id", ana.vendedorId);
    assert.equal(data.length, 1);
  });

  test("link vencido, cancelado e inexistente", async () => {
    const e = await novo(ana.vendedorId);
    await admin.from("convites_avaliacao").update({ expira_em: new Date(Date.now() - 1000).toISOString() }).eq("id", e.id);
    const c = await novo(ana.vendedorId);
    await ana.client.rpc("cancelar_convite", { p_id: c.id });
    assert.equal((await avaliar(e.token)).data, "convite_expirado");
    assert.equal((await avaliar(c.token)).data, "convite_invalido");
    assert.equal((await avaliar("f".repeat(64))).data, "convite_invalido");
  });

  test("nota e comentário inválidos não gastam o convite", async () => {
    const n = await novo(ana.vendedorId);
    for (const nota of [0, 6, -1, null]) assert.equal((await avaliar(n.token, { p_nota: nota })).data, "nota_invalida", String(nota));
    assert.equal((await avaliar(n.token, { p_comentario: "a".repeat(501) })).data, "comentario_longo");
    assert.equal((await avaliar(n.token)).data, "ok", "o convite continua valendo");
  });

  test("texto hostil no comentário é guardado como texto (a tela escapa)", async () => {
    const n = await novo(ana.vendedorId);
    const texto = "<script>alert(1)</script> ' OR 1=1 -- 😀";
    assert.equal((await avaliar(n.token, { p_comentario: texto })).data, "ok");
    const { data } = await admin.from("avaliacoes").select("comentario").eq("vendedor_id", ana.vendedorId).single();
    assert.equal(data.comentario, texto);
  });

  test("a avaliação cai na loja certa, não em outra", async () => {
    const n = await novo(beto.vendedorId);
    await avaliar(n.token);
    assert.equal((await admin.from("avaliacoes").select("id").eq("vendedor_id", ana.vendedorId)).data.length, 0);
    assert.equal((await admin.from("avaliacoes").select("id").eq("vendedor_id", beto.vendedorId)).data.length, 1);
  });

  test("o vendedor da loja não se avalia: não existe caminho sem o link que só o cliente recebe", async () => {
    const n = await novo(ana.vendedorId);
    // o vendedor lê a tabela? não. Recebe o token? não. Insere avaliação direto? também não:
    const direto = await ana.client.from("avaliacoes").insert({ vendedor_id: ana.vendedorId, nota: 5, codigo_verificacao: `SELF${sufixo()}` });
    assert.ok(direto.error, "inserir avaliação direto é negado");
    const { data } = await ana.client.rpc("meus_convites");
    assert.ok(!JSON.stringify(data).includes(n.token));
  });

  test("palpites com link errado são freados por IP depois de 10, e trocar o cabeçalho de IP não ajuda", async () => {
    const mesmo = anonimo({ "x-real-ip": "203.0.113.77" });
    for (let i = 0; i < 10; i++) assert.equal((await avaliar(`${i}`.repeat(64), {}, mesmo)).data, "convite_invalido");
    assert.equal((await avaliar("a".repeat(64), {}, mesmo)).data, "muitas_tentativas");
    const n = await novo(ana.vendedorId);
    assert.equal((await avaliar(n.token, {}, mesmo)).data, "muitas_tentativas", "até o link certo espera");
    // o gateway ignora o IP que o cliente diz ter: trocar o cabeçalho não escapa do limite
    assert.equal((await avaliar(n.token, {}, anonimo({ "x-real-ip": "203.0.113.78", "x-forwarded-for": "198.51.100.9" }))).data, "muitas_tentativas");
    await zerarLimites();
    assert.equal((await avaliar(n.token)).data, "ok", "passada a janela, o link certo funciona");
  });
});

describe("retenção e exclusão", () => {
  test("convites usados, cancelados ou vencidos saem em 90 dias; os pendentes ficam", async () => {
    const antigo = new Date(Date.now() - 100 * 86_400_000).toISOString();
    const base = { vendedor_id: ana.vendedorId, email_mascarado: "x***@x.com", criado_em: antigo, expira_em: new Date(Date.now() + 86_400_000).toISOString() };
    const { error } = await admin.from("convites_avaliacao").insert([
      { ...base, email_hash: "r1", token_hash: `r1${sufixo()}`, usado_em: antigo, cancelado_em: null },
      { ...base, email_hash: "r2", token_hash: `r2${sufixo()}`, usado_em: null, cancelado_em: antigo },
      { ...base, email_hash: "r3", token_hash: `r3${sufixo()}`, usado_em: null, cancelado_em: null, expira_em: antigo },
      { ...base, email_hash: "r4", token_hash: `r4${sufixo()}`, usado_em: null, cancelado_em: null }, // pendente e ainda válido
    ]);
    assert.ifError(error);
    assert.ifError((await admin.rpc("limpar_dados_antigos")).error);
    const { data } = await admin.from("convites_avaliacao").select("email_hash").eq("vendedor_id", ana.vendedorId);
    assert.deepEqual(data.map((c) => c.email_hash), ["r4"]);
  });

  test("tentativas de link inválido saem em 7 dias", async () => {
    await admin.from("tentativas_convite").insert([
      { ip_hash: "velho", created_at: new Date(Date.now() - 8 * 86_400_000).toISOString() },
      { ip_hash: "novo", created_at: new Date().toISOString() },
    ]);
    await admin.rpc("limpar_dados_antigos");
    const { data } = await admin.from("tentativas_convite").select("ip_hash").in("ip_hash", ["velho", "novo"]);
    assert.deepEqual(data.map((t) => t.ip_hash), ["novo"]);
  });

  test("excluir o vendedor apaga os convites dele (cascata) e preserva os dos outros", async () => {
    const extra = await ctx.novoVendedor({ aprovado: true });
    await novo(extra.vendedorId);
    await novo(ana.vendedorId);
    await admin.from("vendedores").delete().eq("id", extra.vendedorId);
    assert.equal((await admin.from("convites_avaliacao").select("id").eq("vendedor_id", extra.vendedorId)).data.length, 0);
    assert.equal((await admin.from("convites_avaliacao").select("id").eq("vendedor_id", ana.vendedorId)).data.length, 1);
  });
});
