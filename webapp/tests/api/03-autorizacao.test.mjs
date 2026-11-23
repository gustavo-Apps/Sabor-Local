// Isolamento entre vendedores e entre visitante/vendedor/admin (RLS + Storage).

import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, sufixo } from "../helpers.mjs";

const ctx = new Contexto();
let ana; // vendedora aprovada
let beto; // outro vendedor
let pendente; // vendedor ainda não aprovado
let adm;
let itemId;
let codigoId;

before(async () => {
  [ana, beto, pendente, adm] = [
    await ctx.novoVendedor({ aprovado: true }),
    await ctx.novoVendedor({ aprovado: true }),
    await ctx.novoVendedor({ aprovado: false }),
    await ctx.novoVendedor({ aprovado: true, ehAdmin: true }),
  ];
  const { data: item } = await ana.client.from("itens_cardapio").insert({ vendedor_id: ana.vendedorId, nome: "Prato da Ana" }).select("id").single();
  itemId = item.id;
  // o vendedor não gera mais códigos: quem cria é só o administrador (suporte)
  const { data: cod } = await admin.from("codigos_pedido").insert({ vendedor_id: ana.vendedorId, codigo: "ANA234" }).select("id").single();
  codigoId = cod.id;
});
after(() => ctx.limpar());

describe("visitante (sem login)", () => {
  const visitante = anonimo();

  test("vê vendedor aprovado, mas não o pendente", async () => {
    const { data } = await visitante.from("vendedores").select("id").in("id", [ana.vendedorId, pendente.vendedorId]);
    assert.deepEqual(data.map((v) => v.id), [ana.vendedorId]);
  });

  test("não vê códigos de pedido, eventos, histórico, admins nem denúncias", async () => {
    for (const tabela of ["codigos_pedido", "eventos", "historico", "admins", "denuncias", "feedbacks", "tentativas_codigo", "perfis_vendedor"]) {
      const { data, error } = await visitante.from(tabela).select("*").limit(5);
      assert.ok(error || data.length === 0, `${tabela} vazou ${data?.length} linhas`);
    }
  });

  test("não consegue escrever em nada", async () => {
    const tentativas = [
      visitante.from("vendedores").insert({ nome: "x", whatsapp: "5511999990000", bairro_id: ana.bairroId }),
      visitante.from("itens_cardapio").insert({ vendedor_id: ana.vendedorId, nome: "x" }),
      visitante.from("avaliacoes").insert({ vendedor_id: ana.vendedorId, nota: 5, codigo_verificacao: "X" }),
      visitante.from("denuncias").insert({ vendedor_id: ana.vendedorId, motivo: "outro" }),
      visitante.from("feedbacks").insert({ tipo: "problema", mensagem: "mensagem de teste direto" }),
      visitante.from("eventos").insert({ tipo: "whatsapp", vendedor_id: ana.vendedorId }),
      visitante.from("historico").insert({ entidade: "x", acao: "x" }),
    ];
    for (const r of await Promise.all(tentativas)) assert.ok(r.error, "escrita deveria ser negada");
  });

  test("não consegue editar nem apagar dados existentes (0 linhas afetadas)", async () => {
    const u = await visitante.from("vendedores").update({ nome: "pichado" }).eq("id", ana.vendedorId).select();
    const d = await visitante.from("itens_cardapio").delete().eq("id", itemId).select();
    assert.equal(u.data?.length ?? 0, 0);
    assert.equal(d.data?.length ?? 0, 0);
    const { data } = await admin.from("itens_cardapio").select("id").eq("id", itemId);
    assert.equal(data.length, 1, "item ainda existe");
  });

  test("não lê avaliações pendentes de moderação", async () => {
    await admin.from("avaliacoes").insert({ vendedor_id: ana.vendedorId, nota: 1, comentario: "pendente", codigo_verificacao: `P${sufixo()}`, aprovada: false });
    const { data } = await visitante.from("avaliacoes").select("*").eq("vendedor_id", ana.vendedorId).eq("aprovada", false);
    assert.equal(data.length, 0);
  });
});

