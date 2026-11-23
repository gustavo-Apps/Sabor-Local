"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MOTIVOS = [
  ["informacao_falsa", "Informação falsa (horário, preço, endereço)"],
  ["conteudo_improprio", "Conteúdo impróprio"],
  ["golpe", "Suspeita de golpe"],
  ["avaliacao_falsa", "Avaliação falsa"],
  ["outro", "Outro motivo"],
] as const;

interface Props {
  vendedorId: string;
  avaliacaoId?: string;
  rotulo?: string;
}

export function DenunciaForm({ vendedorId, avaliacaoId, rotulo = "Denunciar" }: Props) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState<string>(avaliacaoId ? "avaliacao_falsa" : "informacao_falsa");
  const [descricao, setDescricao] = useState("");
  const [contato, setContato] = useState("");
  const [limite, setLimite] = useState(false);
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado" | "erro">("idle");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    const { error } = await createClient().rpc("enviar_denuncia", {
      p_vendedor: vendedorId,
      p_avaliacao: avaliacaoId ?? null,
      p_motivo: motivo,
      p_descricao: descricao,
      p_contato: contato,
    });
    setLimite(Boolean(error?.message.includes("muitas_denuncias")));
    setEstado(error ? "erro" : "enviado");
  }

  if (estado === "enviado") {
    return <p className="mt-2 text-xs text-green-700">Denúncia enviada. Obrigado por avisar!</p>;
  }

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="text-xs text-zinc-500 underline hover:text-zinc-800">
        {rotulo}
      </button>
    );
  }

  return (
    <form onSubmit={enviar} className="mt-2 space-y-2 rounded-xl border border-black/10 bg-white p-3 text-sm">
      <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full rounded-lg border border-black/10 px-2 py-1.5">
        {MOTIVOS.map(([valor, nome]) => (
          <option key={valor} value={valor}>{nome}</option>
        ))}
      </select>
      <textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Conte o que aconteceu (opcional)"
        className="w-full rounded-lg border border-black/10 px-2 py-1.5"
      />
      <input
        value={contato}
        onChange={(e) => setContato(e.target.value)}
        maxLength={100}
        placeholder="Seu WhatsApp ou e-mail (opcional, só a equipe vê)"
        className="w-full rounded-lg border border-black/10 px-2 py-1.5"
      />
      {estado === "erro" && <p className="text-xs text-red-600">{limite ? "Você enviou muitas denúncias seguidas. Tente de novo mais tarde." : "Não foi possível enviar agora. Tente novamente."}</p>}
      <div className="flex gap-3">
        <button disabled={estado === "enviando"} className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
          {estado === "enviando" ? "Enviando..." : "Enviar denúncia"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="text-xs text-zinc-500 underline">
          Cancelar
        </button>
      </div>
    </form>
  );
}
