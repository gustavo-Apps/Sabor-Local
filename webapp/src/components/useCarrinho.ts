"use client";

import { useCallback, useSyncExternalStore } from "react";
import { chaveDoCarrinho, definirQuantidade, lerCarrinho, PREFIXO_DO_CARRINHO, type Carrinho } from "@/lib/carrinho";

// O carrinho fica no navegador de quem pede (localStorage), um por loja. Todos os componentes da página e a
// tela de pedido enxergam o mesmo carrinho, na mesma aba ou em outra. Se o navegador não deixar gravar
// (aba anônima restrita), o carrinho vale só enquanto a página estiver aberta.

const VAZIO: Carrinho = Object.freeze({}) as Carrinho;
const ouvintes = new Set<() => void>();
const memoria = new Map<string, string>();
const lidos = new Map<string, { texto: string | null; valor: Carrinho }>();

function lerTexto(vendedorId: string): string | null {
  try {
    return localStorage.getItem(chaveDoCarrinho(vendedorId));
  } catch {
    return memoria.get(vendedorId) ?? null;
  }
}

function gravarTexto(vendedorId: string, texto: string) {
  memoria.set(vendedorId, texto);
  try {
    localStorage.setItem(chaveDoCarrinho(vendedorId), texto);
  } catch {
    // sem armazenamento: segue só na memória desta página
  }
}

// useSyncExternalStore exige o MESMO objeto enquanto nada mudou; por isso guardamos o último valor lido.
function instantaneo(vendedorId: string): Carrinho {
  const texto = lerTexto(vendedorId);
  const antes = lidos.get(vendedorId);
  if (antes && antes.texto === texto) return antes.valor;
  const valor = texto ? lerCarrinho(texto) : VAZIO;
  lidos.set(vendedorId, { texto, valor });
  return valor;
}

function assinar(aviso: () => void) {
  ouvintes.add(aviso);
  window.addEventListener("storage", aviso); // outra aba mexeu
  return () => {
    ouvintes.delete(aviso);
    window.removeEventListener("storage", aviso);
  };
}

export const assinarCarrinhos = assinar;

/** Todos os carrinhos guardados neste navegador (um por loja), como pares [chave, texto]. */
export function listarCarrinhosGuardados(): [string, string][] {
  const entradas = new Map<string, string>();
  for (const [vendedorId, texto] of memoria) entradas.set(chaveDoCarrinho(vendedorId), texto);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i);
      const texto = chave?.startsWith(PREFIXO_DO_CARRINHO) ? localStorage.getItem(chave) : null;
      if (chave && texto !== null) entradas.set(chave, texto);
    }
  } catch {
    // sem armazenamento: só o que está na memória desta página
  }
  return [...entradas];
}

/** Esvazia o carrinho de uma loja (usado pela lista "Meus pedidos"). */
export function esvaziarCarrinho(vendedorId: string) {
  gravarTexto(vendedorId, "{}");
  ouvintes.forEach((o) => o());
}

export function useCarrinho(vendedorId: string) {
  const carrinho = useSyncExternalStore(
    assinar,
    () => instantaneo(vendedorId),
    () => VAZIO,
  );

  const definir = useCallback(
    (itemId: string, quantidade: number) => {
      gravarTexto(vendedorId, JSON.stringify(definirQuantidade(instantaneo(vendedorId), itemId, quantidade)));
      ouvintes.forEach((o) => o());
    },
    [vendedorId],
  );

  const limpar = useCallback(() => {
    gravarTexto(vendedorId, "{}");
    ouvintes.forEach((o) => o());
  }, [vendedorId]);

  return { carrinho, definir, limpar };
}
