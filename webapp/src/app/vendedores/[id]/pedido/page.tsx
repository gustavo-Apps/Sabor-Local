import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buscarVendedorPorId, listarMontaveis } from "@/lib/vendedores";
import { montaveisDisponiveis } from "@/lib/montaveis";
import { agoraBR, situacaoAgora } from "@/lib/horarios";
import { disponibilidadeDoItem } from "@/lib/itens";
import { ehMinhaLoja } from "@/lib/minhaLoja";
import { lojaDoUsuarioLogado } from "@/lib/sessao";
import { FormPedido } from "@/components/FormPedido";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Finalizar pedido", robots: { index: false, follow: false } };

export default async function PedidoPage(props: PageProps<"/vendedores/[id]/pedido">) {
  const { id } = await props.params;
  const vendedor = await buscarVendedorPorId(id);
  if (!vendedor) notFound();
  if (ehMinhaLoja(await lojaDoUsuarioLogado(), vendedor.id)) redirect(`/vendedores/${id}`);

  const situacao = situacaoAgora(vendedor);
  const recebe = Boolean(vendedor.aceita_pedidos) && situacao.aberto;
  const hoje = agoraBR().data;
  const disponiveis = (vendedor.itens_cardapio ?? [])
    .filter((i) => disponibilidadeDoItem(i, hoje) === "disponivel")
    .map((i) => ({ id: i.id, nome: i.nome, preco: i.preco }));
  const montaveis = recebe ? montaveisDisponiveis((await listarMontaveis(vendedor, hoje)).montaveis) : [];

  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <Link href={`/vendedores/${id}`} className="text-sm font-semibold text-orange-600 underline">
        ← Voltar ao cardápio
      </Link>
      <h1 className="mt-3 font-serif text-2xl font-bold">Finalizar pedido</h1>
      <p className="text-sm text-zinc-600">{vendedor.nome}</p>

      {recebe ? (
        <div className="mt-6">
          {/* LGPD: quem informa nome, telefone e endereço precisa saber, na hora, para que servem e por quanto tempo ficam */}
          <p className="mb-4 rounded-xl bg-zinc-100 p-3 text-xs text-zinc-700">
            <strong>Seus dados:</strong> o nome, o telefone e o endereço que você informar aqui vão só para a loja, para ela preparar e
            entregar o pedido, e saem do pedido 90 dias depois de ele ser encerrado. Veja a{" "}
            <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
              Política de Privacidade
            </a>
            .
          </p>
          <FormPedido
            vendedorId={vendedor.id}
            nomeDaLoja={vendedor.nome}
            modoAtendimento={vendedor.modo_atendimento}
            pagamentosAceitos={vendedor.pagamentos_aceitos ?? ["pix", "dinheiro", "cartao"]}
            taxaEntrega={Number(vendedor.taxa_entrega ?? 0)}
            disponiveis={disponiveis}
            montaveis={montaveis}
          />
        </div>
      ) : (
        <p role="status" className="mt-6 rounded-2xl bg-amber-50 p-5 text-sm text-amber-800">
          {vendedor.aceita_pedidos
            ? "A loja está fechada agora, então os pedidos pelo site estão pausados. Volte quando ela abrir ou fale com ela pelo WhatsApp."
            : "Esta loja não recebe pedidos pelo site. Fale com ela pelo WhatsApp."}
        </p>
      )}
    </div>
  );
}