describe("vendedor A x vendedor B", () => {
  test("B não edita o perfil de A", async () => {
    const r = await beto.client.from("vendedores").update({ nome: "invadido" }).eq("id", ana.vendedorId).select();
    assert.equal(r.data?.length ?? 0, 0);
  });

  test("B não mexe no menu de A (editar, apagar, criar)", async () => {
    const u = await beto.client.from("itens_cardapio").update({ nome: "invadido" }).eq("id", itemId).select();
    const d = await beto.client.from("itens_cardapio").delete().eq("id", itemId).select();
    const c = await beto.client.from("itens_cardapio").insert({ vendedor_id: ana.vendedorId, nome: "intruso" });
    assert.equal(u.data?.length ?? 0, 0);
    assert.equal(d.data?.length ?? 0, 0);
    assert.ok(c.error);
  });

  test("nem o próprio dono vê, cria ou apaga códigos de pedido (só o administrador)", async () => {
    const ver = await ana.client.from("codigos_pedido").select("*").eq("vendedor_id", ana.vendedorId);
    const criar = await ana.client.from("codigos_pedido").insert({ vendedor_id: ana.vendedorId, codigo: "PROPR1" });
    const apagar = await ana.client.from("codigos_pedido").delete().eq("id", codigoId).select();
    assert.equal(ver.data.length, 0, "o vendedor não pode ler os códigos (senão se avaliaria sozinho)");
    assert.ok(criar.error, "o vendedor não pode gerar códigos");
    assert.equal(apagar.data?.length ?? 0, 0);
  });

  test("B não vê, cria nem apaga códigos de pedido de A", async () => {
    const ver = await beto.client.from("codigos_pedido").select("*").eq("vendedor_id", ana.vendedorId);
    const criar = await beto.client.from("codigos_pedido").insert({ vendedor_id: ana.vendedorId, codigo: "INVAS1" });
    const apagar = await beto.client.from("codigos_pedido").delete().eq("id", codigoId).select();
    assert.equal(ver.data.length, 0);
    assert.ok(criar.error);
    assert.equal(apagar.data?.length ?? 0, 0);
  });

  test("B não vê as métricas nem o histórico de A", async () => {
    const ev = await beto.client.from("eventos").select("*").eq("vendedor_id", ana.vendedorId);
    const hi = await beto.client.from("historico").select("*").eq("vendedor_id", ana.vendedorId);
    assert.equal(ev.data.length, 0);
    assert.equal(hi.data.length, 0);
  });

  test("B não grava horário nem exceção na loja de A", async () => {
    const h = await beto.client.from("horarios_funcionamento").insert({ vendedor_id: ana.vendedorId, dia_semana: 1, abre: "08:00", fecha: "18:00" });
    const e = await beto.client.from("excecoes_horario").insert({ vendedor_id: ana.vendedorId, data: "2031-01-01", fechado: true });
    assert.ok(h.error);
    assert.ok(e.error);
  });

  test("B não consegue registrar histórico falso de A", async () => {
    const { error } = await beto.client.rpc("registrar_historico", { p_vendedor: ana.vendedorId, p_acao: "falso", p_dados: {} });
    assert.match(error?.message ?? "", /sem_permissao/);
  });

  test("B não lê o perfil (usuário/ramos) de A", async () => {
    const { data } = await beto.client.from("perfis_vendedor").select("*").eq("user_id", ana.id);
    assert.equal(data.length, 0);
  });

  test("o vendedor pendente já edita o próprio menu, mas continua invisível", async () => {
    const { error } = await pendente.client.from("itens_cardapio").insert({ vendedor_id: pendente.vendedorId, nome: "Rascunho" });
    assert.ifError(error);
    const { data } = await anonimo().from("itens_cardapio").select("id").eq("vendedor_id", pendente.vendedorId);
    assert.equal(data.length, 0, "menu de perfil pendente não pode vazar");
  });
});

