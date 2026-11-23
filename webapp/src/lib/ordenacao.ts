// Ordem do catálogo: quem tem destaque ativo aparece primeiro (plano destaque),
// depois quem está aberto agora e, por fim, ordem alfabética.
// Função pura (sem imports) para ser testada em tests/unit.

export function emDestaque(v: { destaque_ate?: string | null }, agora: number = Date.now()): boolean {
  return Boolean(v.destaque_ate) && new Date(v.destaque_ate as string).getTime() > agora;
}

export function ordenarPorPrioridade<T extends { nome: string; destaque_ate?: string | null }>(
  lista: T[],
  agora: number,
  aberto: (v: T) => boolean,
): T[] {
  const peso = (v: T) => (emDestaque(v, agora) ? 2 : 0) + (aberto(v) ? 1 : 0);
  return [...lista].sort((a, b) => peso(b) - peso(a) || a.nome.localeCompare(b.nome, "pt-BR"));
}
