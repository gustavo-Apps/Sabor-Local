// Escolha da cidade exibida. Função pura (sem imports) para ser testada em tests/unit.

export interface CidadeBasica {
  slug: string;
}

/**
 * Ordem de preferência: cidade pedida na URL (?cidade=), depois a lembrada no cookie,
 * depois a primeira da lista, que quem chama deve entregar ordenada da mais antiga para a mais nova
 * (assim abrir uma cidade nova nunca troca a página inicial de quem já usa o site).
 * Slug desconhecido é ignorado, nunca erro.
 */
export function escolherCidade<T extends CidadeBasica>(
  cidades: T[],
  daUrl?: string | null,
  doCookie?: string | null,
): T | null {
  if (cidades.length === 0) return null;
  for (const slug of [daUrl, doCookie]) {
    const achada = slug ? cidades.find((c) => c.slug === slug) : undefined;
    if (achada) return achada;
  }
  return cidades[0];
}
