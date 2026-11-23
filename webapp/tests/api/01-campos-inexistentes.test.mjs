// Campos que não existem / tentativa de "mass assignment":
// o atacante manda colunas, tabelas, funções ou metadados que não deveria
// poder usar. Nada disso pode ser aceito nem escalar privilégio.

import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, anonimo, Contexto, cfg } from "../helpers.mjs";

const ctx = new Contexto();
let ze;
before(async () => {
  ze = await ctx.novoVendedor({ aprovado: true });
});
after(() => ctx.limpar());

describe("colunas inexistentes", () => {
  test("insert com coluna desconhecida é recusado (PGRST204)", async () => {
    const { error } = await ze.client.from("itens_cardapio").insert({
      vendedor_id: ze.vendedorId,
      nome: "X",
      campo_que_nao_existe: "oi",
    });
    assert.ok(error, "deveria falhar");
    assert.equal(error.code, "PGRST204");
    assert.match(error.message, /campo_que_nao_existe/);
  });

  test("update com coluna desconhecida é recusado", async () => {
    const { error } = await ze.client.from("vendedores").update({ is_admin: true }).eq("id", ze.vendedorId);
    assert.equal(error?.code, "PGRST204");
  });

  test("select de coluna inexistente é recusado (42703)", async () => {
    const { error } = await ze.client.from("vendedores").select("senha_secreta");
    assert.equal(error?.code, "42703");
  });

  test("filtro por coluna inexistente é recusado", async () => {
    const { error } = await anonimo().from("vendedores").select("id").eq("coluna_fantasma", 1);
    assert.equal(error?.code, "42703");
  });

  test("tabela inexistente (PGRST205)", async () => {
    const { error } = await anonimo().from("usuarios_admin").select("*");
    assert.equal(error?.code, "PGRST205");
  });

  test("tabela interna do Auth não é exposta pela API", async () => {
    const { error } = await anonimo().from("users").select("*");
    assert.ok(error);
  });
});

describe("funções (RPC) inexistentes ou com parâmetros a mais", () => {
  test("RPC inexistente (PGRST202)", async () => {
    const { error } = await anonimo().rpc("apagar_tudo");
    assert.equal(error?.code, "PGRST202");
  });

  test("RPC existente com parâmetro extra é recusada", async () => {
    const { error } = await anonimo().rpc("registrar_evento", {
      p_tipo: "visita_site",
      p_vendedor: null,
      p_extra: "x",
    });
    assert.equal(error?.code, "PGRST202");
  });

  test("RPC com tipo errado no parâmetro (uuid inválido)", async () => {
    const { error } = await anonimo().rpc("enviar_denuncia", {
      p_vendedor: "nao-e-uuid",
      p_avaliacao: null,
      p_motivo: "outro",
      p_descricao: "",
      p_contato: "",
    });
    assert.equal(error?.code, "22P02");
  });

  test("RPC de admin e de serviço não aparecem para visitante", async () => {
    for (const nome of ["admin_resumo", "admin_vendedores", "admin_historico", "email_por_username"]) {
      const { error } = await anonimo().rpc(nome, { p_username: "x" });
      assert.ok(error, `${nome} deveria ser negada para anônimo`);
    }
  });
});

