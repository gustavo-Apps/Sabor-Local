"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Recarrega os dados da página de tempos em tempos, só com a aba à vista (a loja vê pedido novo sem apertar nada).
export function AtualizarSozinho({ cadaSegundos = 30 }: { cadaSegundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, cadaSegundos * 1000);
    return () => clearInterval(id);
  }, [cadaSegundos, router]);
  return null;
}
