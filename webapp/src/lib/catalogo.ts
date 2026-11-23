import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { VENDEDORES_MOCK } from "@/lib/mock-data";
import type { Bairro, Categoria } from "@/lib/types";

export async function listarCategorias(): Promise<Categoria[]> {
  if (!isSupabaseConfigured()) {
    return uniqueBy(
      VENDEDORES_MOCK.flatMap((v) => v.categorias),
      (c) => c.id,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("categorias").select("*").order("nome");
  if (error) {
    console.error("Erro ao listar categorias:", error.message);
    return [];
  }
  return data ?? [];
}

export async function listarBairros(cidadeId?: string): Promise<Bairro[]> {
  if (!isSupabaseConfigured()) {
    return uniqueBy(
      VENDEDORES_MOCK.map((v) => v.bairro).filter((b): b is Bairro => Boolean(b)),
      (b) => b.id,
    );
  }

  const supabase = await createClient();
  let consulta = supabase.from("bairros").select("*").order("nome");
  if (cidadeId) consulta = consulta.eq("cidade_id", cidadeId);
  const { data, error } = await consulta;
  if (error) {
    console.error("Erro ao listar bairros:", error.message);
    return [];
  }
  return data ?? [];
}

function uniqueBy<T, K>(items: T[], key: (item: T) => K): T[] {
  const seen = new Set<K>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
