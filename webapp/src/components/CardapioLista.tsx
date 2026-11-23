"use client";

import { useMemo, useState } from "react";
import { itensQueCasam } from "@/lib/busca";
import { agruparPorCategoria, categoriasEmUso, type CategoriaDeProduto } from "@/lib/categoriasProduto";
import { registrarEvento } from "@/components/Rastreio";
import { Quantidade } from "@/components/Quantidade";
import { useCarrinho } from "@/components/useCarrinho";

export interface ItemDoPerfil {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number | null;
  foto_url: string | null;
  /** "Indisponível hoje" etc.; o item continua na lista, esmaecido. */
  selo: string | null;
  /** Categoria que o vendedor escolheu para o item (opcional). */
  categoria?: CategoriaDeProduto | null;
  /** "Destaque da casa" e/ou "Mais pedido". */
  destaques?: string[];
  /** Endereço do WhatsApp com este item na mensagem; null quando não dá para pedir (indisponível ou é a própria loja). */
  pedirHref?: string | null;
}

// Menus pequenos dispensam a busca; a partir daqui ela ajuda a achar "pastel", "chocolate", "carne"...
const MIN_ITENS_PARA_BUSCA = 5;

export function CardapioLista({
  itens,
  vendedorId,
  buscaInicial = "",
  categoriaInicial = "",
  semBusca = false,
  comPedido = false,
}: {
  itens: ItemDoPerfil[];
  vendedorId: string;
  buscaInicial?: string;
  /** Chave da categoria que já abre selecionada (vem do filtro "Tipo de produto" do catálogo). */
  categoriaInicial?: string;
  /** Loja recebendo pedidos pelo site agora: cada item ganha "Adicionar" e quantidade no lugar do "Pedir" pelo WhatsApp. */
  comPedido?: boolean;
  /** Lista curta (seção de destaques): nunca mostra a caixa de busca. */
  semBusca?: boolean;
}) {
  const [busca, setBusca] = useState(buscaInicial);
  const categorias = useMemo(() => (semBusca ? [] : categoriasEmUso(itens)), [itens, semBusca]);
  const temSemCategoria = categorias.length > 0 && itens.some((i) => !i.categoria);
  // categoria escolhida: uma das da loja, "__sem" (itens sem categoria) ou vazio (todas); valor inválido vira "todas"
  const [categoria, setCategoria] = useState(categorias.some((c) => c.chave === categoriaInicial) ? categoriaInicial : "");
  const mostrarBusca = !semBusca && (itens.length >= MIN_ITENS_PARA_BUSCA || Boolean(buscaInicial));
  const visiveis = useMemo(() => {
    const daCategoria = categoria
      ? itens.filter((i) => (categoria === "__sem" ? !i.categoria : i.categoria?.chave === categoria))
      : itens;
    return busca.trim() ? itensQueCasam(daCategoria, busca) : daCategoria;
  }, [itens, busca, categoria]);
  const secoes = useMemo(() => agruparPorCategoria(visiveis), [visiveis]);

  return (
    <>
      {mostrarBusca && (
        <div className="mt-3">
          <label htmlFor="busca-cardapio" className="sr-only">
            Buscar no cardápio
          </label>
          <input
            id="busca-cardapio"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no cardápio: pastel, carne"
            autoComplete="off"
            enterKeyHint="search"
            className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-base outline-none focus:border-orange-600"
          />
          {busca.trim() && (
            <p role="status" className="mt-2 text-sm text-zinc-600">
              {visiveis.length === 0
                ? "Nenhum item encontrado nesta loja."
                : `${visiveis.length} ${visiveis.length === 1 ? "item encontrado" : "itens encontrados"}`}
            </p>
          )}
        </div>
      )}

      {categorias.length > 0 && (
        <div role="group" aria-label="Categorias do cardápio" className="mt-3 flex flex-wrap gap-2">
          {[{ chave: "", nome: "Todos" }, ...categorias, ...(temSemCategoria ? [{ chave: "__sem", nome: "Outros" }] : [])].map((c) => (
            <button
              key={c.chave || "todos"}
              type="button"
              aria-pressed={categoria === c.chave}
              onClick={() => setCategoria(c.chave)}
              className={`rounded-full border px-3 py-1 text-sm ${
                categoria === c.chave
                  ? "border-orange-600 bg-orange-600 font-semibold text-white"
                  : "border-black/10 bg-white text-zinc-700 hover:border-orange-600"
              }`}
            >
              {c.nome}
            </button>
          ))}
        </div>
      )}

      {secoes.map((secao) => (
        <div key={secao.categoria?.chave ?? "sem"}>
          {categorias.length > 0 && (
            <h3 className="mt-4 font-serif text-base font-bold text-zinc-800">{secao.categoria?.nome ?? "Outros"}</h3>
          )}
          <ul className="mt-2 divide-y divide-black/5 rounded-2xl border border-black/10 bg-white">
            {secao.itens.map((item) => (
              <li key={item.id} className={`flex items-start justify-between gap-4 p-4 ${item.selo ? "opacity-60" : ""}`}>
                {item.foto_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.foto_url} alt={item.nome} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                )}
                <div className="flex-1">
                  <p className="font-medium">
                    {item.nome}
                    {item.selo && (
                      <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 align-middle text-xs font-semibold text-zinc-700">
                        {item.selo}
                      </span>
                    )}
                    {item.destaques?.map((d) => (
                      <span
                        key={d}
                        className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-semibold text-amber-800"
                      >
                        {d === "Destaque da casa" ? "★ " : ""}
                        {d}
                      </span>
            ))}
                </p>
                {item.descricao && <p className="text-sm text-zinc-500">{item.descricao}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {item.preco != null && (
                  <p className="font-semibold">
                    {item.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                )}
                {item.pedirHref && comPedido && <ControleDoPedido vendedorId={vendedorId} itemId={item.id} nome={item.nome} />}
                {item.pedirHref && !comPedido && (
                  <a
                    href={item.pedirHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => registrarEvento("pedir_item", vendedorId, null, item.id)}
                    aria-label={`Pedir ${item.nome} pelo WhatsApp`}
                    className="rounded-full border border-green-600 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-50"
                  >
                    Pedir
                  </a>
                )}
              </div>
            </li>
          ))}
          </ul>
        </div>
      ))}
    </>
  );
}

function ControleDoPedido({ vendedorId, itemId, nome }: { vendedorId: string; itemId: string; nome: string }) {
  const { carrinho, definir } = useCarrinho(vendedorId);
  return <Quantidade nome={nome} valor={carrinho[itemId] ?? 0} aoMudar={(q) => definir(itemId, q)} />;
}
