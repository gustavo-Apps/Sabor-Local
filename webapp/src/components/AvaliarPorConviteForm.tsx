"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MENSAGENS_AVALIACAO, NOME_AVALIADOR_MAX, validarAvaliacao, validarNomeDoAvaliador } from "@/lib/validacao";

const campo = "mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-base";

// Formulário aberto pelo link do e-mail. O link é o código: ele nunca passa pelo vendedor.
export function AvaliarPorConviteForm({
  token,
  nomeDaLoja,
  moderada = true,
  origem = "convite",
}: {
  token: string;
  nomeDaLoja: string;
  /** "convite" = link recebido por e-mail; "pedido" = link de acompanhamento de um pedido concluído pelo site. */
  origem?: "convite" | "pedido";
  /** A avaliação passa por conferência da equipe antes de aparecer? Muda só o texto de confirmação. */
  moderada?: boolean;
}) {
  const [nota, setNota] = useState(5);
  const [comentario, setComentario] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado">("idle");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const v = validarAvaliacao({ nota, comentario });
    if (!v.ok) return setErro(v.erro);
    const n = validarNomeDoAvaliador(nome);
    if (!n.ok) return setErro(n.erro);

    setEstado("enviando");
    const { data, error } = await createClient().rpc(origem === "pedido" ? "avaliar_por_pedido" : "avaliar_por_convite", {
      p_token: token,
      p_nota: v.valor.nota,
      p_comentario: v.valor.comentario ?? "",
      p_nome: n.valor,
    });
    const resultado = String(data);
    if (error || resultado !== "ok") {
      setEstado("idle");
      setErro(MENSAGENS_AVALIACAO[resultado] ?? "Não foi possível enviar sua avaliação agora. Tente novamente.");
      return;
    }
    setEstado("enviado");
  }

  if (estado === "enviado") {
    return (
      <p role="status" className="rounded-2xl bg-green-50 p-5 text-sm text-green-700">
        Obrigado! Sua avaliação da {nomeDaLoja} foi enviada{" "}
        {moderada ? "e entra no ar depois de uma breve conferência da equipe." : "e já aparece no perfil da loja."}
      </p>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4 rounded-2xl border border-black/10 bg-white p-5">
      <div>
        <label htmlFor="av-nome" className="block text-sm font-medium">
          Seu nome <span className="font-normal text-zinc-500">(opcional)</span>
        </label>
        <input
          id="av-nome"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={NOME_AVALIADOR_MAX}
          autoComplete="given-name"
          placeholder="Como quer aparecer? Deixe em branco para ficar anônimo"
          className={campo}
        />
        <p className="mt-1 text-xs text-zinc-500">Aparece junto da sua avaliação, para todo mundo. Pode usar só o primeiro nome ou um apelido.</p>
      </div>

      <div>
        <label htmlFor="av-nota" className="block text-sm font-medium">Sua nota</label>
        <select id="av-nota" value={nota} onChange={(e) => setNota(Number(e.target.value))} className={campo}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} estrela{n > 1 ? "s" : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="av-comentario" className="block text-sm font-medium">
          Comentário <span className="font-normal text-zinc-500">(opcional)</span>
        </label>
        <textarea
          id="av-comentario"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Como foi o pedido? Evite colocar telefone ou endereço."
          className={campo}
        />
        <p className="mt-1 text-right text-xs text-zinc-500">{comentario.trim().length}/500</p>
      </div>

      {erro && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      <button
        disabled={estado === "enviando"}
        className="rounded-full bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {estado === "enviando" ? "Enviando..." : "Enviar avaliação"}
      </button>
    </form>
  );
}
