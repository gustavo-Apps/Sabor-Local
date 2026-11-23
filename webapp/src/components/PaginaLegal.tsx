import type { ReactNode } from "react";
import Link from "next/link";
import { TERMOS_DATA, TERMOS_VERSAO } from "@/lib/legal";

export function PaginaLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <h1 className="font-serif text-3xl font-bold">{titulo}</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Versão {TERMOS_VERSAO} · atualizado em {TERMOS_DATA}
      </p>
      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-zinc-700 [&_h2]:mb-2 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-zinc-900 [&_li]:mt-1 [&_table]:w-full [&_td]:border-b [&_td]:border-black/10 [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_th]:border-b [&_th]:border-black/20 [&_th]:py-2 [&_th]:pr-3 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
      <p className="mt-10 text-sm">
        <Link href="/" className="font-semibold text-orange-600 underline">
          Voltar ao início
        </Link>
      </p>
    </article>
  );
}
