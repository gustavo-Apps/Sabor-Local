import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AcaoForm } from "@/components/AcaoForm";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { redefinirSenha } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false, follow: false } };

const input = "w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-base";

// Quem chega pelo link do e-mail já está com uma sessão temporária; sem ela, não há o que trocar.
export default async function RedefinirSenhaPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?erro=link");

  return (
    <div className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
      <h1 className="font-serif text-2xl font-bold">Criar uma nova senha</h1>
      <p className="mt-2 text-sm text-zinc-600">Escolha uma senha com pelo menos 8 caracteres.</p>

      <AcaoForm action={redefinirSenha} rotulo="Salvar a nova senha" className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Nova senha
          <input name="senha" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className={`${input} mt-1`} />
        </label>
        <label className="block text-sm font-medium">
          Repita a nova senha
          <input name="confirmacao" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className={`${input} mt-1`} />
        </label>
      </AcaoForm>

      <p className="mt-6 text-sm">
        <Link href="/painel" className="text-zinc-600 underline">
          Cancelar e voltar ao painel
        </Link>
      </p>
    </div>
  );
}
