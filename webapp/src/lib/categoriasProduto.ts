// Categorias de produto (opcionais, de cada vendedor): agrupar o menu da loja e montar o filtro do catálogo.
// Sem imports e sem dependências, para rodar no navegador, no servidor e nos testes.

/** Nomes comuns oferecidos como atalho. Usar o mesmo nome entre lojas faz o filtro do catálogo juntar os produtos. */
export const SUGESTOES_DE_CATEGORIA = [
  "Bebidas",
  "Salgados",
  "Doces",
  "Lanches",
  "Xis",
  "Cachorro quente",
  "Pizzas",
  "Porções",
  "Sobremesas",
  "Marmitas",
] as const;

export const MAX_CATEGORIAS_POR_LOJA = 15;

export interface CategoriaDeProduto {
  id: string;
  nome: string;
  /** Nome sem acento, maiúsculas, pontuação e plural simples; calculada no banco ("Bebidas" e "bebida" têm a mesma). */
  chave: string;
  ordem?: number;
}

interface ItemComCategoria {
  categoria?: { chave: string } | null;
}

interface LojaComMenu {
  categorias_produto?: CategoriaDeProduto[];
  itens_cardapio?: (ItemComCategoria & { categoria?: CategoriaDeProduto | null })[];
}

export interface OpcaoDeCategoria {
  chave: string;
  nome: string;
  /** Em quantas lojas há produto nessa categoria. */
  lojas: number;
}

/**
 * Opções do filtro "Tipo de produto" do catálogo: cada categoria que alguma loja usa em algum item, juntando as que têm a
 * mesma chave. O nome mostrado é o mais usado (empate: ordem alfabética). Primeiro as presentes em mais lojas.
 */
export function opcoesDeCategoria(lojas: readonly LojaComMenu[]): OpcaoDeCategoria[] {
  const porChave = new Map<string, { lojas: number; nomes: Map<string, number> }>();
  for (const loja of lojas) {
    const vistas = new Set<string>();
    for (const item of loja.itens_cardapio ?? []) {
      const c = item.categoria;
      if (!c?.chave) continue;
      const atual = porChave.get(c.chave) ?? { lojas: 0, nomes: new Map<string, number>() };
      atual.nomes.set(c.nome, (atual.nomes.get(c.nome) ?? 0) + 1);
      if (!vistas.has(c.chave)) {
        vistas.add(c.chave);
        atual.lojas += 1;
      }
      porChave.set(c.chave, atual);
    }
  }
  return [...porChave.entries()]
    .map(([chave, { lojas: n, nomes }]) => ({
      chave,
      lojas: n,
      nome: [...nomes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))[0][0],
    }))
    .sort((a, b) => b.lojas - a.lojas || a.nome.localeCompare(b.nome, "pt-BR"));
}

export interface SecaoDoMenu<T> {
  /** Nulo = itens sem categoria ("Outros", quando a loja usa categorias). */
  categoria: CategoriaDeProduto | null;
  itens: T[];
}

/**
 * Divide o menu em seções na ordem que o vendedor definiu; itens sem categoria vão para o fim. Se a loja não usa categorias
 * (nenhum item tem uma), devolve uma seção só, sem título.
 */
export function agruparPorCategoria<T extends { categoria?: CategoriaDeProduto | null }>(itens: readonly T[]): SecaoDoMenu<T>[] {
  const usam = itens.some((i) => i.categoria);
  if (!usam) return itens.length ? [{ categoria: null, itens: [...itens] }] : [];

  const secoes = new Map<string, SecaoDoMenu<T>>();
  for (const item of itens) {
    const chave = item.categoria?.chave ?? "";
    const secao = secoes.get(chave) ?? { categoria: item.categoria ?? null, itens: [] };
    secao.itens.push(item);
    secoes.set(chave, secao);
  }
  return [...secoes.values()].sort((a, b) => {
    if (!a.categoria) return 1;
    if (!b.categoria) return -1;
    return (a.categoria.ordem ?? 0) - (b.categoria.ordem ?? 0) || a.categoria.nome.localeCompare(b.categoria.nome, "pt-BR");
  });
}

/** As categorias do menu, na ordem do vendedor, só as que têm item (para os botões de filtro do perfil). */
export function categoriasEmUso<T extends { categoria?: CategoriaDeProduto | null }>(itens: readonly T[]): CategoriaDeProduto[] {
  return agruparPorCategoria(itens)
    .map((s) => s.categoria)
    .filter((c): c is CategoriaDeProduto => Boolean(c));
}
