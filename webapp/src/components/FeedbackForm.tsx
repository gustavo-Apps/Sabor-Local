"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TIPOS_FEEDBACK, validarFeedback } from "@/lib/validacao";

const campo = "mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm";

// Mesmo desenho da denúncia: o navegador chama a função do banco, que valida de novo e limita por IP.
export function FeedbackForm({ pagina }: { pagina: string }) {
  const [tipo, setTipo] = useState<string>("problema");
  const [mensagem, setMensagem] = useState("");
  const [contato, setContato] = useState("");
  const [isca, setIsca] = useState("");
  const [erro, setErro] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado">("idle");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const v = validarFeedback({ tipo, mensagem, pagina, contato });
    if (!v.ok) return setErro(v.erro);

    // Campo escondido que só robôs preenchem: finge que deu certo e não envia nada.
    if (isca) return setEstado("enviado");

    setEstado("enviando");
    const { error } = await createClient().rpc("enviar_feedback", {
      p_tipo: v.valor.tipo,
      p_mensagem: v.valor.mensagem,
      p_pagina: v.valor.pagina ?? "",
      p_contato: v.valor.contato ?? "",
    });

    if (error) {
      setEstado("idle");
      const m = error.message;
      setErro(
        m.includes("muitos_feedbacks")
          ? "Você enviou várias mensagens seguidas. Tente de novo daqui a pouco."
          : m.includes("caixa_cheia")
            ? "Estamos com muitas mensagens para ler agora. Tente de novo em alguns dias."
            : "Não foi possível enviar agora. Tente novamente em instantes.",
      );
      return;
    }
    setEstado("enviado");
  }

  if (estado === "enviado") {
    return (
      <p role="status" className="rounded-2xl bg-green-50 p-5 text-sm text-green-700">
        Mensagem enviada. Obrigado por ajudar a melhorar o Sabor Local! A equipe lê tudo; nem toda sugestão vira mudança,
        mas as que valem a pena entram no planejamento.
      </p>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4 rounded-2xl border border-black/10 bg-white p-5">
      {pagina && (
        <p className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
          Você está falando sobre a página <strong className="break-all">{pagina}</strong>. O endereço vai junto com a mensagem.
        </p>
      )}
      <div>
        <label htmlFor="fb-tipo" className="block text-sm font-medium">Sobre o quê?</label>
        <select id="fb-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
          {TIPOS_FEEDBACK.map(([id, nome]) => (
            <option key={id} value={id}>{nome}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="fb-msg" className="block text-sm font-medium">Conte o que aconteceu</label>
        <textarea
          id="fb-msg"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          maxLength={1000}
          rows={5}
          placeholder="Descreva com calma: o que você tentou fazer e o que aconteceu."
          className={campo}
        />
        <p className="mt-1 text-right text-xs text-zinc-500">{mensagem.trim().length}/1000</p>
      </div>

      <div>
        <label htmlFor="fb-contato" className="block text-sm font-medium">
          Seu WhatsApp ou e-mail <span className="font-normal text-zinc-500">(opcional)</span>
        </label>
        <input
          id="fb-contato"
          value={contato}
          onChange={(e) => setContato(e.target.value)}
          maxLength={100}
          autoComplete="off"
          className={campo}
        />
        <p className="mt-1 text-xs text-zinc-500">Só a equipe vê. Serve para responder, se for preciso.</p>
      </div>

      {/* isca para robôs: invisível e fora da navegação por teclado */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Não preencha este campo
          <input tabIndex={-1} autoComplete="off" value={isca} onChange={(e) => setIsca(e.target.value)} />
        </label>
      </div>

      {erro && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>
      )}

      <button
        disabled={estado === "enviando"}
        className="rounded-full bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {estado === "enviando" ? "Enviando..." : "Enviar mensagem"}
      </button>
    </form>
  );
}
