"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarRecuperacao } from "@/lib/validacao";

export type Estado = { erro?: string; ok?: string };

const ESPERA_MINIMA_MS = 900; // iguala o tempo de "conta existe" e "não existe"
const MENSAGEM =
  "Se existir uma conta com esses dados, enviamos um e-mail com o link para criar uma nova senha. Olhe também a caixa de spam.";

function ipDoCliente(h: Headers) {
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  const cadeia = (h.get("x-forwarded-for") ?? "").split(",");
  return cadeia[cadeia.length - 1]?.trim() ?? "";
}

// Pede o e-mail de redefinição. A resposta é sempre a mesma, exista a conta ou não, para não revelar quem está cadastrado.
export async function pedirRedefinicao(_: Estado, form: FormData): Promise<Estado> {
  const v = validarRecuperacao(String(form.get("identificador") ?? ""));
  if (!v.ok) return { erro: v.erro };
  const identificador = v.valor;

  const inicio = Date.now();
  const admin = createAdminClient();
  const h = await headers();
  const ip = ipDoCliente(h);
  const conta = `recuperar:${identificador}`;

  // mesmo limite do login: 10 pedidos por conta e 30 por IP em 15 minutos
  const { data: bloqueado } = await admin.rpc("login_bloqueado", { p_conta: conta, p_ip: ip });
  if (bloqueado) return { erro: "Muitos pedidos seguidos. Aguarde 15 minutos e tente de novo." };
  await admin.rpc("registrar_falha_login", { p_conta: conta, p_ip: ip });

  let email = identificador;
  if (!identificador.includes("@")) {
    const { data } = await admin.rpc("email_por_username", { p_username: identificador });
    email = (data as string | null) ?? "";
  }

  if (email) {
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? h.get("origin") ?? `http://${h.get("host")}`;
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/redefinir-senha`,
    });
  }

  const espera = ESPERA_MINIMA_MS - (Date.now() - inicio);
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  return { ok: MENSAGEM };
}
