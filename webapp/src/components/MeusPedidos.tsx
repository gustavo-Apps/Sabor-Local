"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { brl, pedidoAberto, rotuloDoStatusParaCliente, STATUS_ABERTOS, type StatusPedido } from "@/lib/pedidos";
import { tokensParaConsultar } from "@/lib/meusPedidos";
import { esvaziarCarrinho } from "@/components/useCarrinho";
import { useCarrinhosPendentes, useMeusPedidos } from "@/components/useMeusPedidos";

interface Situacao {
  status: StatusPedido;
  total: number;
}

const ATUALIZAR_A_CADA_MS = 30_000;

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

// Os pedidos feitos e os carrinhos começados neste aparelho. O status vem sempre do banco, pelo link de cada pedido.
export function MeusPedidos() {
  const { pedidos, remover, limpar } = useMeusPedidos();
  const carrinhos = useCarrinhosPendentes();
  const [situacao, setSituacao] = useState<Record<string, Situacao>>({});
  const [nomesDasLojas, setNomesDasLojas] = useState<Record<string, string> | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [semConexao, setSemConexao] = useState(false);
  // a lista mora no navegador: antes de a página "acordar" ainda não se sabe se está vazia
  const noNavegador = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const chaveDosPedidos = pedidos.map((p) => p.token).join(",");
  const idsDosCarrinhos = carrinhos.map((c) => c.vendedorId).join(",");

  const atualizar = useCallback(
    async (tokens: string[]) => {
      const supabase = createClient();
      const resultados = await Promise.all(
        tokens.map(async (token) => {
          const { data, error } = await supabase.rpc("pedido_por_token", { p_token: token });
          return { token, data: data as { estado?: string; status?: StatusPedido; total?: number } | null, erro: Boolean(error) };
        }),
      );
      const novo: Record<string, Situacao> = {};
      let falhou = false;
      for (const r of resultados) {
        if (r.erro || !r.data) falhou = true;
        else if (r.data.estado === "ok" && r.data.status) novo[r.token] = { status: r.data.status, total: Number(r.data.total ?? 0) };
        else if (r.data.estado === "invalido") remover(r.token); // o pedido saiu do ar (ou o link estava errado)
      }
      setSituacao((antes) => ({ ...antes, ...novo }));
      setSemConexao(falhou);
      setCarregado(true);
    },
    [remover],
  );

  // o que já se sabe de cada pedido, para a consulta periódica olhar só os que ainda podem mudar
  const situacaoRef = useRef(situacao);
  useEffect(() => {
    situacaoRef.current = situacao;
  }, [situacao]);

  // busca o status ao abrir e, depois, só dos pedidos abertos (e dos que ainda não responderam), com a aba à vista
  useEffect(() => {
    if (!chaveDosPedidos) return;
    const tokens = chaveDosPedidos.split(",");
    const consultar = () => {
      const conhecidos = Object.fromEntries(Object.entries(situacaoRef.current).map(([token, s]) => [token, s.status]));
      const quais = tokensParaConsultar(tokens, conhecidos, STATUS_ABERTOS);
      if (quais.length > 0) void atualizar(quais);
    };
    const primeira = setTimeout(consultar, 0);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") consultar();
    }, ATUALIZAR_A_CADA_MS);
    return () => {
      clearTimeout(primeira);
      clearInterval(id);
    };
  }, [chaveDosPedidos, atualizar]);

  // nome das lojas dos carrinhos
  useEffect(() => {
    if (!idsDosCarrinhos) return;
    let ativo = true;
    void (async () => {
      const { data } = await createClient().from("vendedores").select("id, nome").in("id", idsDosCarrinhos.split(","));
      if (ativo) setNomesDasLojas(Object.fromEntries((data ?? []).map((l) => [l.id as string, l.nome as string])));
    })();
    return () => {
      ativo = false;
    };
  }, [idsDosCarrinhos]);

  const emAndamento = pedidos.filter((p) => situacao[p.token] && pedidoAberto(situacao[p.token].status));
  const anteriores = pedidos.filter((p) => !emAndamento.includes(p));
  const vazio = noNavegador && pedidos.length === 0 && carrinhos.length === 0;

  return (
    <div className="space-y-8">
      <p className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-700">
        Esta lista fica <strong>só neste aparelho e neste navegador</strong>: o site não tem conta de cliente. Se você limpar os dados do navegador
        ou trocar de celular, ela some, mas o link de cada pedido continua valendo.
      </p>

      {vazio && (
        <section className="rounded-2xl border border-black/10 bg-white p-6 text-center">
          <p className="font-semibold">Você ainda não fez pedidos por aqui.</p>
          <p className="mt-1 text-sm text-zinc-600">Quando fizer um pedido pelo site, ele aparece nesta página para você acompanhar.</p>
          <Link href="/" className="mt-4 inline-block rounded-full bg-orange-600 px-6 py-3 font-semibold text-white hover:bg-orange-700">
            Ver o catálogo
          </Link>
        </section>
      )}

      {pedidos.length > 0 && !carregado && <p role="status" className="text-sm text-zinc-600">Buscando o andamento dos seus pedidos...</p>}
      {semConexao && (
        <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Não foi possível atualizar agora. O que aparece pode estar desatualizado.{" "}
          <button type="button" onClick={() => void atualizar(pedidos.map((p) => p.token))} className="font-semibold underline">
            Tentar de novo
          </button>
        </p>
      )}

      {emAndamento.length > 0 && (
        <section aria-labelledby="em-andamento">
          <h2 id="em-andamento" className="font-serif text-xl font-bold">
            Em andamento
          </h2>
          <ul className="mt-3 space-y-3">
            {emAndamento.map((p) => (
              <CartaoDoPedido key={p.token} pedido={p} situacao={situacao[p.token]} destaque />
            ))}
          </ul>
        </section>
      )}

      {carrinhos.length > 0 && (
        <section aria-labelledby="nao-finalizados">
          <h2 id="nao-finalizados" className="font-serif text-xl font-bold">
            Pedidos não finalizados
          </h2>
          <p className="text-sm text-zinc-600">Você escolheu os itens, mas ainda não enviou o pedido.</p>
          <ul className="mt-3 space-y-3">
            {carrinhos.map((c) => {
              const nome = nomesDasLojas?.[c.vendedorId];
              return (
                <li key={c.vendedorId} className="rounded-2xl border border-dashed border-orange-300 bg-orange-50 p-4">
                  <p className="font-semibold">{nome ?? (nomesDasLojas ? "Loja que saiu do ar" : "Carregando...")}</p>
                  <p className="text-sm text-zinc-700">
                    {c.unidades} {c.unidades === 1 ? "item" : "itens"} no pedido
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    {nome && (
                      <Link href={`/vendedores/${c.vendedorId}/pedido`} className="rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700">
                        Continuar pedido
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Esvaziar este pedido? Os itens escolhidos serão tirados.")) esvaziarCarrinho(c.vendedorId);
                      }}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Esvaziar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {anteriores.length > 0 && (
        <section aria-labelledby="anteriores">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="anteriores" className="font-serif text-xl font-bold">
              Pedidos anteriores
            </h2>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Apagar a lista de pedidos deste aparelho? Os pedidos continuam existindo, só saem daqui.")) limpar();
              }}
              className="text-xs text-zinc-600 underline hover:text-zinc-900"
            >
              Limpar a lista
            </button>
          </div>
          <ul className="mt-3 space-y-3">
            {anteriores.map((p) => (
              <CartaoDoPedido key={p.token} pedido={p} situacao={situacao[p.token]} aoRemover={() => remover(p.token)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CartaoDoPedido({
  pedido: p,
  situacao,
  destaque = false,
  aoRemover,
}: {
  pedido: { token: string; lojaNome: string; numero: number; total: number; criadoEm: string };
  situacao?: Situacao;
  destaque?: boolean;
  aoRemover?: () => void;
}) {
  return (
    <li className={`rounded-2xl border bg-white p-4 ${destaque ? "border-orange-400 ring-1 ring-orange-200" : "border-black/10"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{p.lojaNome}</p>
          <p className="text-sm text-zinc-600">
            Pedido nº {p.numero} · {quando(p.criadoEm)} · {brl(situacao?.total ?? p.total)}
          </p>
        </div>
        {situacao ? (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${COR_DO_STATUS[situacao.status] ?? "bg-zinc-100"}`}>
            {rotuloDoStatusParaCliente(situacao.status)}
          </span>
        ) : (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">Andamento indisponível agora</span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <Link href={`/pedido/${p.token}`} className="rounded-full border border-zinc-900 px-5 py-2 text-sm font-semibold hover:bg-zinc-900 hover:text-white">
          {destaque ? "Acompanhar" : "Ver pedido"}
        </Link>
        {aoRemover && (
          <button type="button" onClick={aoRemover} className="text-sm text-zinc-600 hover:underline">
            Tirar da lista
          </button>
        )}
      </div>
    </li>
  );
}
