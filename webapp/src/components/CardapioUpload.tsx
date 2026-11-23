"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TIPOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX = 5 * 1024 * 1024;

interface Props {
  vendedorId: string;
  userId: string;
  urlAtual: string | null;
  tipoAtual: string | null;
}

export function CardapioUpload({ vendedorId, userId, urlAtual, tipoAtual }: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState<"idle" | "enviando">("idle");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro(null);

    if (!TIPOS.includes(arquivo.type)) return setErro("Envie um PDF ou uma foto (JPG, PNG).");
    if (arquivo.size > MAX) return setErro("O arquivo é grande demais. O limite é 5 MB.");

    setEstado("enviando");
    const supabase = createClient();
    const extensao = arquivo.type === "application/pdf" ? "pdf" : arquivo.type.split("/")[1];
    const caminho = `${userId}/cardapio-${Date.now()}.${extensao}`;

    const { error: erroUpload } = await supabase.storage.from("cardapios").upload(caminho, arquivo);
    if (erroUpload) {
      setEstado("idle");
      return setErro("Não foi possível enviar o arquivo. Tente novamente.");
    }

    const { data } = supabase.storage.from("cardapios").getPublicUrl(caminho);
    const { error: erroSalvar } = await supabase
      .from("vendedores")
      .update({ cardapio_url: data.publicUrl, cardapio_tipo: arquivo.type })
      .eq("id", vendedorId);

    setEstado("idle");
    if (erroSalvar) return setErro("O arquivo subiu, mas não foi possível salvar. Tente novamente.");
    router.refresh();
  }

  async function remover() {
    const { error } = await createClient()
      .from("vendedores")
      .update({ cardapio_url: null, cardapio_tipo: null })
      .eq("id", vendedorId);
    if (error) return setErro("Não foi possível remover agora.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {urlAtual ? (
        <div className="rounded-xl bg-green-50 p-4 text-sm text-green-800">
          <p className="font-semibold">Seu cardápio está no ar.</p>
          <div className="mt-2 flex gap-4">
            <a href={urlAtual} target="_blank" rel="noopener noreferrer" className="underline">
              Ver {tipoAtual === "application/pdf" ? "PDF" : "foto"}
            </a>
            <button type="button" onClick={remover} className="text-red-600 underline">
              Remover
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-600">Você ainda não enviou o cardápio.</p>
      )}

      <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 p-6 text-center text-sm hover:bg-orange-100">
        <span className="font-semibold">
          {estado === "enviando" ? "Enviando..." : urlAtual ? "Trocar o arquivo" : "Escolher arquivo do cardápio"}
        </span>
        <span className="mt-1 block text-xs text-zinc-600">PDF ou foto, até 5 MB</span>
        <input
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          onChange={enviar}
          disabled={estado === "enviando"}
          className="sr-only"
        />
      </label>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}
