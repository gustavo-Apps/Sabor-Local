"use client";

import { useState } from "react";
import type { Bairro, Cidade } from "@/lib/types";
import { BAIRRO_OUTRO } from "@/lib/validacao";

const CLASSE = "w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-base";

// Cidade (só se houver mais de uma) e bairro daquela cidade. O servidor grava só o bairro:
// a cidade do vendedor é sempre a do bairro escolhido.
export function CampoLocal({
  cidades,
  bairros,
  bairroInicial,
  sugestaoInicial,
  cidadeInicial,
}: {
  cidades: Cidade[];
  bairros: Bairro[];
  bairroInicial?: string | null;
  /** Bairro que o vendedor sugeriu e ainda espera confirmação. */
  sugestaoInicial?: string | null;
  /** Cidade do vendedor quando ele ainda não tem bairro escolhido (sugestão em análise). */
  cidadeInicial?: string | null;
}) {
  const inicial = bairros.find((b) => b.id === bairroInicial);
  const [cidadeId, setCidadeId] = useState(inicial?.cidade_id ?? cidadeInicial ?? cidades[0]?.id ?? "");
  const [bairroId, setBairroId] = useState(inicial?.id ?? (sugestaoInicial ? BAIRRO_OUTRO : ""));
  const [bairroNovo, setBairroNovo] = useState(sugestaoInicial ?? "");
  // só bairros ativos são oferecidos; o atual do vendedor continua na lista mesmo que tenha sido desativado
  const daCidade = bairros.filter((b) => b.cidade_id === cidadeId && (b.ativo !== false || b.id === bairroInicial));

  return (
    <>
      <input type="hidden" name="cidade_id" value={cidadeId} />
      {cidades.length > 1 && (
        <label className="text-sm font-medium">
          Cidade
          <select
            value={cidadeId}
            onChange={(e) => {
              setCidadeId(e.target.value);
              setBairroId("");
              setBairroNovo("");
            }}
            className={CLASSE}
          >
            {cidades.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="text-sm font-medium">
        Bairro
        <select
          name="bairro_id"
          required
          value={bairroId}
          onChange={(e) => setBairroId(e.target.value)}
          className={CLASSE}
        >
          <option value="">Selecione</option>
          {daCidade.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nome}
            </option>
          ))}
          <option value={BAIRRO_OUTRO}>Não achei meu bairro</option>
        </select>
      </label>
      {bairroId === BAIRRO_OUTRO && (
        <label className="text-sm font-medium">
          Qual é o seu bairro?
          <input
            name="bairro_novo"
            value={bairroNovo}
            onChange={(e) => setBairroNovo(e.target.value)}
            required
            maxLength={60}
            autoComplete="off"
            placeholder="Ex.: Vila Nova"
            className={CLASSE}
          />
          <span className="mt-1 block text-xs font-normal text-zinc-600">
            A equipe confere e inclui na lista. Até lá, seu perfil mostra o bairro como &ldquo;a confirmar&rdquo;.
          </span>
        </label>
      )}
    </>
  );
}
