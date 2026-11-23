// Produção/LGPD: aceite dos Termos, limpeza por prazo de retenção e exclusão completa da conta.

import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, dadosBase, sufixo } from "../helpers.mjs";
import { excluirContaCompleta } from "../../src/lib/conta.ts";

const ctx = new Contexto();
const DIA = 24 * 60 * 60 * 1000;
const atras = (dias) => new Date(Date.now() - dias * DIA).toISOString();
const inserir = async (tabela, linhas) => {
  const { error } = await admin.from(tabela).insert(linhas);
  assert.ifError(error);
};

before(async () => {
  await admin.from("tentativas_login").delete().gte("id", 0);
});
after(async () => {
  await ctx.limpar();
  await admin.from("tentativas_login").delete().gte("id", 0);
});

describe("aceite dos Termos de Uso", () => {
  async function criar(metadados) {
    const s = sufixo();
    const { categoriaIds } = await dadosBase();
    const { data, error } = await admin.auth.admin.createUser({
      email: `termos.${s}@exemplo.com`,
      password: `Senha-${s}-forte`,
      email_confirm: true,
      user_metadata: { username: `termos_${s}`, categoria_ids: [categoriaIds[0]], ...metadados },
    });
    assert.ifError(error);
    ctx.usuarios.push({ id: data.user.id });
    return (await admin.from("perfis_vendedor").select("*").eq("user_id", data.user.id).single()).data;
  }

  test("cadastro com termos_versao grava a versão e a data do aceite", async () => {
    const antes = Date.now();
    const perfil = await criar({ termos_versao: "2026-10" });
    assert.equal(perfil.termos_versao, "2026-10");
    assert.ok(perfil.termos_aceitos_em);
    assert.ok(Math.abs(new Date(perfil.termos_aceitos_em).getTime() - antes) < 60_000);
  });

  test("cadastro sem a versão (criado por fora do formulário) fica sem aceite registrado", async () => {
    const perfil = await criar({});
    assert.equal(perfil.termos_versao, null);
    assert.equal(perfil.termos_aceitos_em, null);
  });

  test("versão vazia não conta como aceite", async () => {
    const perfil = await criar({ termos_versao: "" });
    assert.equal(perfil.termos_aceitos_em, null);
  });

  test("o vendedor não consegue alterar o próprio aceite", async () => {
    const ze = await ctx.novoVendedor({ aprovado: true });
    const { data } = await ze.client.from("perfis_vendedor").update({ termos_versao: "forjado" }).eq("user_id", ze.id).select();
    assert.equal(data?.length ?? 0, 0);
  });
});

