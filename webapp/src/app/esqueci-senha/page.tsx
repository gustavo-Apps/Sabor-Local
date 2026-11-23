import type { Metadata } from "next";
import Link from "next/link";
import { AcaoForm } from "@/components/AcaoForm";
import { pedirRedefinicao } from "./actions";

export const metadata: Metadata = { title: "Esqueci minha senha", robots: { index: false, follow: false } };

const input = "w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-base";

export default function EsqueciSenhaPage() {
  return (
    <div className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
      <h1 className="font-serif text-2xl font-bold">Esqueci minha senha</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Digite o e-mail ou o usuário da sua conta. Enviamos um link para você criar uma senha nova.
      </p>

      <AcaoForm action={pedirRedefinicao} rotulo="Enviar o link" className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          E-mail ou usuário
          <input
            name="identificador"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
            className={`${input} mt-1`}
          />
        </label>
      </AcaoForm>

      <p className="mt-6 text-sm text-zinc-600">
        Lembrou?{" "}
        <Link href="/login" className="font-semibold text-orange-600 underline">
          Voltar para entrar
        </Link>
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Não chegou nada? Confira o spam. Se continuar sem receber, use o{" "}
        <Link href="/feedback" className="underline">
          Fale conosco
        </Link>
        .
      </p>
    </div>
  );
}
