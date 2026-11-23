// Disponibilidade dos itens do menu ("Indisponível hoje"). Sem dependências, para rodar no servidor e nos testes.

export interface ItemComDisponibilidade {
  disponivel?: boolean;
  indisponivel_ate?: string | null; // YYYY-MM-DD
}

export type Disponibilidade = "disponivel" | "indisponivel_hoje" | "indisponivel";

export const MODOS_DISPONIBILIDADE = ["disponivel", "hoje", "sem_previsao"] as const;
export type ModoDisponibilidade = (typeof MODOS_DISPONIBILIDADE)[number];

/**
 * disponivel = false com data: indisponível até essa data (inclusive); depois dela o item volta sozinho.
 * disponivel = false sem data: indisponível até o vendedor reativar.
 */
export function disponibilidadeDoItem(item: ItemComDisponibilidade, hoje: string): Disponibilidade {
  if (item.disponivel !== false) return "disponivel";
  if (item.indisponivel_ate) return item.indisponivel_ate >= hoje ? "indisponivel_hoje" : "disponivel";
  return "indisponivel";
}

/** Texto do selo mostrado ao cliente (perfil público) e ao vendedor (painel). */
export function seloIndisponivel(estado: Disponibilidade): string | null {
  if (estado === "indisponivel_hoje") return "Indisponível hoje";
  if (estado === "indisponivel") return "Indisponível no momento";
  return null;
}

/** Colunas a gravar para cada botão do painel. */
export function camposDoModo(modo: string, hoje: string): { disponivel: boolean; indisponivel_ate: string | null } | null {
  if (modo === "disponivel") return { disponivel: true, indisponivel_ate: null };
  if (modo === "hoje") return { disponivel: false, indisponivel_ate: hoje };
  if (modo === "sem_previsao") return { disponivel: false, indisponivel_ate: null };
  return null;
}

/** Disponíveis primeiro (na ordem do vendedor); os indisponíveis vão para o fim, também na ordem dele. */
export function ordenarParaPerfil<T extends ItemComDisponibilidade & { ordem: number }>(itens: T[], hoje: string): T[] {
  const peso = (i: T) => (disponibilidadeDoItem(i, hoje) === "disponivel" ? 0 : 1);
  return [...itens].sort((a, b) => peso(a) - peso(b) || a.ordem - b.ordem);
}
