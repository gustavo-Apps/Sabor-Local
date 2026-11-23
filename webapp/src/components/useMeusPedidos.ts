"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { carrinhosPendentes, type CarrinhoPendente } from "@/lib/carrinho";
import {
  CHAVE_DOS_PEDIDOS,
  guardarPedido,
  lerPedidosGuardados,
  pedidosParaGuardar,
  removerPedidoGuardado,
  type PedidoGuardado,
} from "@/lib/meusPedidos";
import { assinarCarrinhos, listarCarrinhosGuardados } from "@/components/useCarrinho";

// A lista fica no navegador de quem pediu (localStorage). Todos os componentes da página enxergam a mesma lista, na mesma
// aba ou em outra. Sem armazenamento (aba anônima restrita), vale só enquanto a página estiver aberta.

const ouvintes = new Set<() => void>();
let memoria: string | null = null;

function lerTexto(): string | null {
  try {
    return localStorage.getItem(CHAVE_DOS_PEDIDOS);
  } catch {
    return memoria;
  }
}

function gravarTexto(texto: string) {
  memoria = texto;
  try {
    localStorage.setItem(CHAVE_DOS_PEDIDOS, texto);
  } catch {
    // sem armazenamento: segue só na memória desta página
  }
  ouvintes.forEach((o) => o());
}

function assinar(aviso: () => void) {
  ouvintes.add(aviso);
  window.addEventListener("storage", aviso); // outra aba mexeu
  return () => {
    ouvintes.delete(aviso);
    window.removeEventListener("storage", aviso);
  };
}

/** Põe um pedido na lista (se já estava, só atualiza). Usado quando a pessoa abre o link do pedido. */
export function registrarPedido(pedido: PedidoGuardado) {
  const atual = lerPedidosGuardados(lerTexto());
  const novo = guardarPedido(atual, pedido);
  const texto = pedidosParaGuardar(novo);
  if (texto !== pedidosParaGuardar(atual)) gravarTexto(texto);
}

// useSyncExternalStore pede um valor estável enquanto nada mudou: o "instantâneo" é o próprio texto guardado.
export function useMeusPedidos() {
  const texto = useSyncExternalStore(assinar, lerTexto, () => null);
  const pedidos = useMemo(() => lerPedidosGuardados(texto), [texto]);

  const remover = useCallback((token: string) => {
    gravarTexto(pedidosParaGuardar(removerPedidoGuardado(lerPedidosGuardados(lerTexto()), token)));
  }, []);

  const limpar = useCallback(() => gravarTexto("[]"), []);

  return { pedidos, remover, limpar };
}

/** Carrinhos que ficaram guardados (pedidos começados e não finalizados), de qualquer loja. */
export function useCarrinhosPendentes(): CarrinhoPendente[] {
  const instantaneo = useSyncExternalStore(
    assinarCarrinhos,
    () => JSON.stringify(carrinhosPendentes(listarCarrinhosGuardados())),
    () => "[]",
  );
  return useMemo(() => JSON.parse(instantaneo) as CarrinhoPendente[], [instantaneo]);
}
