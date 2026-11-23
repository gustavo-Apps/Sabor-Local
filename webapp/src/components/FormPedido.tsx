"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { itensParaEnviar, linhasDoCarrinho } from "@/lib/carrinho";
import { linhasMontadas, montagemParaEnviar, type GrupoDeDetalhes, type Montavel } from "@/lib/montaveis";
import {
  brl,
  calcularTotais,
  FORMAS_PAGAMENTO,
  mensagemErroDoPedido,
  ROTULOS_PAGAMENTO,
  type FormaPagamento,
  type ModoPedido,
} from "@/lib/pedidos";
import { mascararWhatsApp, validarPedido } from "@/lib/validacao";
import { DetalhesDaMontagem } from "@/components/DetalhesDaMontagem";
import { Quantidade } from "@/components/Quantidade";
import { useCarrinho } from "@/components/useCarrinho";

interface Props {
  vendedorId: string;
  nomeDaLoja: string;
  modoAtendimento: "entrega" | "retirada" | "ambos";
  pagamentosAceitos: string[];
  taxaEntrega: number;
  disponiveis: { id: string; nome: string; preco: number | null }[];
  /** Produtos "monte o seu" (pizza, açaí...) para reconhecer o que o cliente montou. */
  montaveis?: Montavel[];
}

const campo = "mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-base";

