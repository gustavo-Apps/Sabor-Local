"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { calcularRecorte, caminhoNoBucket, erroDoArquivo, erroDoRecorte, IMAGENS, type TipoImagem } from "@/lib/imagem";

interface Props {
  tipo: TipoImagem;
  vendedorId: string;
  userId: string;
  urlAtual: string | null;
}

const COLUNA: Record<TipoImagem, "logo_url" | "banner_url"> = { logo: "logo_url", banner: "banner_url" };

const TEXTOS: Record<TipoImagem, { titulo: string; dica: string }> = {
  logo: { titulo: "Logo", dica: "Quadrada. Aparece no catálogo e no topo do seu perfil. A foto é cortada ao centro." },
  banner: { titulo: "Banner", dica: "Faixa larga no topo do seu perfil. A foto é cortada ao centro." },
};

// Corta ao centro na proporção certa, reduz e converte para JPEG antes de enviar (foto de celular tem vários MB).
async function prepararImagem(arquivo: File, tipo: TipoImagem): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const recorte = calcularRecorte(bitmap.width, bitmap.height, tipo);
  const erro = erroDoRecorte(recorte, tipo);
  if (erro) throw new Error(erro);

  const destino = IMAGENS[tipo];
  const escala = Math.min(1, destino.largura / recorte.largura);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(recorte.largura * escala);
  canvas.height = Math.round(recorte.altura * escala);
  canvas
    .getContext("2d")!
    .drawImage(bitmap, recorte.x, recorte.y, recorte.largura, recorte.altura, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("falha ao converter"))), "image/jpeg", 0.85),
  );
}

export function ImagemPerfil({ tipo, vendedorId, userId, urlAtual }: Props) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { titulo, dica } = TEXTOS[tipo];

  // Apagar o arquivo antigo é só faxina: se falhar, a imagem nova já está no ar.
  async function apagarArquivo(url: string | null) {
    const caminho = caminhoNoBucket(url);
    if (caminho && caminho.startsWith(`${userId}/`)) {
      await createClient().storage.from("cardapios").remove([caminho]);
    }
  }

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setErro(null);

    const problema = erroDoArquivo(arquivo);
    if (problema) return setErro(problema);

    setOcupado(true);
    try {
      const blob = await prepararImagem(arquivo, tipo);
      const supabase = createClient();
      const caminho = `${userId}/${tipo}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("cardapios").upload(caminho, blob, { contentType: "image/jpeg" });
      if (error) throw error;

      const { data } = supabase.storage.from("cardapios").getPublicUrl(caminho);
      const { error: erroSalvar } = await supabase
        .from("vendedores")
        .update({ [COLUNA[tipo]]: data.publicUrl })
        .eq("id", vendedorId);
      if (erroSalvar) {
        await supabase.storage.from("cardapios").remove([caminho]);
        throw erroSalvar;
      }
      await apagarArquivo(urlAtual);
      router.refresh();
    } catch (falha) {
      const tamanho = falha instanceof Error && falha.message.includes("pequena demais");
      setErro(tamanho ? (falha as Error).message : "Não foi possível enviar a imagem. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  async function remover() {
    setErro(null);
    setOcupado(true);
    const { error } = await createClient()
      .from("vendedores")
      .update({ [COLUNA[tipo]]: null })
      .eq("id", vendedorId);
    if (error) {
      setOcupado(false);
      return setErro("Não foi possível remover agora.");
    }
    await apagarArquivo(urlAtual);
    setOcupado(false);
    router.refresh();
  }

  const quadrada = tipo === "logo";

  return (
    <div>
      <p className="text-sm font-medium">{titulo}</p>
      <p className="text-xs text-zinc-600">{dica}</p>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <div
          className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-zinc-100 text-xs text-zinc-500 ${
            quadrada ? "aspect-square w-24" : "aspect-[3/1] w-full max-w-md"
          }`}
        >
          {urlAtual ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlAtual} alt={`${titulo} atual`} className="h-full w-full object-cover" />
          ) : (
            <span>Sem {titulo.toLowerCase()}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-full border border-zinc-900 px-4 py-2 text-sm font-semibold hover:bg-zinc-900 hover:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-orange-400">
            {ocupado ? "Enviando..." : urlAtual ? `Trocar ${titulo.toLowerCase()}` : `Escolher ${titulo.toLowerCase()}`}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={escolher}
              disabled={ocupado}
              className="sr-only"
            />
          </label>
          {urlAtual && (
            <button type="button" onClick={remover} disabled={ocupado} className="text-sm text-red-600 underline disabled:opacity-60">
              Remover
            </button>
          )}
        </div>
      </div>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {erro}
        </p>
      )}
    </div>
  );
}
