import {
  brl,
  linkWhatsAppComTexto,
  pedidoAberto,
  podeCancelarNaLoja,
  proximasAcoes,
  rotuloDoStatusParaLoja,
  ROTULOS_PAGAMENTO,
  type FormaPagamento,
  type ModoPedido,
} from "@/lib/pedidos";
import { mascararWhatsApp } from "@/lib/validacao";
import type { GrupoDeDetalhes } from "@/lib/montaveis";
import { DetalhesDaMontagem } from "@/components/DetalhesDaMontagem";
import { mudarStatusPedido, recusarEBloquear } from "@/app/painel/actions";

export interface PedidoDaLoja {
  id: string;
  numero: number;
  modo: ModoPedido;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  endereco: string | null;
  observacoes: string | null;
  pagamento: FormaPagamento;
  troco_para: number | null;
  subtotal: number;
  taxa_entrega: number;
  total: number;
  tem_item_sob_consulta: boolean;
  status: string;
  motivo_cancelamento: string | null;
  cancelado_por: string | null;
  criado_em: string;
  pedido_itens: { nome: string; preco_unit: number | null; quantidade: number; detalhes: GrupoDeDetalhes[] | null }[];
}

const COR_DO_STATUS: Record<string, string> = {
  novo: "bg-orange-100 text-orange-800",
  em_preparo: "bg-amber-100 text-amber-800",
  saiu_para_entrega: "bg-blue-100 text-blue-800",
  pronto_para_retirada: "bg-blue-100 text-blue-800",
  concluido: "bg-green-100 text-green-800",
  cancelado: "bg-zinc-200 text-zinc-700",
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Um pedido na lista da loja: o que pediram, quem e onde, e os botões para andar com ele.
export function PedidoCard({ pedido: p, nomeDaLoja }: { pedido: PedidoDaLoja; nomeDaLoja: string }) {
  const acoes = proximasAcoes(p.modo, p.status);
  const aberto = pedidoAberto(p.status);
  const conversa = p.cliente_telefone
    ? linkWhatsAppComTexto(p.cliente_telefone, `Olá${p.cliente_nome ? `, ${p.cliente_nome}` : ""}! Aqui é da ${nomeDaLoja}, sobre o seu pedido nº ${p.numero}. `)
    : null;

  return (
    <li className={`rounded-2xl border bg-white p-4 text-sm ${p.status === "novo" ? "border-orange-400 ring-1 ring-orange-200" : "border-black/10"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold">
          Pedido nº {p.numero} <span className="font-normal text-zinc-500">· {quando(p.criado_em)}</span>
        </p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${COR_DO_STATUS[p.status] ?? "bg-zinc-100"}`}>
          {rotuloDoStatusParaLoja(p.status)}
        </span>
      </div>

      <ul className="mt-3 divide-y divide-black/5">
        {p.pedido_itens.map((i, n) => (
          <li key={`${n}-${i.nome}`} className="flex justify-between gap-3 py-1.5">
            <span>
              <strong>{i.quantidade}x</strong> {i.nome}
              <DetalhesDaMontagem grupos={i.detalhes} />
            </span>
            <span className="text-zinc-600">{i.preco_unit !== null ? brl(i.preco_unit * i.quantidade) : "a combinar"}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-between border-t border-black/10 pt-2 font-semibold">
        <span>
          Total {p.taxa_entrega > 0 && <span className="font-normal text-zinc-500">(com entrega {brl(p.taxa_entrega)})</span>}
        </span>
        <span>
          {brl(p.total)}
          {p.tem_item_sob_consulta ? " + a combinar" : ""}
        </span>
      </div>

      <dl className="mt-3 space-y-1 text-zinc-700">
        <div>
          <dt className="inline font-semibold">Cliente: </dt>
          <dd className="inline">
            {p.cliente_nome ?? "(dados removidos)"}
            {p.cliente_telefone && (
              <>
                {" · "}
                <a href={conversa ?? "#"} target="_blank" rel="noopener noreferrer" className="font-semibold text-green-700 underline">
                  {mascararWhatsApp(p.cliente_telefone)}
                </a>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold">{p.modo === "entrega" ? "Entregar em: " : "Retirada: "}</dt>
          <dd className="inline">{p.modo === "entrega" ? (p.endereco ?? "(endereço removido)") : "o cliente busca na loja"}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Pagamento: </dt>
          <dd className="inline">
            {ROTULOS_PAGAMENTO[p.pagamento]}
            {p.pagamento === "dinheiro" && p.troco_para ? ` · troco para ${brl(p.troco_para)}` : ""}
          </dd>
        </div>
        {p.observacoes && (
          <div className="rounded-lg bg-amber-50 p-2 text-amber-900">
            <dt className="inline font-semibold">Observações: </dt>
            <dd className="inline">{p.observacoes}</dd>
          </div>
        )}
        {p.status === "cancelado" && (
          <div>
            <dt className="inline font-semibold">Cancelado por: </dt>
            <dd className="inline">
              {p.cancelado_por === "cliente" ? "o cliente" : p.cancelado_por === "sistema" ? "falta de resposta (venceu)" : "a loja"}
              {p.motivo_cancelamento ? ` · ${p.motivo_cancelamento}` : ""}
            </dd>
          </div>
        )}
      </dl>

      {aberto && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {acoes.map((a) => (
              <form key={a.status} action={mudarStatusPedido}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="status" value={a.status} />
                <button className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">{a.rotulo}</button>
              </form>
            ))}
          </div>
          {podeCancelarNaLoja(p.status) && (
            <details className="rounded-xl border border-black/10 bg-zinc-50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-red-700">Cancelar ou recusar este pedido</summary>
              <form action={mudarStatusPedido} className="mt-3 grid gap-2">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="status" value="cancelado" />
                <label className="text-xs font-medium">
                  Motivo (o cliente vê)
                  <input
                    name="motivo"
                    maxLength={120}
                    placeholder="Ex.: acabou o gás, fora da área de entrega"
                    className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <button className="w-fit rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Cancelar pedido</button>
              </form>
              {p.cliente_telefone && (
                <form action={recusarEBloquear} className="mt-3 border-t border-black/10 pt-3">
                  <input type="hidden" name="id" value={p.id} />
                  <p className="text-xs text-zinc-600">
                    Pedido falso ou trote? Recuse e bloqueie o telefone: ele não consegue mais pedir na sua loja. Você pode desbloquear depois.
                  </p>
                  <button className="mt-2 rounded-full border border-red-600 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                    Recusar e bloquear este telefone
                  </button>
                </form>
              )}
            </details>
          )}
        </div>
      )}
    </li>
  );
}