describe("retenção: limpar_dados_antigos()", () => {
  test("só o backend executa a limpeza", async () => {
    const ze = await ctx.novoVendedor({ semPerfil: true });
    assert.ok((await anonimo().rpc("limpar_dados_antigos")).error);
    assert.ok((await ze.client.rpc("limpar_dados_antigos")).error);
    assert.ifError((await admin.rpc("limpar_dados_antigos")).error);
  });

  test("apaga o que venceu e preserva o que ainda vale", async () => {
    const ze = await ctx.novoVendedor({ aprovado: true, semLogin: true });
    const vid = ze.vendedorId;

    // tentativas (7 dias)
    await inserir("tentativas_codigo", [
      { vendedor_id: vid, ip_hash: "velha", created_at: atras(8) },
      { vendedor_id: vid, ip_hash: "recente", created_at: atras(1) },
    ]);
    await inserir("tentativas_login", [
      { tipo: "conta", chave: "velha", created_at: atras(8) },
      { tipo: "conta", chave: "recente", created_at: atras(1) },
    ]);

    // IP nas métricas (7 dias) e métricas muito antigas (25 meses)
    await inserir("eventos", [
      { tipo: "whatsapp", vendedor_id: vid, ip_hash: "ip-velho", created_at: atras(10) },
      { tipo: "whatsapp", vendedor_id: vid, ip_hash: "ip-novo", created_at: atras(1) },
      { tipo: "visita_vendedor", vendedor_id: vid, ip_hash: null, created_at: atras(800) },
    ]);

    // denúncias: contato some 180 dias depois de tratada; aberta nunca perde o contato
    await inserir("denuncias", [
      { vendedor_id: vid, motivo: "outro", contato: "tratada-velha", status: "resolvida", ip_hash: "d1", created_at: atras(200) },
      { vendedor_id: vid, motivo: "outro", contato: "aberta-velha", status: "aberta", ip_hash: null, created_at: atras(200) },
      { vendedor_id: vid, motivo: "outro", contato: "tratada-recente", status: "resolvida", ip_hash: null, created_at: atras(10) },
    ]);

    // histórico (2 anos) e códigos de avaliação (90 dias)
    await inserir("historico", [
      { entidade: "teste", acao: "velho", vendedor_id: vid, created_at: atras(800) },
      { entidade: "teste", acao: "recente", vendedor_id: vid, created_at: atras(30) },
    ]);
    await inserir("codigos_pedido", [
      { vendedor_id: vid, codigo: "USADO1", usado_em: atras(100), criado_em: atras(120), expira_em: atras(90) },
      { vendedor_id: vid, codigo: "VALIDO", usado_em: null, criado_em: atras(100), expira_em: new Date(Date.now() + 5 * DIA).toISOString() },
      { vendedor_id: vid, codigo: "USADO2", usado_em: atras(5), criado_em: atras(10), expira_em: new Date(Date.now() + 20 * DIA).toISOString() },
    ]);

    const { data: r, error } = await admin.rpc("limpar_dados_antigos");
    assert.ifError(error);
    for (const chave of ["tentativas_codigo", "tentativas_login", "eventos_apagados", "historico_apagado", "codigos_apagados"]) {
      assert.equal(typeof r[chave], "number", chave);
    }

    const tcod = (await admin.from("tentativas_codigo").select("ip_hash").eq("vendedor_id", vid)).data.map((x) => x.ip_hash);
    assert.deepEqual(tcod.sort(), ["recente"]);

    const tlog = (await admin.from("tentativas_login").select("chave")).data.map((x) => x.chave);
    assert.ok(tlog.includes("recente") && !tlog.includes("velha"));

    const eventos = (await admin.from("eventos").select("tipo, ip_hash").eq("vendedor_id", vid)).data;
    assert.equal(eventos.length, 2, "evento de 800 dias apagado, os outros dois ficam (a contagem é preservada)");
    assert.ok(eventos.some((e) => e.ip_hash === "ip-novo"), "IP recente fica");
    assert.ok(!eventos.some((e) => e.ip_hash === "ip-velho"), "IP antigo some");

    const den = (await admin.from("denuncias").select("contato, ip_hash, status").eq("vendedor_id", vid)).data;
    const por = (c) => den.find((d) => d.status === c.status && (d.contato === c.contato || c.contato === null));
    assert.equal(den.length, 3, "denúncias não são apagadas, só perdem dados pessoais");
    assert.equal(den.find((d) => d.contato === "aberta-velha")?.status, "aberta", "contato de denúncia aberta fica");
    assert.ok(den.some((d) => d.contato === "tratada-recente"), "tratada há menos de 180 dias mantém o contato");
    assert.ok(!den.some((d) => d.contato === "tratada-velha"), "tratada há mais de 180 dias perde o contato");
    assert.ok(den.every((d) => d.ip_hash === null), "hash de IP antigo removido");
    void por;

    const hist = (await admin.from("historico").select("acao").eq("vendedor_id", vid).eq("entidade", "teste")).data.map((h) => h.acao);
    assert.deepEqual(hist, ["recente"]);

    const cods = (await admin.from("codigos_pedido").select("codigo").eq("vendedor_id", vid)).data.map((c) => c.codigo).sort();
    assert.deepEqual(cods, ["USADO2", "VALIDO"], "código usado há mais de 90 dias sai; válido e recente ficam");
  });

  test("rodar duas vezes seguidas não apaga mais nada (idempotente)", async () => {
    const { data } = await admin.rpc("limpar_dados_antigos");
    for (const [, n] of Object.entries(data)) assert.equal(typeof n, "number");
    const { data: de_novo } = await admin.rpc("limpar_dados_antigos");
    assert.equal(de_novo.tentativas_codigo, 0);
    assert.equal(de_novo.historico_apagado, 0);
  });
});

