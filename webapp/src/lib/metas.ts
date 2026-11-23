// Metas e leitura de uma cidade nova (manual de expansão). Sem dependências, para rodar no servidor e nos testes.

/** Meta de lançamento por cidade: 10 perfis completos antes de divulgar (docs/manual-de-expansao.md). */
export const META_PERFIS_COMPLETOS = 10;
/** Sinal de alerta do manual: menos de 5 vendedores ativos depois de 4 semanas. */
export const MINIMO_ATIVOS_APOS_4_SEMANAS = 5;
export const DIAS_PARA_AVALIAR = 28;

export interface ResumoCidade {
  cidade_id: string;
  nome: string;
  uf: string | null;
  slug: string;
  ativa: boolean;
  criada_em: string;
  vendedores_ativos: number;
  vendedores_pendentes: number;
  vendedores_suspensos: number;
  perfis_completos: number;
  destaques_ativos: number;
  visitas_perfis_30d: number;
  toques_whatsapp_30d: number;
  avaliacoes_publicadas: number;
}

export type SituacaoCidade = "pausada" | "pronta" | "atencao" | "montando";

export const ROTULOS_SITUACAO: Record<SituacaoCidade, string> = {
  pausada: "Pausada",
  pronta: "Pronta para divulgar",
  atencao: "Precisa de atenção",
  montando: "Montando a base",
};

/** Percentual da meta (0 a 100), sem passar de 100. */
export function progressoMeta(valor: number, meta: number): number {
  if (!Number.isFinite(valor) || !Number.isFinite(meta) || meta <= 0 || valor <= 0) return 0;
  return Math.min(100, Math.round((valor / meta) * 100));
}

/** Dias inteiros entre a criação da cidade e `agora`. Data inválida conta como 0. */
export function idadeEmDias(criadaEm: string, agora: Date = new Date()): number {
  const t = Date.parse(criadaEm);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((agora.getTime() - t) / 86_400_000));
}

/**
 * Leitura rápida de como a cidade está:
 * pausada (desativada) > pronta (10 perfis completos) > atenção (4 semanas ou mais com menos de 5 ativos) > montando.
 */
export function situacaoDaCidade(c: ResumoCidade, agora: Date = new Date()): SituacaoCidade {
  if (!c.ativa) return "pausada";
  if (c.perfis_completos >= META_PERFIS_COMPLETOS) return "pronta";
  if (idadeEmDias(c.criada_em, agora) >= DIAS_PARA_AVALIAR && c.vendedores_ativos < MINIMO_ATIVOS_APOS_4_SEMANAS) return "atencao";
  return "montando";
}
