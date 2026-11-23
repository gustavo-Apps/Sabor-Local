"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Bairro, Categoria, ItemCardapio, Vendedor } from "@/lib/types";
import { VendorCard } from "@/components/VendorCard";
import { ehMinhaLoja } from "@/lib/minhaLoja";
import { situacaoAgora } from "@/lib/horarios";
import { ordenarPorPrioridade } from "@/lib/ordenacao";
import { buscarNaLoja, type ModoBusca } from "@/lib/busca";
import { opcoesDeCategoria } from "@/lib/categoriasProduto";

const MODOS: { id: ModoBusca; rotulo: string; dica: string }[] = [
  { id: "tudo", rotulo: "Tudo", dica: "Loja ou produto: pastel, chocolate" },
  { id: "loja", rotulo: "Nome da loja", dica: "Nome da loja, ex.: Esquina" },
  { id: "produto", rotulo: "Produto", dica: "Produto: pastel, chocolate, carne" },
];

interface Props {
  vendedores: Vendedor[];
  categorias: Categoria[];
  bairros: Bairro[];
  /** Loja de quem está logado: ganha o selo "Sua loja" na lista. */
  minhaLojaId?: string | null;
}

export function CatalogoClient({ vendedores, categorias, bairros, minhaLojaId = null }: Props) {
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<ModoBusca>("tudo");
  const [categoriaId, setCategoriaId] = useState<string>("");
  // "Tipo de produto": categoria que os vendedores criaram no menu (Bebidas, Salgados, Doces...). Vazio = todos os tipos.
  const [tipoProduto, setTipoProduto] = useState<string>("");
  const [bairroId, setBairroId] = useState<string>("");
  const [apenasAberto, setApenasAberto] = useState(false);

  const [agora] = useState(() => Date.now());

  const tiposDeProduto = useMemo(() => opcoesDeCategoria(vendedores), [vendedores]);

  const { resultado, encontrados } = useMemo(() => {
    // os produtos que bateram com a busca e/ou com o tipo de produto, por loja, para mostrar no cartão
    const encontrados = new Map<string, ItemCardapio[]>();
    const filtrados = vendedores.filter((v) => {
      if (categoriaId && !v.categorias.some((c) => c.id === categoriaId)) return false;
      if (bairroId && v.bairro?.id !== bairroId) return false;
      if (apenasAberto && !situacaoAgora(v).aberto) return false;

      const r = buscarNaLoja(v, busca, modo, tipoProduto);
      if (r.passa) encontrados.set(v.id, r.itens);
      return r.passa;
    });

    // plano destaque: quem tem destaque ativo aparece primeiro na busca
    return { resultado: ordenarPorPrioridade(filtrados, agora, (v) => situacaoAgora(v).aberto), encontrados };
  }, [vendedores, busca, modo, categoriaId, tipoProduto, bairroId, apenasAberto, agora]);

  const filtrando = Boolean(busca.trim() || categoriaId || tipoProduto || bairroId || apenasAberto);

  const descoberta = useMemo(() => {
    const catorzeDias = 14 * 24 * 60 * 60 * 1000;
    return {
      destaques: vendedores.filter((v) => v.destaque_ate && new Date(v.destaque_ate).getTime() > agora),
      abertos: vendedores.filter((v) => situacaoAgora(v).aberto),
      novos: vendedores.filter((v) => v.created_at && agora - new Date(v.created_at).getTime() < catorzeDias),
      porBairro: bairros
        .map((b) => ({ bairro: b, total: vendedores.filter((v) => v.bairro?.id === b.id).length }))
        .filter((x) => x.total > 0),
    };
  }, [vendedores, bairros, agora]);

  return (
    <div>
      {vendedores.length === 0 && (
        <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900">
          <p className="font-semibold">Ainda não há vendedores nesta cidade.</p>
          <p className="mt-1">
            Tem um negócio de comida? Cadastre-se grátis e apareça aqui:{" "}
            <Link href="/painel" className="font-semibold underline">
              Sou vendedor
            </Link>
            .
          </p>
        </div>
      )}
      <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <label htmlFor="busca-catalogo" className="sr-only">
          Buscar no catálogo
        </label>
        <div className="flex items-center gap-2">
          <input
            id="busca-catalogo"
            type="search"
            placeholder={MODOS.find((m) => m.id === modo)!.dica}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            className="min-w-0 flex-1 rounded-xl border border-black/15 px-4 py-3 text-base outline-none focus:border-orange-600"
          />
        </div>

        <div role="group" aria-label="O que buscar" className="mt-3 flex flex-wrap gap-2">
          {MODOS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={modo === m.id}
              onClick={() => setModo(m.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                modo === m.id
                  ? "border-orange-600 bg-orange-600 font-semibold text-white"
                  : "border-black/10 bg-white text-zinc-700 hover:border-orange-600"
              }`}
            >
              {m.rotulo}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <select
            aria-label="Ramo do negócio"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm"
          >
            <option value="">Todos os ramos</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>

          {tiposDeProduto.length > 0 && (
            <select
              aria-label="Tipo de produto"
              value={tipoProduto}
              onChange={(e) => setTipoProduto(e.target.value)}
              className="rounded-lg border border-black/10 px-3 py-2 text-sm"
            >
              <option value="">Todos os tipos de produto</option>
              {tiposDeProduto.map((t) => (
                <option key={t.chave} value={t.chave}>
                  {t.nome} ({t.lojas} {t.lojas === 1 ? "loja" : "lojas"})
                </option>
              ))}
            </select>
          )}

          <select
            aria-label="Bairro"
            value={bairroId}
            onChange={(e) => setBairroId(e.target.value)}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm"
          >
            <option value="">Todos os bairros</option>
            {bairros.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm">
            <input type="checkbox" checked={apenasAberto} onChange={(e) => setApenasAberto(e.target.checked)} />
            Aberto agora
          </label>

          {filtrando && (
            <button
              type="button"
              onClick={() => {
                setBusca("");
                setModo("tudo");
                setCategoriaId("");
                setTipoProduto("");
                setBairroId("");
                setApenasAberto(false);
              }}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-orange-600 underline"
            >
              Limpar busca
            </button>
          )}
        </div>
      </div>

      {!filtrando && (
        <div className="mt-8 mb-8 space-y-8">
          {descoberta.porBairro.length > 0 && (
            <section>
              <h2 className="font-serif text-lg font-bold">Por bairro</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {descoberta.porBairro.map(({ bairro, total }) => (
                  <button
                    key={bairro.id}
                    type="button"
                    onClick={() => setBairroId(bairro.id)}
                    className="rounded-full border border-black/10 bg-white px-4 py-1.5 text-sm hover:border-orange-600"
                  >
                    {bairro.nome} <span className="text-zinc-500">({total})</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {[
            ["Em destaque", descoberta.destaques],
            ["Abertos agora", descoberta.abertos],
            ["Novidades", descoberta.novos],
          ].map(
            ([titulo, lista]) =>
              (lista as Vendedor[]).length > 0 && (
                <section key={titulo as string}>
                  <h2 className="font-serif text-lg font-bold">{titulo as string}</h2>
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {(lista as Vendedor[]).slice(0, 3).map((v) => (
                      <VendorCard key={v.id} vendedor={v} minha={ehMinhaLoja(minhaLojaId, v.id)} />
                    ))}
                  </div>
                </section>
              ),
          )}
          <h2 className="font-serif text-lg font-bold">Todos os vendedores</h2>
        </div>
      )}

      <p className="mt-4 text-sm text-gray-500">
        {resultado.length} vendedor{resultado.length === 1 ? "" : "es"} encontrado
        {resultado.length === 1 ? "" : "s"}
      </p>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resultado.map((v) => (
          <VendorCard
            key={v.id}
            vendedor={v}
            minha={ehMinhaLoja(minhaLojaId, v.id)}
            busca={modo === "loja" ? "" : busca}
            categoria={tipoProduto}
            itensEncontrados={encontrados.get(v.id) ?? []}
          />
        ))}
      </div>
    </div>
  );
}
