"use client";

import { QUANTIDADE_MAXIMA } from "@/lib/carrinho";

// Botões grandes (mínimo 40 px) porque a maior parte do uso é no celular.
const botao =
  "grid h-10 w-10 place-items-center rounded-full border border-green-600 text-xl font-semibold leading-none text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40";

export function Quantidade({
  nome,
  valor,
  aoMudar,
}: {
  nome: string;
  valor: number;
  aoMudar: (novo: number) => void;
}) {
  if (valor === 0) {
    return (
      <button
        type="button"
        onClick={() => aoMudar(1)}
        aria-label={`Adicionar ${nome} ao pedido`}
        className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
      >
        Adicionar
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2" role="group" aria-label={`Quantidade de ${nome}`}>
      <button type="button" className={botao} onClick={() => aoMudar(valor - 1)} aria-label={`Tirar um ${nome}`}>
        −
      </button>
      <span className="min-w-6 text-center font-semibold" aria-live="polite">
        {valor}
      </span>
      <button
        type="button"
        className={botao}
        onClick={() => aoMudar(valor + 1)}
        disabled={valor >= QUANTIDADE_MAXIMA}
        aria-label={`Colocar mais um ${nome}`}
      >
        +
      </button>
    </div>
  );
}
