import "server-only";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Id da loja de quem está logado (ou null: visitante, ou vendedor ainda sem perfil).
 * Só consulta o banco quando há sessão; para visitante não custa nada.
 */
export async function lojaDoUsuarioLogado(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("vendedores").select("id").eq("owner_id", user.id).maybeSingle();
    return (data?.id as string | undefined) ?? null;
  } catch {
    return null; // identificação é só um recurso a mais: nunca derruba a página
  }
}
