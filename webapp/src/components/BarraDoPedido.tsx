"use client";

import Link from "next/link";
import { linhasDoCarrinho } from "@/lib/carrinho";
import { linhasMontadas, type Montavel } from "@/lib/montaveis";
import { brl, calcularTotais } from "@/lib/pedidos";
import { useCarrinho } from "@/components/useCarrinho";

interface ItemDisponivel {
  id: string;
  nome: string;
  preco: number | null;
}

// Faixa fixa no rodapé com o resumo do pedido e o caminho para finalizar.
export function BarraDoPedido({
  vendedorId,
  disponiveis,
  montaveis = [],
}: {
  vendedorId: string;
  disponiveis: ItemDisponivel[];
  montaveis?: Montavel[];
}) {
  const { carrinho } = useCarrinho(vendedorId);
  const linhas = [...linhasDoCarrinho(carrinho, disponiveis), ...linhasMontadas(carrinho, montaveis)];
  if (linhas.length === 0) return null;

  const t = calcularTotais(linhas, "retirada", 0);
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white p-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
      <Link
        href={`/vendedores/${vendedorId}/pedido`}
        className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-full bg-green-600 px-5 py-3 font-semibold text-white hover:bg-green-700"
      >
        <span>
          Ver meu pedido · {t.quantidade} {t.quantidade === 1 ? "item" : "itens"}
        </span>
        <span>
          {brl(t.subtotal)}
          {t.sobConsulta ? " +" : ""}
        </span>
      </Link>
    </div>
  );
}