describe("escalada de privilégio (mass assignment)", () => {
  test("não dá para se tornar admin inserindo em `admins`", async () => {
    const { error } = await ze.client.from("admins").insert({ user_id: ze.id });
    assert.ok(error, "RLS deveria bloquear");
    const { data } = await ze.client.rpc("is_admin");
    assert.equal(data, false);
  });

  test("não dá para criar/editar `perfis_vendedor` direto", async () => {
    const a = await ze.client.from("perfis_vendedor").update({ username: "hackeado" }).eq("user_id", ze.id).select();
    assert.equal(a.data?.length ?? 0, 0, "update não pode afetar linhas");
    const b = await ze.client.from("perfis_vendedor").insert({ user_id: ze.id, username: "outro_nome" });
    assert.ok(b.error);
  });

  test("auto-aprovação, destaque e troca de dono são ignorados no UPDATE", async () => {
    const outro = await ctx.novoVendedor({ semPerfil: true, semLogin: true });
    await admin.from("vendedores").update({ ativo: false, aprovado_em: null, destaque_ate: null }).eq("id", ze.vendedorId);
    await ze.client.from("vendedores").update({
      ativo: true,
      aprovado_em: new Date().toISOString(),
      destaque_ate: "2099-01-01T00:00:00Z",
      owner_id: outro.id,
      nome: "Nome novo permitido",
    }).eq("id", ze.vendedorId);

    const { data } = await admin.from("vendedores").select("*").eq("id", ze.vendedorId).single();
    assert.equal(data.ativo, false);
    assert.equal(data.aprovado_em, null);
    assert.equal(data.destaque_ate, null);
    assert.equal(data.owner_id, ze.id, "dono não pode mudar");
    assert.equal(data.nome, "Nome novo permitido", "campos permitidos continuam editáveis");
    await admin.from("vendedores").update({ ativo: true, aprovado_em: new Date().toISOString() }).eq("id", ze.vendedorId);
  });

  test("insert direto com ativo=true e destaque nasce oculto e sem destaque", async () => {
    const novo = await ctx.novoVendedor({ semPerfil: true });
    const { data, error } = await novo.client
      .from("vendedores")
      .insert({
        owner_id: novo.id,
        nome: "Perfil esperto",
        whatsapp: "5511988887777",
        bairro_id: novo.bairroId,
        ativo: true,
        aprovado_em: new Date().toISOString(),
        destaque_ate: "2099-01-01T00:00:00Z",
      })
      .select("ativo, aprovado_em, destaque_ate")
      .single();
    assert.ifError(error);
    assert.deepEqual(data, { ativo: false, aprovado_em: null, destaque_ate: null });
  });

  test("não dá para criar vendedor em nome de outro usuário", async () => {
    const vitima = await ctx.novoVendedor({ semPerfil: true, semLogin: true });
    const { error } = await ze.client.from("vendedores").insert({
      owner_id: vitima.id,
      nome: "Em nome do outro",
      whatsapp: "5511988887777",
      bairro_id: ze.bairroId,
    });
    assert.ok(error, "RLS deveria exigir owner_id = usuário logado");
  });

  test("metadados extras no cadastro (role, is_admin) não concedem poder nenhum", async () => {
    const s = Math.random().toString(16).slice(2, 10);
    const { data, error } = await admin.auth.admin.createUser({
      email: `meta.${s}@exemplo.com`,
      password: `Senha-${s}-forte`,
      email_confirm: true,
      user_metadata: {
        username: `meta_${s}`,
        categoria_ids: [],
        is_admin: true,
        role: "service_role",
        ativo: true,
        aprovado_em: "2020-01-01",
      },
    });
    assert.ifError(error);
    ctx.usuarios.push({ id: data.user.id });
    const { data: eh } = await admin.from("admins").select("user_id").eq("user_id", data.user.id);
    assert.equal(eh.length, 0, "não pode virar admin por metadado");
    assert.equal(data.user.role, "authenticated");
  });

  test("categoria_ids com lixo no metadado não vira perfil e o cadastro falha de forma limpa", async () => {
    const s = Math.random().toString(16).slice(2, 10);
    const { error } = await admin.auth.admin.createUser({
      email: `lixo.${s}@exemplo.com`,
      password: `Senha-${s}-forte`,
      email_confirm: true,
      user_metadata: { username: `lixo_${s}`, categoria_ids: ["isto-nao-e-uuid"] },
    });
    assert.ok(error, "uuid inválido no metadado deve ser recusado");
  });
});

describe("token forjado", () => {
  test("JWT com role service_role assinado com chave errada é rejeitado", async () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const falso = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role: "service_role", exp: 4102444800 })}.assinatura-falsa`;
    const r = await fetch(`${cfg.url}/rest/v1/admins?select=*`, {
      headers: { apikey: cfg.pub, Authorization: `Bearer ${falso}` },
    });
    assert.ok([401, 403].includes(r.status), `status ${r.status}`);
  });

  test("JWT 'alg: none' é rejeitado", async () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const falso = `${b64({ alg: "none", typ: "JWT" })}.${b64({ role: "service_role", exp: 4102444800 })}.`;
    const r = await fetch(`${cfg.url}/rest/v1/admins?select=*`, {
      headers: { apikey: cfg.pub, Authorization: `Bearer ${falso}` },
    });
    assert.ok([401, 403].includes(r.status), `status ${r.status}`);
  });

  test("sem apikey o acesso é no máximo o de visitante (nada de admin nem de pendentes)", async () => {
    const admins = await fetch(`${cfg.url}/rest/v1/admins?select=*`);
    const corpo = admins.ok ? await admins.json() : [];
    assert.ok(!admins.ok || corpo.length === 0, "tabela admins não pode vazar");

    const r = await fetch(`${cfg.url}/rest/v1/vendedores?select=id,ativo`);
    if (r.ok) {
      const vendedores = await r.json();
      assert.ok(vendedores.every((v) => v.ativo === true), "só vendedores ativos para visitante");
    }
  });
});
