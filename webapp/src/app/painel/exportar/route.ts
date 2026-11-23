import { NextResponse } from "next/server";
import { prepararExportacao } from "@/lib/exportacao";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Baixa os dados do vendedor logado (direito de acesso da LGPD). Quem não está logado vai para o login.
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.redirect(new URL("/", request.url));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data, error } = await supabase.rpc("exportar_meus_dados");
  const arquivo = error ? null : prepararExportacao(data);
  if (!arquivo || !arquivo.ok) {
    return new Response("Não foi possível gerar o arquivo agora. Tente de novo em instantes.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  return new Response(arquivo.corpo, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${arquivo.nome}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
