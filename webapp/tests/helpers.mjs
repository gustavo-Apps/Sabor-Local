// Auxiliares dos testes de API e de força bruta.
//
// SEGURANÇA: estes testes criam usuários, disparam milhares de requisições e
// tentam burlar limites. Eles SÓ rodam contra o Supabase LOCAL (127.0.0.1 /
// localhost). Nunca aponte para produção.

import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function carregarConfig() {
  const env = process.env;
  if (env.TEST_SUPABASE_URL && env.TEST_SUPABASE_PUBLISHABLE_KEY && env.TEST_SUPABASE_SECRET_KEY) {
    return {
      url: env.TEST_SUPABASE_URL,
      pub: env.TEST_SUPABASE_PUBLISHABLE_KEY,
      sec: env.TEST_SUPABASE_SECRET_KEY,
      jwtSecret: env.TEST_SUPABASE_JWT_SECRET ?? "",
    };
  }
  const saida = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const status = JSON.parse(saida.slice(saida.indexOf("{")));
  return {
    url: status.API_URL,
    pub: status.PUBLISHABLE_KEY,
    sec: status.SECRET_KEY,
    jwtSecret: status.JWT_SECRET ?? "",
  };
}

export const cfg = carregarConfig();

const host = new URL(cfg.url).hostname;
if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
  throw new Error(
    `Recusado: os testes só rodam contra o Supabase local, mas a URL é ${cfg.url}. ` +
      "Estes testes disparam ataques de força bruta e criam/apagam dados.",
  );
}

const opcoes = (headers = {}) => ({
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers },
});

export const admin = createClient(cfg.url, cfg.sec, opcoes());
export const anonimo = (headers) => createClient(cfg.url, cfg.pub, opcoes(headers));

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const sufixo = () => randomBytes(4).toString("hex");

/** Roda `n` tarefas com no máximo `paralelo` ao mesmo tempo. */
export async function emLotes(n, paralelo, tarefa) {
  const resultados = new Array(n);
  let proximo = 0;
  await Promise.all(
    Array.from({ length: Math.min(paralelo, n) }, async () => {
      while (proximo < n) {
        const i = proximo++;
        resultados[i] = await tarefa(i);
      }
    }),
  );
  return resultados;
}

export async function dadosBase() {
  const [{ data: bairros }, { data: categorias }] = await Promise.all([
    admin.from("bairros").select("id").limit(2),
    admin.from("categorias").select("id").limit(3),
  ]);
  return { bairroId: bairros[0].id, categoriaIds: categorias.map((c) => c.id) };
}

/** Zera os contadores de limite (por IP) para os testes não interferirem entre si. */
export async function zerarLimites() {
  await admin.from("tentativas_codigo").delete().gte("id", 0);
  await admin.from("eventos").delete().not("ip_hash", "is", null);
  await admin.from("denuncias").delete().not("ip_hash", "is", null);
  await admin.from("feedbacks").delete().not("ip_hash", "is", null);
  await admin.from("tentativas_convite").delete().gte("id", 0);
}

export class Contexto {
  usuarios = [];

  /**
   * Cria um vendedor de teste. Opções:
   *  - aprovado: já nasce ativo e aprovado (como se o admin tivesse aprovado)
   *  - ehAdmin: concede papel de administrador
   *  - semPerfil: não cria a linha em `vendedores`
   *  - semLogin: não abre sessão (evita gastar o limite de logins do Auth)
   */
  async novoVendedor({ aprovado = false, ehAdmin = false, semPerfil = false, semLogin = false } = {}) {
    const { bairroId, categoriaIds } = await dadosBase();
    const s = sufixo();
    const email = `teste.${s}@exemplo.com`;
    const senha = `Senha-${s}-forte`;
    const username = `teste_${s}`;

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { username, categoria_ids: [categoriaIds[0]] },
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    const usuario = { id: data.user.id, email, senha, username, bairroId, categoriaIds };
    this.usuarios.push(usuario);

    if (!semLogin) {
      usuario.client = anonimo();
      const { error: erroLogin } = await usuario.client.auth.signInWithPassword({ email, password: senha });
      if (erroLogin) throw new Error(`login: ${erroLogin.message}`);
    }

    if (!semPerfil) {
      const { data: v, error: erroV } = await admin
        .from("vendedores")
        .insert({
          owner_id: usuario.id,
          nome: `Lanchonete ${s}`,
          whatsapp: "5511999990000",
          bairro_id: bairroId,
          ativo: aprovado,
          aprovado_em: aprovado ? new Date().toISOString() : null,
        })
        .select("id")
        .single();
      if (erroV) throw new Error(`vendedor: ${erroV.message}`);
      usuario.vendedorId = v.id;
    }

    if (ehAdmin) await admin.from("admins").insert({ user_id: usuario.id });
    return usuario;
  }

  async limpar() {
    for (const u of this.usuarios) {
      const { data: arquivos } = await admin.storage.from("cardapios").list(u.id);
      if (arquivos?.length) await admin.storage.from("cardapios").remove(arquivos.map((a) => `${u.id}/${a.name}`));
      if (u.vendedorId) await admin.from("vendedores").delete().eq("id", u.vendedorId);
      // vendedores criados direto pela API (sem vendedorId) ficariam órfãos ao apagar o usuário
      await admin.from("vendedores").delete().eq("owner_id", u.id);
      await admin.auth.admin.deleteUser(u.id);
    }
    this.usuarios = [];
    await zerarLimites();
  }
}
