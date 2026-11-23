"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { cadastrar, entrar, type Estado } from "./actions";
import type { Categoria } from "@/lib/types";

const input = "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm";
const botao =
  "w-full rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60";

// Envia o formulário sem o `action` nativo: o React 19 apagaria todos os campos
// depois de cada envio. Aqui os campos ficam; só as senhas são limpas quando há erro.
function enviar(executar: (dados: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    startTransition(() => executar(new FormData(form)));
  };
}

function limparSenhas(form: HTMLFormElement | null) {
  form?.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach((i) => {
    i.value = "";
  });
}

export function LoginForms({ categorias, erroLink }: { categorias: Categoria[]; erroLink: boolean }) {
  const [aba, setAba] = useState<"entrar" | "cadastrar">("entrar");
  const [estadoEntrar, acaoEntrar, entrando] = useActionState<Estado, FormData>(entrar, {});
  const [estadoCadastro, acaoCadastro, cadastrando] = useActionState<Estado, FormData>(cadastrar, {});
  const formEntrar = useRef<HTMLFormElement>(null);
  const formCadastro = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estadoEntrar.erro) limparSenhas(formEntrar.current);
  }, [estadoEntrar]);

  useEffect(() => {
    if (estadoCadastro.erro) limparSenhas(formCadastro.current);
  }, [estadoCadastro]);

  const aba_ = (id: typeof aba, rotulo: string) => (
    <button
      type="button"
      onClick={() => setAba(id)}
      className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
        aba === id ? "bg-white shadow-sm" : "text-zinc-600"
      }`}
    >
      {rotulo}
    </button>
  );

  return (
    <div className="mt-6">
      {erroLink && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          O link de confirmação é inválido ou expirou. Tente entrar ou criar a conta novamente.
        </p>
      )}
      <div className="flex gap-1 rounded-full bg-zinc-100 p-1">
        {aba_("entrar", "Já tenho conta")}
        {aba_("cadastrar", "Criar conta")}
      </div>

      {aba === "entrar" ? (
        <form ref={formEntrar} onSubmit={enviar(acaoEntrar)} className="mt-5 space-y-3">
          <input name="identificador" required autoComplete="username" placeholder="Usuário ou e-mail" className={input} />
          <input name="senha" type="password" required autoComplete="current-password" placeholder="Senha" className={input} />
          {estadoEntrar.erro && <p className="text-sm text-red-600">{estadoEntrar.erro}</p>}
          <button disabled={entrando} className={botao}>{entrando ? "Entrando..." : "Entrar"}</button>
          <p className="text-center text-sm">
            <Link href="/esqueci-senha" className="font-semibold text-orange-600 underline">
              Esqueci minha senha
            </Link>
          </p>
        </form>
      ) : estadoCadastro.ok ? (
        <p className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-700">{estadoCadastro.ok}</p>
      ) : (
        <form ref={formCadastro} onSubmit={enviar(acaoCadastro)} className="mt-5 space-y-3">
          <input name="email" type="email" required autoComplete="email" placeholder="E-mail" className={input} />
          <input name="username" required autoComplete="username" placeholder="Usuário (ex.: pizzaria.do.ze)" className={input} />
          <input name="senha" type="password" required minLength={8} autoComplete="new-password" placeholder="Senha (mín. 8 caracteres)" className={input} />
          <fieldset className="rounded-lg border border-black/10 p-3">
            <legend className="px-1 text-xs text-zinc-600">Ramos do negócio (escolha um ou mais)</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {categorias.map((c) => (
                <label key={c.id} className="cursor-pointer">
                  <input type="checkbox" name="categoria_ids" value={c.id} className="peer sr-only" />
                  <span className="inline-block rounded-full border border-black/10 px-3 py-1 text-xs peer-checked:border-orange-600 peer-checked:bg-orange-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-orange-400">
                    {c.nome}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-2 text-xs text-zinc-600">
            <input type="checkbox" name="aceite_termos" className="mt-0.5" />
            <span>
              Li e aceito os{" "}
              <Link href="/termos" target="_blank" className="font-semibold text-orange-600 underline">
                Termos de Uso
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" target="_blank" className="font-semibold text-orange-600 underline">
                Política de Privacidade
              </Link>
              .
            </span>
          </label>
          {estadoCadastro.erro && <p className="text-sm text-red-600">{estadoCadastro.erro}</p>}
          <button disabled={cadastrando} className={botao}>{cadastrando ? "Criando..." : "Criar conta"}</button>
        </form>
      )}
    </div>
  );
}
