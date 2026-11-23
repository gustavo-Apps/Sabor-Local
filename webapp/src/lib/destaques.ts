// Itens em destaque no perfil. Sem dependências, para rodar no servidor e nos testes.
//
//  * "Destaque da casa": escolha do vendedor (até 3).
//  * "Mais pedido": vem de dados, pelos toques em "Pedir este item" (ranking calculado no banco).
// O item indisponível nunca ganha selo nem entra na seção de destaques.

export const MAX_DESTAQUES_DA_CASA = 3;
export const MAX_NA_SECAO_DE_DESTAQUES = 5;

export type MotivoDestaque = "casa" | "pedido";

export const ROTULOS_DESTAQUE: Record<MotivoDestaque, string> = {
  casa: "Destaque da casa",
  pedido: "Mais pedido",
};

export interface ItemParaDestaque {
  id: string;
  ordem: number;
  destaque?: boolean;
}

export interface ItemDestacado<T extends ItemParaDestaque> {
  item: T;
  motivos: MotivoDestaque[];
}

/** Motivos de um item: escolhido pela casa e/ou entre os mais pedidos. Item indisponível não tem nenhum. */
export function motivosDoItem(item: ItemParaDestaque, maisPedidos: readonly string[], disponivel: boolean): MotivoDestaque[] {
  if (!disponivel) return [];
  const motivos: MotivoDestaque[] = [];
  if (item.destaque) motivos.push("casa");
  if (maisPedidos.includes(item.id)) motivos.push("pedido");
  return motivos;
}

/**
 * Seção "Destaques" do topo do perfil: primeiro as escolhas da casa (na ordem do menu), depois os mais pedidos
 * (na ordem do ranking), sem repetir item, no máximo 5.
 */
export function montarDestaques<T extends ItemParaDestaque>(
  itens: readonly T[],
  maisPedidos: readonly string[],
  /** Normalmente `disponibilidadeDoItem(item, hoje) === "disponivel"`. */
  estaDisponivel: (item: T) => boolean,
): ItemDestacado<T>[] {
  const comMotivos = (item: T) => ({ item, motivos: motivosDoItem(item, maisPedidos, estaDisponivel(item)) });

  const daCasa = itens
    .filter((i) => i.destaque)
    .sort((a, b) => a.ordem - b.ordem)
    .map(comMotivos);
  const pedidos = maisPedidos
    .map((id) => itens.find((i) => i.id === id))
    .filter((i): i is T => Boolean(i) && !i!.destaque)
    .map(comMotivos);

  return [...daCasa, ...pedidos].filter((d) => d.motivos.length > 0).slice(0, MAX_NA_SECAO_DE_DESTAQUES);
}

/** Selos de texto de um item, na ordem em que aparecem. */
export function selosDoItem(motivos: readonly MotivoDestaque[]): string[] {
  return motivos.map((m) => ROTULOS_DESTAQUE[m]);
}
