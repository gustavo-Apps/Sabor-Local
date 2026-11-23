"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";

export type Estado = { erro?: string; ok?: string };

interface Props {
  action: (anterior: Estado, form: FormData) => Promise<Estado>;
  rotulo: string;
  children: React.ReactNode;
  className?: string;
  botaoClassName?: string;
  /** Limpa os campos depois de salvar (útil em formulários de "adicionar"). */
  limpar?: boolean;
}

const BOTAO =
  "rounded-full bg-orange-600 px-6 py-2.5 text-base font-semibold text-white hover:bg-orange-700 disabled:opacity-60";

// Formulário com mensagem de erro/sucesso. Não usa o `action` nativo do form
// para que os campos NÃO sejam apagados quando há erro de validação.
export function AcaoForm({ action, rotulo, children, className, botaoClassName, limpar }: Props) {
  const [estado, executar, pendente] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (limpar && estado.ok) ref.current?.reset();
    if (estado.erro) {
      ref.current?.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach((i) => {
        i.value = "";
      });
    }
  }, [estado, limpar]);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        startTransition(() => executar(dados));
      }}
    >
      {children}
      <div className="sm:col-span-2">
        {estado.erro && (
          <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {estado.erro}
          </p>
        )}
        {estado.ok && (
          <p role="status" className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {estado.ok}
          </p>
        )}
        <button disabled={pendente} className={botaoClassName ?? BOTAO}>
          {pendente ? "Salvando..." : rotulo}
        </button>
      </div>
    </form>
  );
}
