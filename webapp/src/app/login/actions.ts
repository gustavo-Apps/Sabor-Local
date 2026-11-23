"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarCadastro, validarLogin } from "@/lib/validacao";
import { TERMOS_VERSAO } from "@/lib/legal";

export type Estado = { erro?: string; ok?: string };

const ESPERA_MINIMA_FALHA_MS = 400; // iguala o tempo de "conta existe" e "não existe"

function ipDoCliente(h: Headers) {
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  const cadeia = (h.get("x-forwarded-for") ?? "").split(",");
  return cadeia[0]?.trim() ?? "";
}

export async function entrar(_: Estado, form: FormData): Promise<Estado> {
  const identificador = String(form.get("identificador") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const invalido = validarLogin(identificador, senha);
  if (invalido) return { erro: invalido };

  const inicio = Date.now();
  const admin = createAdminClient();
  const ip = ipDoCliente(await headers());

  const { data: bloqueado } = await admin.rpc("login_bloqueado", { p_conta: identificador, p_ip: ip });
  if (bloqueado) {
    return { erro: "Muitas tentativas de entrada. Aguarde 15 minutos e tente de novo." };
  }

  let email = identificador;
  if (!identificador.includes("@")) {
    const { data } = await admin.rpc("email_por_username", { p_username: identificador });
    email = (data as string | null) ?? "";
  }

  const supabase = await createClient();
  const { error } = email
    ? await supabase.auth.signInWithPassword({ email, password: senha })
    : { error: { code: "invalid_credentials" } };

  if (error) {
    await admin.rpc("registrar_falha_login", { p_conta: identificador, p_ip: ip });
    const espera = ESPERA_MINIMA_FALHA_MS - (Date.now() - inicio);
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));

    // Mensagem genérica para não revelar se o usuário existe
    const naoConfirmado = error.code === "email_not_confirmed";
    return {
      erro: naoConfirmado
        ? "Confirme seu e-mail antes de entrar. Procure o link que enviamos."
        : "Usuário/e-mail ou senha incorretos.",
    };
  }

  await admin.rpc("limpar_falhas_login", { p_conta: identificador });
  redirect("/painel");
}

export async function cadastrar(_: Estado, form: FormData): Promise<Estado> {
  const categoriaIds = form.getAll("categoria_ids").map(String).filter(Boolean);
  const senha = String(form.get("senha") ?? "");
  const v = validarCadastro({
    email: String(form.get("email") ?? ""),
    username: String(form.get("username") ?? ""),
    senha,
    categoriaIds,
    aceitouTermos: form.get("aceite_termos") === "on",
  });
  if (!v.ok) return { erro: v.erro };
  const { email, username } = v.valor;

  const admin = createAdminClient();
  const { data: existente } = await admin.rpc("email_por_username", { p_username: username });
  if (existente) return { erro: "Esse nome de usuário já está em uso." };

  const h = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? h.get("origin") ?? `http://${h.get("host")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: { username, categoria_ids: categoriaIds, termos_versao: TERMOS_VERSAO },
      emailRedirectTo: `${origin}/auth/callback?next=/painel`,
    },
  });

  if (error) {
    if (error.code === "user_already_exists") return { erro: "Esse e-mail já está cadastrado." };
    return { erro: "Não foi possível criar a conta. Tente novamente." };
  }

  return { ok: "Conta criada! Enviamos um e-mail de confirmação. Clique no link para ativar o acesso." };
}
