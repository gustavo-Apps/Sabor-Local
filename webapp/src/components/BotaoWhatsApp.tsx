"use client";

import { registrarEvento } from "@/components/Rastreio";

export function BotaoWhatsApp({ href, vendedorId, secundario = false }: { href: string; vendedorId: string; secundario?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => registrarEvento("whatsapp", vendedorId)}
      className={`inline-block rounded-full px-6 py-3 font-semibold ${
        secundario
          ? "border border-green-600 bg-white text-green-700 hover:bg-green-50"
          : "bg-green-600 text-white hover:bg-green-700"
      }`}
    >
      {secundario ? "Ou pedir pelo WhatsApp" : "Pedir pelo WhatsApp"}
    </a>
  );
}
