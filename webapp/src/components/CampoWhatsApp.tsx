"use client";

import { useState } from "react";
import { mascararWhatsApp } from "@/lib/validacao";

// Campo de WhatsApp com máscara: o usuário digita só números e vê (11) 99999-0000.
export function CampoWhatsApp({ defaultValue, className }: { defaultValue?: string; className?: string }) {
  const [valor, setValor] = useState(mascararWhatsApp(defaultValue ?? ""));

  return (
    <input
      name="whatsapp"
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      required
      placeholder="(11) 99999-0000"
      value={valor}
      onChange={(e) => setValor(mascararWhatsApp(e.target.value))}
      className={className}
    />
  );
}
