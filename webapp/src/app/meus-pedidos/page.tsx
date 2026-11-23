import type { Metadata } from "next";
import { MeusPedidos } from "@/components/MeusPedidos";

// A lista mora no navegador de cada pessoa; a página em si não tem nada para indexar.
export const metadata: Metadata = { title: "Meus pedidos", robots: { index: false, follow: false } };

export default function MeusPedidosPage() {
  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <h1 className="font-serif text-2xl font-bold">Meus pedidos</h1>
      <p className="mt-1 text-sm text-zinc-600">Os pedidos que você fez neste aparelho e os que ficaram pela metade.</p>
      <div className="mt-6">
        <MeusPedidos />
      </div>
    </div>
  );
}
