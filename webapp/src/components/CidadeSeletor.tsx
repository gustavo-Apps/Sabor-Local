"use client";

import { useRouter } from "next/navigation";
import type { Cidade } from "@/lib/types";

// Aparece só quando há mais de uma cidade ativa. Lembra a escolha por 1 ano.
export function CidadeSeletor({ cidades, atual }: { cidades: Cidade[]; atual: Cidade }) {
  const router = useRouter();
  if (cidades.length < 2) return null;

  function escolher(slug: string) {
    document.cookie = `cidade=${slug}; path=/; max-age=31536000; SameSite=Lax`;
    router.push(`/?cidade=${slug}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <span aria-hidden>📍</span>
      <span className="sr-only">Cidade</span>
      <select
        value={atual.slug}
        onChange={(e) => escolher(e.target.value)}
        className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm"
      >
        {[...cidades].sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")).map((c) => (
          <option key={c.id} value={c.slug}>
            {c.nome}
            {c.uf ? ` - ${c.uf}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
