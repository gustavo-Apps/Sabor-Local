"use client";

import { useState } from "react";

const campo = "w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-base";

// Atalhos: preenchem o nome do produto e como chamar as escolhas incluídas (Sabores, Acompanhamentos...).
const MODELOS = [
  { nome: "Pizza", escolhas: "Sabores" },
  { nome: "Açaí", escolhas: "Acompanhamentos" },
  { nome: "Marmita", escolhas: "Misturas" },
  { nome: "Sorvete", escolhas: "Sabores" },
] as const;

export function CampoNovoMontavel() {
  const [nome, setNome] = useState("");
  const [escolhas, setEscolhas] = useState("Sabores");

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-600">Modelos:</span>
        {MODELOS.map((m) => (
          <button
            key={m.nome}
            type="button"
            onClick={() => {
              setNome(m.nome);
              setEscolhas(m.escolhas);
            }}
            className="rounded-full border border-black/10 px-3 py-1 hover:border-orange-600"
          >
            {m.nome}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Nome do produto
          <input name="nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={40} autoComplete="off" placeholder="Ex.: Pizza" className={`${campo} mt-1`} />
        </label>
        <label className="text-sm font-medium">
          O cliente escolhe os…
          <input
            name="rotulo_escolhas"
            value={escolhas}
            onChange={(e) => setEscolhas(e.target.value)}
            required
            maxLength={30}
            autoComplete="off"
            placeholder="Sabores"
            className={`${campo} mt-1`}
          />
        </label>
      </div>
    </div>
  );
}
