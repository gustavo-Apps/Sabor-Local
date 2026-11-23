import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Destino do link mágico: troca o código (PKCE) por uma sessão e segue para o painel.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/painel";
  const destino = next.startsWith("/") && !next.startsWith("//") ? next : "/painel";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }

  return NextResponse.redirect(`${origin}/login?erro=link`);
}