describe("exclusão completa da conta (direito de exclusão)", () => {
  test("apaga login, perfil, menu, horários, pagamentos, códigos e arquivos, sem tocar nos outros", async () => {
    const alvo = await ctx.novoVendedor({ aprovado: true });
    const outro = await ctx.novoVendedor({ aprovado: true });
    const vid = alvo.vendedorId;

    await admin.from("itens_cardapio").insert({ vendedor_id: vid, nome: "Prato" });
    await admin.from("horarios_funcionamento").insert({ vendedor_id: vid, dia_semana: 1, abre: "08:00", fecha: "18:00" });
    await admin.from("codigos_pedido").insert({ vendedor_id: vid, codigo: "EXC234" });
    await admin.from("pagamentos").insert({
      vendedor_id: vid, valor: 10, forma: "pix", dias: 7, destaque_de: new Date().toISOString(), destaque_ate: new Date(Date.now() + 7 * DIA).toISOString(),
    });
    await alvo.client.storage.from("cardapios").upload(`${alvo.id}/cardapio.png`, new Blob([new Uint8Array(50).fill(1)], { type: "image/png" }), { contentType: "image/png" });
    await outro.client.storage.from("cardapios").upload(`${outro.id}/cardapio.png`, new Blob([new Uint8Array(50).fill(1)], { type: "image/png" }), { contentType: "image/png" });

    const resultado = await excluirContaCompleta(admin, alvo.id);
    assert.deepEqual(resultado, {});

    assert.equal((await admin.from("vendedores").select("id").eq("id", vid)).data.length, 0, "perfil apagado");
    assert.equal((await admin.from("itens_cardapio").select("id").eq("vendedor_id", vid)).data.length, 0, "menu apagado");
    assert.equal((await admin.from("horarios_funcionamento").select("id").eq("vendedor_id", vid)).data.length, 0);
    assert.equal((await admin.from("codigos_pedido").select("id").eq("vendedor_id", vid)).data.length, 0);
    assert.equal((await admin.from("pagamentos").select("id").eq("vendedor_id", vid)).data.length, 0);
    assert.equal((await admin.from("perfis_vendedor").select("user_id").eq("user_id", alvo.id)).data.length, 0, "perfil de conta apagado");
    assert.ok((await admin.auth.admin.getUserById(alvo.id)).error, "login apagado");
    assert.equal((await admin.storage.from("cardapios").list(alvo.id)).data.length, 0, "arquivos apagados");

    assert.equal((await admin.from("vendedores").select("id").eq("id", outro.vendedorId)).data.length, 1, "outro vendedor intacto");
    assert.equal((await admin.storage.from("cardapios").list(outro.id)).data.length, 1, "arquivos do outro intactos");
  });

  test("o histórico de auditoria continua existindo, sem a pessoa (só um identificador solto)", async () => {
    const alvo = await ctx.novoVendedor({ aprovado: true });
    await alvo.client.from("vendedores").update({ descricao: "antes de sair" }).eq("id", alvo.vendedorId);
    await excluirContaCompleta(admin, alvo.id);
    const { data } = await admin.from("historico").select("acao, user_id").eq("vendedor_id", alvo.vendedorId);
    assert.ok(data.length > 0, "registros mantidos até vencer a retenção");
    const { data: via_rpc } = await admin.rpc("admin_historico", { p_vendedor: alvo.vendedorId });
    void via_rpc; // (a função exige admin; o ponto é que a pessoa não existe mais em auth.users)
    assert.ok((await admin.auth.admin.getUserById(alvo.id)).error);
  });

  test("a conta excluída não consegue mais entrar", async () => {
    const alvo = await ctx.novoVendedor({ aprovado: true, semLogin: true });
    await excluirContaCompleta(admin, alvo.id);
    const { error } = await anonimo().auth.signInWithPassword({ email: alvo.email, password: alvo.senha });
    assert.ok(error);
  });

  test("excluir de novo uma conta que já não existe devolve erro, sem lançar exceção", async () => {
    const alvo = await ctx.novoVendedor({ semPerfil: true, semLogin: true });
    await excluirContaCompleta(admin, alvo.id);
    const segunda = await excluirContaCompleta(admin, alvo.id);
    assert.ok(segunda.erro, "segunda exclusão sinaliza erro");
  });
});
