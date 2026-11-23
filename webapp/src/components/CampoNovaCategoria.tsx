"use client";

import { useState } from "react";
import { SUGESTOES_DE_CATEGORIA } from "@/lib/categoriasProduto";

const campo = "w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-base";

// Nome da categoria com atalhos de nomes comuns: usar o mesmo nome das outras lojas junta os produtos no filtro do catálogo.
export function CampoNovaCategoria({ jaTem }: { jaTem: string[] }) {
  const [nome, setNome] = useState("");
  const tem = new Set(jaTem.map((n) => n.toLowerCase()));
  const sugestoes = SUGESTOES_DE_CATEGORIA.filter((s) => !tem.has(s.toLowerCase()));

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium">
        Nova categoria
        <input
          name="nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          maxLength={30}
          autoComplete="off"
          placeholder="Ex.: Bebidas"
          className={`${campo} mt-1`}
        />
      </label>
      {sugestoes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-600">Atalhos:</span>
          {sugestoes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setNome(s)}
              className="rounded-full border border-black/10 px-3 py-1 hover:border-orange-600"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
