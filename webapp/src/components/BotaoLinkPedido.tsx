"use client";

import { registrarEvento } from "@/components/Rastreio";

// Leva ao site ou cardápio online do próprio vendedor. É um link de terceiro: abre em outra aba, sem repassar a origem
// nem a reputação do Sabor Local (nofollow), e o toque é contado.
export function BotaoLinkPedido({ href, rotulo, vendedorId }: { href: string; rotulo: string; vendedorId: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      onClick={() => registrarEvento("link_pedido", vendedorId)}
      className="inline-block rounded-full bg-orange-600 px-6 py-3 font-semibold text-white hover:bg-orange-700"
    >
      {rotulo}
    </a>
  );
}
