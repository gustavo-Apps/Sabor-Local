"use client";

import { useState } from "react";
import { linkFacebook, linkWhatsApp } from "@/lib/compartilhar";
import { validarMensagemCompartilhar } from "@/lib/validacao";
import { ImprimirBotao } from "@/components/ImprimirBotao";

interface Props {
  nome: string;
  mensagemInicial: string;
  /** Endereço do perfil com a origem de cada canal já marcada. */
  links: { whatsapp: string; facebook: string; instagram: string; link: string; qr: string };
  qrSvg: string;
}

const botao = "rounded-full px-5 py-3 text-sm font-semibold text-center";

// Botões grandes para divulgar o perfil em poucos toques, pelo celular. Cada canal usa um link com a sua origem,
// e assim a aba mostra de onde vêm as visitas.
export function CompartilharPainel({ nome, mensagemInicial, links, qrSvg }: Props) {
  const [mensagem, setMensagem] = useState(mensagemInicial);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  function mensagemOk(): string | null {
    const v = validarMensagemCompartilhar(mensagem);
    if (!v.ok) {
      setErro(v.erro);
      return null;
    }
    setErro("");
    return v.valor;
  }

  function abrir(montar: (texto: string) => string) {
    const texto = mensagemOk();
    if (texto) window.open(montar(texto), "_blank", "noopener,noreferrer");
  }

  async function copiar(url: string, rotulo: string) {
    try {
      await navigator.clipboard.writeText(url);
      setAviso(`${rotulo}: link copiado!`);
    } catch {
      setAviso("Não foi possível copiar. Segure o link abaixo e copie.");
    }
  }

  async function compartilhar() {
    const texto = mensagemOk();
    if (!texto) return;
    try {
      await navigator.share({ title: nome, text: texto, url: links.link });
    } catch {
      // quem cancela o menu do celular não precisa de aviso
    }
  }

  function baixarQr() {
    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr-${nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "perfil"}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const podeCompartilhar = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-black/10 bg-white p-6">
        <h2 className="font-serif text-lg font-bold">Divulgue seu perfil</h2>
        <p className="mt-1 text-sm text-zinc-600">Escolha onde compartilhar. A mensagem abaixo vai junto com o link.</p>

        <label className="mt-4 block text-sm font-medium" htmlFor="msg-compartilhar">
          Mensagem
        </label>
        <textarea
          id="msg-compartilhar"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          maxLength={200}
          rows={3}
          className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-base"
        />
        <p className="mt-1 text-right text-xs text-zinc-500">{mensagem.trim().length}/200</p>
        {erro && (
          <p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {erro}
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => abrir((t) => linkWhatsApp(t, links.whatsapp))} className={`${botao} bg-green-600 text-white hover:bg-green-700`}>
            Enviar pelo WhatsApp
          </button>
          <button type="button" onClick={() => window.open(linkFacebook(links.facebook), "_blank", "noopener,noreferrer")} className={`${botao} bg-blue-600 text-white hover:bg-blue-700`}>
            Publicar no Facebook
          </button>
          {podeCompartilhar && (
            <button type="button" onClick={compartilhar} className={`${botao} bg-zinc-900 text-white`}>
              Outros aplicativos…
            </button>
          )}
          <button type="button" onClick={() => copiar(links.instagram, "Instagram")} className={`${botao} border border-zinc-300 bg-white`}>
            Copiar link para o Instagram
          </button>
          <button type="button" onClick={() => copiar(links.link, "Link")} className={`${botao} border border-zinc-300 bg-white`}>
            Copiar link
          </button>
        </div>

        <p role="status" className="mt-3 min-h-5 text-sm text-green-700">
          {aviso}
        </p>
        <p className="break-all text-xs text-zinc-500">{links.link}</p>
        <p className="mt-2 text-xs text-zinc-500">
          No Instagram, cole o link na bio ou no adesivo de link dos stories: o site não consegue publicar por você.
        </p>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-6 text-center">
        <h2 className="font-serif text-lg font-bold">QR Code do seu perfil</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Imprima e cole no balcão ou na embalagem. O cliente aponta a câmera e abre seu perfil.
        </p>
        <div className="mx-auto mt-4 w-56" role="img" aria-label={`QR Code do perfil de ${nome}`} dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="mt-3 flex flex-wrap justify-center gap-2 print:hidden">
          <ImprimirBotao />
          <button type="button" onClick={baixarQr} className="rounded-full border border-zinc-900 px-4 py-1.5 text-xs font-semibold hover:bg-zinc-900 hover:text-white">
            Baixar o QR code
          </button>
        </div>
      </section>
    </div>
  );
}
