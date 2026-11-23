import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { escolherCidade } from "@/lib/cidades-util";
import type { Cidade } from "@/lib/types";

export const COOKIE_CIDADE = "cidade";

const CIDADE_MOCK: Cidade = { id: "cidade-mock", nome: "Cidade piloto", uf: null, slug: "cidade-piloto" };

export async function listarCidades(): Promise<Cidade[]> {
  if (!isSupabaseConfigured()) return [CIDADE_MOCK];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cidades")
    .select("id, nome, uf, slug")
    .eq("ativa", true)
    .order("created_at") // a primeira (mais antiga) é a cidade padrão da página inicial
    .order("nome");

  if (error) {
    console.error("Erro ao listar cidades:", error.message);
    return [];
  }
  return data ?? [];
}

/** Cidade a exibir na página inicial (URL > cookie > primeira) e a lista para o seletor. */
export async function resolverCidade(slugDaUrl?: string) {
  const cidades = await listarCidades();
  const lembrada = (await cookies()).get(COOKIE_CIDADE)?.value;
  return { cidade: escolherCidade(cidades, slugDaUrl, lembrada), cidades };
}