export function FormPedido({ vendedorId, nomeDaLoja, modoAtendimento, pagamentosAceitos, taxaEntrega, disponiveis, montaveis = [] }: Props) {
  const router = useRouter();
  const { carrinho, definir, limpar } = useCarrinho(vendedorId);
  const formas = FORMAS_PAGAMENTO.filter((f) => pagamentosAceitos.includes(f));

  const [modo, setModo] = useState<ModoPedido>(modoAtendimento === "retirada" ? "retirada" : "entrega");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [pagamento, setPagamento] = useState<string>(formas[0] ?? "");
  const [troco, setTroco] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const simples = linhasDoCarrinho(carrinho, disponiveis);
  const montadas = linhasMontadas(carrinho, montaveis);
  const linhas: { chave: string; nome: string; preco: number | null; quantidade: number; detalhes: GrupoDeDetalhes[] }[] = [
    ...simples.map((l) => ({ chave: l.itemId, nome: l.nome, preco: l.preco, quantidade: l.quantidade, detalhes: [] })),
    ...montadas,
  ];
  const totais = calcularTotais(linhas, modo, taxaEntrega);

  if (linhas.length === 0) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-6 text-center">
        <p className="font-semibold">Seu pedido está vazio.</p>
        <p className="mt-1 text-sm text-zinc-600">Volte ao cardápio e toque em Adicionar nos itens que quiser.</p>
        <Link href={`/vendedores/${vendedorId}`} className="mt-4 inline-block rounded-full bg-green-600 px-6 py-3 font-semibold text-white">
          Voltar ao cardápio
        </Link>
      </div>
    );
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const v = validarPedido(
      { modo, nome, telefone, endereco, pagamento, troco, observacoes },
      { modoAtendimento, pagamentosAceitos: formas, total: totais.total },
    );
    if (!v.ok) return setErro(v.erro);

    setEnviando(true);
    const { data, error } = await createClient().rpc("criar_pedido", {
      p_vendedor: vendedorId,
      p_itens: [...itensParaEnviar(simples), ...montadas.map(montagemParaEnviar)],
      ...v.valor,
    });
    if (error || !data) {
      setEnviando(false);
      return setErro(mensagemErroDoPedido(error?.message));
    }

    limpar();
    router.push(`/pedido/${(data as { token: string }).token}?novo=1`);
  }

  return (
    <form onSubmit={enviar} className="space-y-6">
      <section className="rounded-2xl border border-black/10 bg-white p-4">
        <h2 className="font-serif text-lg font-bold">Seu pedido</h2>
        <ul className="mt-2 divide-y divide-black/5">
          {linhas.map((l) => (
            <li key={l.chave} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">{l.nome}</p>
                <DetalhesDaMontagem grupos={l.detalhes} />
                <p className="text-sm text-zinc-600">
                  {l.preco !== null ? brl(l.preco * l.quantidade) : "valor a combinar com a loja"}
                </p>
              </div>
              <Quantidade nome={l.nome} valor={l.quantidade} aoMudar={(q) => definir(l.chave, q)} />
            </li>
          ))}
        </ul>
        <Link href={`/vendedores/${vendedorId}`} className="mt-1 inline-block text-sm font-semibold text-orange-600 underline">
          Adicionar mais itens
        </Link>
      </section>

      {modoAtendimento === "ambos" && (
        <fieldset className="rounded-2xl border border-black/10 bg-white p-4">
          <legend className="px-1 font-serif text-lg font-bold">Como quer receber?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(["entrega", "retirada"] as const).map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-2 rounded-xl border border-black/10 p-3 has-[:checked]:border-green-600 has-[:checked]:bg-green-50">
                <input type="radio" name="modo" value={m} checked={modo === m} onChange={() => setModo(m)} />
                <span className="font-medium">{m === "entrega" ? "Entrega" : "Retirada na loja"}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <section className="space-y-4 rounded-2xl border border-black/10 bg-white p-4">
        <h2 className="font-serif text-lg font-bold">Seus dados</h2>
        <label className="block text-sm font-medium">
          Seu nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" maxLength={60} required className={campo} />
        </label>
        <label className="block text-sm font-medium">
          Telefone com DDD (a loja chama por aqui se precisar)
          <input
            value={telefone}
            onChange={(e) => setTelefone(mascararWhatsApp(e.target.value))}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 99999-0000"
            required
            className={campo}
          />
        </label>
        {modo === "entrega" && (
          <label className="block text-sm font-medium">
            Endereço da entrega (rua, número e bairro)
            <textarea
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              autoComplete="street-address"
              rows={2}
              maxLength={200}
              required
              className={campo}
            />
          </label>
        )}
      </section>

      <fieldset className="rounded-2xl border border-black/10 bg-white p-4">
        <legend className="px-1 font-serif text-lg font-bold">Como vai pagar?</legend>
        <p className="text-xs text-zinc-600">
          O pagamento é feito direto com a loja, na entrega ou na retirada. O site não cobra nada.
        </p>
        <div className="mt-2 grid gap-2">
          {formas.map((f: FormaPagamento) => (
            <label key={f} className="flex cursor-pointer items-center gap-2 rounded-xl border border-black/10 p-3 has-[:checked]:border-green-600 has-[:checked]:bg-green-50">
              <input type="radio" name="pagamento" value={f} checked={pagamento === f} onChange={() => setPagamento(f)} />
              <span className="font-medium">{ROTULOS_PAGAMENTO[f]}</span>
            </label>
          ))}
        </div>
        {pagamento === "dinheiro" && (
          <label className="mt-3 block text-sm font-medium">
            Troco para quanto? (opcional)
            <input value={troco} onChange={(e) => setTroco(e.target.value)} inputMode="decimal" placeholder="Ex.: 50" className={campo} />
          </label>
        )}
      </fieldset>

      <section className="rounded-2xl border border-black/10 bg-white p-4">
        <label className="block text-sm font-medium">
          Observações (opcional)
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Ex.: sem cebola, a campainha está estragada"
            className={campo}
          />
        </label>
        <p className="mt-1 text-right text-xs text-zinc-500">{observacoes.trim().length}/300</p>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-4 text-sm">
        <div className="flex justify-between py-1">
          <span>Itens</span>
          <span>{brl(totais.subtotal)}</span>
        </div>
        {modo === "entrega" && (
          <div className="flex justify-between py-1">
            <span>Entrega</span>
            <span>{taxaEntrega > 0 ? brl(taxaEntrega) : "Grátis"}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-black/10 pt-2 text-base font-bold">
          <span>Total</span>
          <span>
            {brl(totais.total)}
            {totais.sobConsulta ? " + itens a combinar" : ""}
          </span>
        </div>
        {totais.sobConsulta && (
          <p className="mt-2 text-xs text-zinc-600">Algum item não tem preço no site. A loja confirma o valor final com você.</p>
        )}
      </section>

      {erro && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      <button
        disabled={enviando}
        className="w-full rounded-full bg-green-600 px-6 py-4 text-lg font-semibold text-white hover:bg-green-700 disabled:opacity-60"
      >
        {enviando ? "Enviando..." : `Enviar pedido para ${nomeDaLoja}`}
      </button>
    </form>
  );
}
