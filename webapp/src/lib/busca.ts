// Busca do catálogo e do menu: sem acento, sem diferença de maiúsculas, todas as palavras precisam aparecer.
// Sem dependências, para rodar no navegador, no servidor e nos testes.

export type ModoBusca = "tudo" | "loja" | "produto";

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "pastel de carne" casa com "Pastel Carne com queijo": cada palavra da busca precisa estar no texto. */
export function casaComBusca(texto: string, busca: string): boolean {
  const palavras = normalizar(busca).split(" ").filter(Boolean);
  if (palavras.length === 0) return true;
  const alvo = normalizar(texto);
  return palavras.every((p) => alvo.includes(p));
}

interface ItemBuscavel {
  nome: string;
  descricao?: string | null;
}

export function itemCasa(item: ItemBuscavel, busca: string): boolean {
  return casaComBusca(`${item.nome} ${item.descricao ?? ""}`, busca);
}

export function itensQueCasam<T extends ItemBuscavel>(itens: T[], busca: string): T[] {
  return itens.filter((i) => itemCasa(i, busca));
}

interface LojaBuscavel {
  nome: string;
  descricao?: string | null;
  itens_cardapio?: ItemBuscavel[];
}

/** O que a loja precisa ter para aparecer: o nome (modo "loja"), algum item do menu (modo "produto") ou qualquer um dos dois. */
export function lojaCasa(loja: LojaBuscavel, busca: string, modo: ModoBusca): boolean {
  if (!normalizar(busca)) return true;
  const noNome = casaComBusca(`${loja.nome} ${loja.descricao ?? ""}`, busca);
  const noMenu = (loja.itens_cardapio ?? []).some((i) => itemCasa(i, busca));
  if (modo === "loja") return casaComBusca(loja.nome, busca);
  if (modo === "produto") return noMenu;
  return noNome || noMenu;
}

interface ItemDaBusca extends ItemBuscavel {
  categoria?: { chave: string } | null;
}

export interface ResultadoDaLoja<T> {
  passa: boolean;
  /** Os produtos que bateram (com a busca e/ou a categoria), para mostrar no cartão da loja. Vazio quando só o nome bateu. */
  itens: T[];
}

/**
 * Busca do catálogo para uma loja, com o filtro opcional de tipo de produto (a categoria que o vendedor escolheu no menu).
 *  - Sem categoria: igual a `lojaCasa`; mostra os itens que bateram quando a busca é por produto.
 *  - Com categoria: a loja só passa se tiver produto nessa categoria, e a busca de texto vale para os produtos
 *    (o mesmo item precisa bater com o texto e estar na categoria). No modo "Nome da loja", o texto vale para o nome.
 */
export function buscarNaLoja<T extends ItemDaBusca>(
  loja: { nome: string; descricao?: string | null; itens_cardapio?: T[] },
  busca: string,
  modo: ModoBusca,
  categoriaChave: string,
): ResultadoDaLoja<T> {
  const itens = loja.itens_cardapio ?? [];
  const temTexto = Boolean(normalizar(busca));

  if (!categoriaChave) {
    return {
      passa: lojaCasa(loja, busca, modo),
      itens: temTexto && modo !== "loja" ? itensQueCasam(itens, busca) : [],
    };
  }

  const daCategoria = itens.filter((i) => i.categoria?.chave === categoriaChave);
  if (daCategoria.length === 0) return { passa: false, itens: [] };
  if (!temTexto) return { passa: true, itens: daCategoria };
  if (modo === "loja") return { passa: casaComBusca(loja.nome, busca), itens: daCategoria };

  const casados = itensQueCasam(daCategoria, busca);
  if (casados.length > 0) return { passa: true, itens: casados };
  // "Tudo": o texto também pode ser o nome da loja ("Esquina" + Bebidas mostra as bebidas da Esquina)
  if (modo === "tudo" && casaComBusca(`${loja.nome} ${loja.descricao ?? ""}`, busca)) return { passa: true, itens: daCategoria };
  return { passa: false, itens: [] };
}
