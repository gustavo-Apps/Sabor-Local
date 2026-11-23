"use client";

import { useOptimistic, useTransition } from "react";
import { definirCategoriaDoItem } from "@/app/painel/actions";

// Troca a categoria do item assim que o vendedor escolhe (sem botão "salvar").
//
// O campo é controlado e otimista de propósito: num <form action> com campo não controlado, o React 19 zera o formulário
// quando a ação termina, e o select voltava para a categoria antiga até o vendedor apertar F5. Aqui o valor escolhido
// aparece na hora e, quando a página recarrega com os dados do banco, o valor real assume (e, se o salvamento falhar,
// o select volta sozinho para o que está salvo).
export function CategoriaDoItem({
  itemId,
  categoriaAtual,
  categorias,
  nomeDoItem,
}: {
  itemId: string;
  categoriaAtual: string | null;
  categorias: { id: string; nome: string }[];
  nomeDoItem: string;
}) {
  const [valor, definirValorOtimista] = useOptimistic(categoriaAtual ?? "");
  const [salvando, iniciar] = useTransition();

  function escolher(novo: string) {
    iniciar(async () => {
      definirValorOtimista(novo);
      const dados = new FormData();
      dados.set("id", itemId);
      dados.set("categoria_id", novo);
      await definirCategoriaDoItem(dados);
    });
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <label className="font-medium text-zinc-600" htmlFor={`cat-${itemId}`}>
        Categoria
      </label>
      <select
        id={`cat-${itemId}`}
        value={valor}
        disabled={salvando}
        aria-label={`Categoria de ${nomeDoItem}`}
        aria-busy={salvando}
        onChange={(e) => escolher(e.target.value)}
        className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
      >
        <option value="">Sem categoria</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
      {salvando && <span className="text-zinc-500">Salvando...</span>}
    </div>
  );
}
