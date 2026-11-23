"use client";

import Link from "next/link";
import { useCarrinhosPendentes, useMeusPedidos } from "@/components/useMeusPedidos";

// Só aparece no cabeçalho para quem já fez ou começou um pedido neste aparelho.
export function LinkMeusPedidos() {
  const { pedidos } = useMeusPedidos();
  const carrinhos = useCarrinhosPendentes();
  if (pedidos.length === 0 && carrinhos.length === 0) return null;
  return (
    <Link href="/meus-pedidos" className="font-semibold text-orange-700 hover:text-orange-800">
      Meus pedidos
    </Link>
  );
}
