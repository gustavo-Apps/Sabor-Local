"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_LADO = 1000;

// Reduz a foto do celular (vários MB) para ~1000px antes de enviar.
async function comprimir(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("falha ao comprimir"))), "image/jpeg", 0.8),
  );
}

interface Props {
  itemId: string;
  userId: string;
  fotoAtual: string | null;
}

export function ItemFoto({ itemId, userId, fotoAtual }: Props) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro(null);
    if (!arquivo.type.startsWith("image/")) return setErro("Escolha uma foto.");

    setEnviando(true);
    try {
      const blob = await comprimir(arquivo);
      const supabase = createClient();
      const caminho = `${userId}/item-${itemId}-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("cardapios")
        .upload(caminho, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      const { data } = supabase.storage.from("cardapios").getPublicUrl(caminho);
      const { error: erroSalvar } = await supabase
        .from("itens_cardapio")
        .update({ foto_url: data.publicUrl })
        .eq("id", itemId);
      if (erroSalvar) throw erroSalvar;
      router.refresh();
    } catch {
      setErro("Não foi possível enviar a foto.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {fotoAtual ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fotoAtual} alt="" className="h-14 w-14 rounded-lg object-cover" />
      ) : (
        <div className="grid h-14 w-14 place-items-center rounded-lg bg-zinc-100 text-xl">🍽️</div>
      )}
      <label className="cursor-pointer text-xs font-semibold text-orange-600 underline">
        {enviando ? "Enviando..." : fotoAtual ? "Trocar foto" : "Adicionar foto"}
        <input type="file" accept="image/*" onChange={escolher} disabled={enviando} className="sr-only" />
      </label>
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </div>
  );
}
