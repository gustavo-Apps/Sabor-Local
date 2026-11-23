"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  brl,
  etapasDoPedido,
  linkWhatsAppComTexto,
  montarResumoParaWhatsApp,
  pedidoAberto,
  rotuloDoStatusParaCliente,
  ROTULOS_PAGAMENTO,
  type PedidoAcompanhado,
} from "@/lib/pedidos";
import { textoDosDetalhes } from "@/lib/montaveis";
import { AvaliarPorConviteForm } from "@/components/AvaliarPorConviteForm";
import { DetalhesDaMontagem } from "@/components/DetalhesDaMontagem";
import { registrarPedido } from "@/components/useMeusPedidos";

const RECARREGAR_A_CADA_MS = 20_000;

export function AcompanharPedido({ pedido, token, recemCriado }: { pedido: PedidoAcompanhado; token: string; recemCriado: boolean }) {
  const router = useRouter();
  const [aviso, setAviso] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const aberto = pedidoAberto(pedido.status);

  // Quem abre o link (logo depois de pedir ou mais tarde) ganha o pedido na lista "Meus pedidos", só neste aparelho.
  const { loja, numero, total, criado_em } = pedido;
  useEffect(() => {
    registrarPedido({ token, lojaId: loja.id, lojaNome: loja.nome, numero, total, criadoEm: criado_em });
  }, [token, loja.id, loja.nome, numero, total, criado_em]);

  // Enquanto o pedido anda, a página se atualiza sozinha (só com a aba à vista, para não gastar bateria à toa).
  useEffect(() => {
    if (!aberto) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, RECARREGAR_A_CADA_MS);
    return () => clearInterval(id);
  }, [aberto, router]);

  const etapas = etapasDoPedido(pedido.modo);
  const posicao = etapas.findIndex((e) => e.status === pedido.status);

  const linhas = pedido.itens.map((i) => ({
    nome: i.nome,
    preco: i.preco_unit,
    quantidade: i.quantidade,
    detalhesEmTexto: textoDosDetalhes(i.detalhes),
  }));
  const resumo = montarResumoParaWhatsApp(pedido.loja.nome, {
    numero: pedido.numero,
    nome: pedido.nome,
    modo: pedido.modo,
    endereco: pedido.endereco,
    pagamento: pedido.pagamento,
    troco: pedido.troco_para,
    observacoes: pedido.observacoes,
    linhas,
    totais: {
      quantidade: linhas.reduce((s, l) => s + l.quantidade, 0),
      subtotal: pedido.subtotal,
      taxaEntrega: pedido.taxa_entrega,
      total: pedido.total,
      sobConsulta: pedido.tem_item_sob_consulta,
    },
  });

  async function cancelar() {
    if (!window.confirm("Cancelar este pedido?")) return;
    setCancelando(true);
    const { data } = await createClient().rpc("cancelar_pedido_cliente", { p_token: token });
    setCancelando(false);
    if (data === "ok") return router.refresh();
    setAviso("A loja já começou o seu pedido, então só ela pode cancelar. Fale com a loja pelo WhatsApp.");
    router.refresh();
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(window.location.href.split("?")[0]);
      setAviso("Link copiado. Guarde para acompanhar depois.");
    } catch {
      setAviso("Não deu para copiar. Copie o endereço da barra do navegador.");
    }
  }

  return (
    <div className="space-y-5">
      {recemCriado && pedido.status === "novo" && (
        <div role="status" className="rounded-2xl bg-green-50 p-4 text-sm text-green-800">
          <p className="font-semibold">Pedido enviado!</p>
          <p className="mt-1">
            Para a loja ver mais rápido, <strong>toque em &ldquo;Avisar a loja pelo WhatsApp&rdquo;</strong> abaixo. Guarde este endereço: é por ele
            que você acompanha o pedido e, no fim, avalia a loja.
          </p>
        </div>
      )}

      {pedido.status === "cancelado" ? (
        <div role="status" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Pedido cancelado</p>
          <p className="mt-1">
            {pedido.cancelado_por === "cliente"
              ? "Você cancelou este pedido."
              : pedido.cancelado_por === "sistema"
                ? "A loja não respondeu a tempo e o pedido venceu."
                : `A loja cancelou o pedido${pedido.motivo_cancelamento ? `: ${pedido.motivo_cancelamento}` : "."}`}
          </p>
        </div>
      ) : (
        <section className="rounded-2xl border border-black/10 bg-white p-4" aria-label="Andamento do pedido">
          <p className="font-semibold" aria-live="polite">
            {rotuloDoStatusParaCliente(pedido.status)}
          </p>
          <ol className="mt-3 grid grid-cols-4 gap-1 text-center text-xs">
            {etapas.map((e, i) => (
              <li key={e.status} className={i <= posicao ? "font-semibold text-green-700" : "text-zinc-400"}>
                <div className={`mx-auto mb-1 h-2 rounded-full ${i <= posicao ? "bg-green-600" : "bg-zinc-200"}`} />
                {e.rotulo}
              </li>
            ))}
          </ol>
          {aberto && <p className="mt-3 text-xs text-zinc-500">A página se atualiza sozinha enquanto o pedido anda.</p>}
        </section>
      )}

      <section className="rounded-2xl border border-black/10 bg-white p-4 text-sm">
        <h2 className="font-serif text-lg font-bold">Pedido nº {pedido.numero}</h2>
        <ul className="mt-2 divide-y divide-black/5">
          {pedido.itens.map((i, n) => (
            <li key={`${n}-${i.nome}`} className="flex justify-between gap-3 py-2">
              <span>
                {i.quantidade}x {i.nome}
                <DetalhesDaMontagem grupos={i.detalhes} />
              </span>
              <span>{i.preco_unit !== null ? brl(i.preco_unit * i.quantidade) : "a combinar"}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 space-y-1 border-t border-black/10 pt-2">
          {pedido.taxa_entrega > 0 && (
            <p className="flex justify-between">
              <span>Entrega</span>
              <span>{brl(pedido.taxa_entrega)}</span>
            </p>
          )}
          <p className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>
              {brl(pedido.total)}
              {pedido.tem_item_sob_consulta ? " + itens a combinar" : ""}
            </span>
          </p>
        </div>
        <dl className="mt-3 space-y-1 text-zinc-700">
          <div>
            <dt className="inline font-semibold">Como receber: </dt>
            <dd className="inline">{pedido.modo === "entrega" ? `Entrega${pedido.endereco ? ` em ${pedido.endereco}` : ""}` : "Retirada na loja"}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Pagamento: </dt>
            <dd className="inline">
              {ROTULOS_PAGAMENTO[pedido.pagamento]}
              {pedido.pagamento === "dinheiro" && pedido.troco_para ? ` (troco para ${brl(pedido.troco_para)})` : ""}. Pague direto à loja.
            </dd>
          </div>
          {pedido.observacoes && (
            <div>
              <dt className="inline font-semibold">Observações: </dt>
              <dd className="inline">{pedido.observacoes}</dd>
            </div>
          )}
        </dl>
      </section>

      <div className="flex flex-wrap gap-3">
        <a
          href={linkWhatsAppComTexto(pedido.loja.whatsapp, resumo)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700"
        >
          Avisar a loja pelo WhatsApp
        </a>
        <button type="button" onClick={copiarLink} className="rounded-full border border-zinc-900 px-5 py-3 font-semibold hover:bg-zinc-900 hover:text-white">
          Copiar link do pedido
        </button>
        {pedido.status === "novo" && (
          <button
            type="button"
            onClick={cancelar}
            disabled={cancelando}
            className="rounded-full px-5 py-3 font-semibold text-red-600 underline disabled:opacity-60"
          >
            {cancelando ? "Cancelando..." : "Cancelar pedido"}
          </button>
        )}
      </div>
      {aviso && (
        <p role="status" className="text-sm text-zinc-700">
          {aviso}
        </p>
      )}

      {pedido.pode_avaliar && (
        <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <h2 className="font-serif text-lg font-bold">Como foi o seu pedido?</h2>
          <p className="mb-3 text-sm text-zinc-700">
            Sua avaliação ajuda outras pessoas da cidade. {pedido.moderada ? "Ela entra no ar depois de uma conferência da equipe. " : ""}
            Seu nome é opcional.
          </p>
          <AvaliarPorConviteForm token={token} nomeDaLoja={pedido.loja.nome} moderada={pedido.moderada} origem="pedido" />
        </section>
      )}
      {pedido.avaliado && (
        <p className="rounded-2xl bg-green-50 p-4 text-sm text-green-800">Obrigado! Você já avaliou este pedido.</p>
      )}

      <p className="text-center text-sm">
        <Link href={`/vendedores/${pedido.loja.id}`} className="font-semibold text-orange-600 underline">
          Ver o perfil de {pedido.loja.nome}
        </Link>
      </p>
    </div>
  );
}