describe("administrador", () => {
  test("admin enxerga pendentes, resumo, lista e histórico", async () => {
    const resumo = await adm.client.rpc("admin_resumo");
    assert.ifError(resumo.error);
    assert.ok(resumo.data.vendedores_pendentes >= 1);

    const lista = await adm.client.rpc("admin_vendedores");
    assert.ok(lista.data.some((v) => v.id === pendente.vendedorId && v.email === pendente.email));

    const hist = await adm.client.rpc("admin_historico", { p_vendedor: null, p_limite: 5 });
    assert.ifError(hist.error);
    assert.ok(hist.data.length > 0);
  });

  test("admin_historico respeita o teto de 500 linhas", async () => {
    const { data } = await adm.client.rpc("admin_historico", { p_vendedor: null, p_limite: 1_000_000 });
    assert.ok(data.length <= 500);
  });

  test("vendedor comum não acessa nenhuma função de admin", async () => {
    for (const fn of ["admin_resumo", "admin_vendedores", "admin_historico"]) {
      const { error } = await ana.client.rpc(fn);
      assert.match(error?.message ?? "", /sem_permissao/, fn);
    }
  });

  test("a função que troca usuário por e-mail só responde ao serviço", async () => {
    for (const cliente of [anonimo(), ana.client]) {
      const { error } = await cliente.rpc("email_por_username", { p_username: ana.username });
      assert.ok(error, "não pode revelar e-mail");
    }
    const { data } = await admin.rpc("email_por_username", { p_username: ana.username });
    assert.equal(data, ana.email);
  });
});

describe("Storage (cardápio e fotos)", () => {
  const arquivo = (tamanho = 100) => new Blob([new Uint8Array(tamanho).fill(1)], { type: "image/png" });

  test("vendedor envia para a própria pasta", async () => {
    const { error } = await ana.client.storage.from("cardapios").upload(`${ana.id}/ok-${sufixo()}.png`, arquivo(), { contentType: "image/png" });
    assert.ifError(error);
  });

  test("vendedor NÃO envia para a pasta de outro", async () => {
    const { error } = await beto.client.storage.from("cardapios").upload(`${ana.id}/invasao-${sufixo()}.png`, arquivo(), { contentType: "image/png" });
    assert.ok(error, "RLS do storage deveria bloquear");
  });

  test("visitante não envia nada", async () => {
    const { error } = await anonimo().storage.from("cardapios").upload(`${ana.id}/anon-${sufixo()}.png`, arquivo(), { contentType: "image/png" });
    assert.ok(error);
  });

  test("tipo de arquivo não permitido (HTML/script) é recusado", async () => {
    const html = new Blob(["<script>alert(1)</script>"], { type: "text/html" });
    const { error } = await ana.client.storage.from("cardapios").upload(`${ana.id}/xss-${sufixo()}.html`, html, { contentType: "text/html" });
    assert.ok(error, "só PDF e imagens");
  });

  test("arquivo maior que 5 MB é recusado", async () => {
    const { error } = await ana.client.storage.from("cardapios").upload(`${ana.id}/grande-${sufixo()}.png`, arquivo(6 * 1024 * 1024), { contentType: "image/png" });
    assert.ok(error, "limite de 5 MB");
  });

  test("caminho com .. não escapa da pasta do usuário", async () => {
    const { error } = await ana.client.storage.from("cardapios").upload(`${ana.id}/../${beto.id}/escape-${sufixo()}.png`, arquivo(), { contentType: "image/png" });
    assert.ok(error, "path traversal deve falhar");
  });

  test("vendedor não apaga arquivo de outro", async () => {
    const caminho = `${ana.id}/dele-${sufixo()}.png`;
    await ana.client.storage.from("cardapios").upload(caminho, arquivo(), { contentType: "image/png" });
    const { data } = await beto.client.storage.from("cardapios").remove([caminho]);
    assert.equal(data?.length ?? 0, 0, "nada removido");
    const lista = await ana.client.storage.from("cardapios").list(ana.id);
    assert.ok(lista.data.some((f) => caminho.endsWith(f.name)));
  });
});
