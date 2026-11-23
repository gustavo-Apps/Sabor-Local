import type { Metadata } from "next";
import Link from "next/link";
import { AcompanharPedido } from "@/components/AcompanharPedido";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { PedidoAcompanhado } from "@/lib/pedidos";

export const dynamic = "force-dynamic";

// O link é o segredo do cliente (quem o tem cancela e avalia o pedido): sem indexação e sem repassar o endereço
// (com o token) por "referer" a outros sites.
export const metadata: Metadata = {
  title: "Acompanhar pedido",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function AcompanharPage(props: PageProps<"/pedido/[token]">) {
  const { token } = await props.params;
  const { novo } = await props.searchParams;

  let pedido: PedidoAcompanhado | null = null;
  if (isSupabaseConfigured() && /^[0-9a-f]{64}$/.test(token)) {
    const { data } = await (await createClient()).rpc("pedido_por_token", { p_token: token });
    if ((data as { estado?: string } | null)?.estado === "ok") pedido = data as PedidoAcompanhado;
  }

  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      {pedido ? (
        <>
          <h1 className="font-serif text-2xl font-bold">Seu pedido na {pedido.loja.nome}</h1>
          <div className="mt-5">
            <AcompanharPedido pedido={pedido} token={token} recemCriado={Boolean(novo)} />
          </div>
        </>
      ) : (
        <>
          <h1 className="font-serif text-2xl font-bold">Pedido não encontrado</h1>
          <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            Não encontramos esse pedido. Confira se copiou o endereço inteiro. Se o pedido é antigo, ele pode ter saído do ar.
          </p>
          <p className="mt-6 text-sm">
            <Link href="/" className="font-semibold text-orange-600 underline">
              Ver o catálogo
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
