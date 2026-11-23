import type { Metadata } from "next";
import Link from "next/link";
import { listarCategorias } from "@/lib/catalogo";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { LoginForms } from "./LoginForms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const categorias = isSupabaseConfigured() ? await listarCategorias() : [];

  return (
    <div className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
      <h1 className="font-serif text-2xl font-bold">Sou vendedor</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Divulgue seu negócio para a cidade. Só quer ver os vendedores?{" "}
        <Link href="/" className="font-semibold text-orange-600 underline">
          Sou cliente
        </Link>
      </p>
      <LoginForms categorias={categorias} erroLink={erro === "link"} />
    </div>
  );
}
