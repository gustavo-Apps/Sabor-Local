"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validarNovaSenha } from "@/lib/validacao";

export type Estado = { erro?: string; ok?: string };

// Troca a senha de quem chegou pelo link do e-mail (ou já está logado e quer trocar).
export async function redefinirSenha(_: Estado, form: FormData): Promise<Estado> {
  const senha = String(form.get("senha") ?? "");
  const confirmacao = String(form.get("confirmacao") ?? "");
  const invalida = validarNovaSenha(senha, confirmacao);
  if (invalida) return { erro: invalida };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?erro=link");

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    return {
      erro:
        error.code === "same_password"
          ? "A nova senha precisa ser diferente da atual."
          : "Não foi possível trocar a senha agora. Peça um novo link e tente de novo.",
    };
  }

  // encerra as outras sessões abertas com a senha antiga
  await supabase.auth.signOut({ scope: "others" });
  redirect("/painel");
}
