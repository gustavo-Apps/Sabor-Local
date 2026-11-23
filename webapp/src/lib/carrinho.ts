// Carrinho do pedido pelo site: itens e quantidades de UMA loja, guardados no navegador de quem pede.
// Sem imports e sem acesso ao navegador aqui (só funções puras), para testar sem tela.

export const QUANTIDADE_MAXIMA = 20;
export const LINHAS_MAXIMAS = 30;

/** id do item (ou chave de uma montagem) -> quantidade (sempre de 1 a 20; item com 0 sai do carrinho). */
export type Carrinho = Record<string, number>;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Uma pizza/açaí montado entra no carrinho com a própria montagem como chave: m|produto|tamanho|escolhas|adicionais
// (a mesma regra de CHAVE_DE_MONTAGEM em montaveis.ts; o teste confere que as duas concordam)
const U = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const L = `(?:${U}(?:,${U})*)?`;
const CHAVE_MONTADA = new RegExp(`^m\\|${U}\\|${U}\\|${L}\\|${L}$`, "i");

export function definirQuantidade(carrinho: Carrinho, itemId: string, quantidade: number): Carrinho {
  const q = Number.isFinite(quantidade) ? Math.min(QUANTIDADE_MAXIMA, Math.floor(quantidade)) : 0;
  const { [itemId]: _antes, ...resto } = carrinho;
  void _antes;
  if (q <= 0) return resto;
  // item novo com o carrinho já cheio de linhas: ignora
  if (!(itemId in carrinho) && Object.keys(carrinho).length >= LINHAS_MAXIMAS) return carrinho;
  return { ...resto, [itemId]: q };
}

/** Lê o que estava guardado; qualquer coisa estranha (texto quebrado, id falso, quantidade absurda) é descartada. */
export function lerCarrinho(texto: string | null | undefined): Carrinho {
  if (!texto) return {};
  try {
    const bruto: unknown = JSON.parse(texto);
    if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};
    const limpo: Carrinho = {};
    for (const [id, q] of Object.entries(bruto as Record<string, unknown>)) {
      if (Object.keys(limpo).length >= LINHAS_MAXIMAS) break;
      if ((ID.test(id) || CHAVE_MONTADA.test(id)) && typeof q === "number" && Number.isInteger(q) && q >= 1 && q <= QUANTIDADE_MAXIMA) limpo[id] = q;
    }
    return limpo;
  } catch {
    return {};
  }
}

export function totalDeUnidades(carrinho: Carrinho): number {
  return Object.values(carrinho).reduce((soma, q) => soma + q, 0);
}

interface ItemDoCardapio {
  id: string;
  nome: string;
  preco: number | null;
}

export interface LinhaDoCarrinho {
  itemId: string;
  nome: string;
  preco: number | null;
  quantidade: number;
}

/** Junta o carrinho com o cardápio de agora: item que saiu do cardápio ou ficou indisponível some do pedido. */
export function linhasDoCarrinho(carrinho: Carrinho, disponiveis: readonly ItemDoCardapio[]): LinhaDoCarrinho[] {
  return disponiveis
    .filter((i) => carrinho[i.id] > 0)
    .map((i) => ({ itemId: i.id, nome: i.nome, preco: i.preco, quantidade: carrinho[i.id] }));
}

/** O que vai para a função `criar_pedido` do banco: só id e quantidade (o preço nunca sai daqui). */
export function itensParaEnviar(linhas: readonly LinhaDoCarrinho[]): { item_id: string; quantidade: number }[] {
  return linhas.map((l) => ({ item_id: l.itemId, quantidade: l.quantidade }));
}

export const PREFIXO_DO_CARRINHO = "sabor-local:carrinho:";
export const chaveDoCarrinho = (vendedorId: string) => `${PREFIXO_DO_CARRINHO}${vendedorId}`;

export interface CarrinhoPendente {
  vendedorId: string;
  /** Total de unidades no carrinho. */
  unidades: number;
}

/**
 * Carrinhos que ficaram guardados no navegador (um por loja), a partir de todas as entradas do armazenamento
 * (chave, texto). Ignora o que não é carrinho, o que está estragado e o carrinho vazio. Loja em ordem estável.
 */
export function carrinhosPendentes(entradas: readonly (readonly [string, string | null])[]): CarrinhoPendente[] {
  const lista: CarrinhoPendente[] = [];
  for (const [chave, guardado] of entradas) {
    if (!chave.startsWith(PREFIXO_DO_CARRINHO)) continue;
    const vendedorId = chave.slice(PREFIXO_DO_CARRINHO.length);
    if (!ID.test(vendedorId)) continue;
    const unidades = totalDeUnidades(lerCarrinho(guardado));
    if (unidades > 0) lista.push({ vendedorId: vendedorId.toLowerCase(), unidades });
  }
  return lista.sort((a, b) => a.vendedorId.localeCompare(b.vendedorId));
}
