"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { origemValida } from "@/lib/compartilhar";

type Tipo = "visita_site" | "visita_vendedor" | "whatsapp" | "link_pedido" | "pedir_item";

export function registrarEvento(tipo: Tipo, vendedorId?: string, origem?: string | null, itemId?: string) {
  try {
    void createClient()
      .rpc("registrar_evento", {
        p_tipo: tipo,
        p_vendedor: vendedorId ?? null,
        p_origem: origemValida(origem),
        ...(itemId ? { p_item: itemId } : {}),
      })
      .then(() => undefined);
  } catch {
    // métrica nunca pode atrapalhar o uso do site
  }
}

// Conta uma visita por aba/sessão (recarregar a página não infla o número).
export function Rastreio({
  tipo,
  vendedorId,
  ignorar = false,
}: {
  tipo: "visita_site" | "visita_vendedor";
  vendedorId?: string;
  /** Dono olhando a própria loja: não conta (o banco também descarta). */
  ignorar?: boolean;
}) {
  useEffect(() => {
    if (ignorar) return;
    const chave = `rastreio:${tipo}:${vendedorId ?? ""}`;
    try {
      if (sessionStorage.getItem(chave)) return;
      sessionStorage.setItem(chave, "1");
    } catch {
      // sessionStorage indisponível: conta mesmo assim
    }
    // ?origem=whatsapp (link que o vendedor compartilhou): marca de onde veio a visita
    let origem: string | null = null;
    try {
      origem = new URLSearchParams(window.location.search).get("origem");
    } catch {
      // sem URL legível: conta sem origem
    }
    registrarEvento(tipo, vendedorId, tipo === "visita_vendedor" ? origem : null);
  }, [tipo, vendedorId, ignorar]);

  return null;
}
