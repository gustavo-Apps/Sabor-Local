"use client";

import Link from "next/link";

// Rede de segurança: qualquer erro inesperado de uma página cai aqui, em português e com uma saída.
export default function Erro({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="font-serif text-2xl font-bold">Algo deu errado</h1>
      <p className="mt-2 text-zinc-600">
        Não conseguimos carregar esta página agora. Tente de novo; se continuar, avise a equipe para corrigirmos.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
        <button onClick={reset} className="rounded-full bg-orange-600 px-6 py-2.5 font-semibold text-white hover:bg-orange-700">
          Tentar de novo
        </button>
        <Link href="/feedback" className="rounded-full border border-black/10 px-6 py-2.5 font-semibold hover:bg-zinc-100">
          Avisar a equipe
        </Link>
      </div>
    </div>
  );
}
