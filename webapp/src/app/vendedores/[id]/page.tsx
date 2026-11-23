import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarVendedorPorId, listarAvaliacoes, listarMaisPedidos, listarMontaveis } from "@/lib/vendedores";
import { montaveisDisponiveis } from "@/lib/montaveis";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { agoraBR, situacaoAgora } from "@/lib/horarios";
import { disponibilidadeDoItem, ordenarParaPerfil, seloIndisponivel } from "@/lib/itens";
import { emDestaque } from "@/lib/ordenacao";
import { DenunciaForm } from "@/components/DenunciaForm";
import { CardapioLista, type ItemDoPerfil } from "@/components/CardapioLista";
import { montarDestaques, motivosDoItem, selosDoItem, MAX_NA_SECAO_DE_DESTAQUES } from "@/lib/destaques";
import { NotaMedia } from "@/components/NotaMedia";
import { BarraDoPedido } from "@/components/BarraDoPedido";
import { MontadorDeProduto } from "@/components/MontadorDeProduto";
import { BotaoLinkPedido } from "@/components/BotaoLinkPedido";
import { BotaoWhatsApp } from "@/components/BotaoWhatsApp";
import { ROTULO_PADRAO_LINK_PEDIDO } from "@/lib/validacao";
import { Rastreio } from "@/components/Rastreio";
import { ehMinhaLoja } from "@/lib/minhaLoja";
import { lojaDoUsuarioLogado } from "@/lib/sessao";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export async function generateMetadata(props: PageProps<"/vendedores/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const vendedor = await buscarVendedorPorId(id);
  if (!vendedor) return { title: "Vendedor não encontrado" };

  const ramos = vendedor.categorias.map((c) => c.nome).join(", ");
  const local = vendedor.bairro ? ` no bairro ${vendedor.bairro.nome}` : "";
  const titulo = `${vendedor.nome}${ramos ? ` · ${ramos}` : ""}`;
  const descricao =
    vendedor.descricao ?? `Cardápio, horários e WhatsApp de ${vendedor.nome}${local}. Veja no Sabor Local.`;
  // prévia ao compartilhar (WhatsApp, Facebook): o banner da loja, ou a logo na falta dele
  const imagem = vendedor.banner_url ?? vendedor.logo_url;
  return {
    title: titulo,
    description: descricao,
    openGraph: { title: titulo, description: descricao, type: "website", ...(imagem ? { images: [{ url: imagem }] } : {}) },
    twitter: { card: imagem ? "summary_large_image" : "summary", title: titulo, description: descricao, ...(imagem ? { images: [imagem] } : {}) },
  };
}

export default async function VendedorPage(props: PageProps<"/vendedores/[id]">) {
  const { id } = await props.params;
  const { q, categoria } = await props.searchParams;
  const buscaInicial = (Array.isArray(q) ? q[0] : q)?.slice(0, 80) ?? "";
  const categoriaInicial = (Array.isArray(categoria) ? categoria[0] : categoria)?.slice(0, 60) ?? "";
  const vendedor = await buscarVendedorPorId(id);

  if (!vendedor) notFound();

  const [avaliacoes, minhaLojaId, maisPedidos] = await Promise.all([
    listarAvaliacoes(id),
    lojaDoUsuarioLogado(),
    listarMaisPedidos(id),
  ]);
  const minha = ehMinhaLoja(minhaLojaId, vendedor.id);
  // o item indisponível continua no perfil (esmaecido, com selo, no fim da lista)
  const hoje = agoraBR().data;
  // "Monte o seu" (pizza, açaí...): tamanhos, escolhas e adicionais da loja; as escolhas sem preço não se pedem sozinhas
  const { montaveis: todosMontaveis, soDeEscolha } = await listarMontaveis(vendedor, hoje);
  const montaveis = montaveisDisponiveis(todosMontaveis);
  const itens = ordenarParaPerfil(vendedor.itens_cardapio ?? [], hoje);
  const seloDe = (i: (typeof itens)[number]) => seloIndisponivel(disponibilidadeDoItem(i, hoje));
  const disponivel = (i: (typeof itens)[number]) => disponibilidadeDoItem(i, hoje) === "disponivel";
  // o botão "Pedir" do item abre o WhatsApp já com o item na mensagem; some para o dono e para item indisponível
  const paraLista = (i: (typeof itens)[number], destaques: string[] = selosDoItem(motivosDoItem(i, maisPedidos, disponivel(i)))): ItemDoPerfil => ({
    id: i.id,
    nome: i.nome,
    descricao: i.descricao,
    preco: i.preco,
    foto_url: i.foto_url,
    selo: seloDe(i),
    categoria: i.categoria ?? null,
    destaques,
    pedirHref: minha || !disponivel(i) || soDeEscolha.has(i.id) ? null : buildWhatsAppLink(vendedor.whatsapp, vendedor.nome, { nome: i.nome, preco: i.preco }),
  });
  const destaques = montarDestaques(itens, maisPedidos, disponivel);
  const situacao = situacaoAgora(vendedor);
  // Pedido pelo site: a loja liga nas configurações e só recebe com a loja aberta (o banco confere de novo). O dono não pede na própria loja.
  const recebePedidos = Boolean(vendedor.aceita_pedidos) && !minha;
  const pedidosAtivos = recebePedidos && situacao.aberto;
  const link = buildWhatsAppLink(vendedor.whatsapp, vendedor.nome);

  return (
    <div className={`mx-auto w-full max-w-3xl flex-1 px-4 py-10 ${pedidosAtivos ? "pb-28" : ""}`}>
      <Rastreio tipo="visita_vendedor" vendedorId={vendedor.id} ignorar={minha} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FoodEstablishment",
            name: vendedor.nome,
            description: vendedor.descricao ?? undefined,
            servesCuisine: vendedor.categorias.map((c) => c.nome),
            areaServed: vendedor.bairro?.nome,
          }).replace(/</g, String.fromCharCode(92) + "u003c"), // vira o texto \u003c: impede fechar o <script> com </script>
        }}
      />
      {vendedor.banner_url && (
        <div className="mb-5 aspect-[3/1] w-full overflow-hidden rounded-2xl bg-zinc-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={vendedor.banner_url} alt="" width={1200} height={400} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        {vendedor.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vendedor.logo_url}
            alt={`Logo de ${vendedor.nome}`}
            width={72}
            height={72}
            className="h-[72px] w-[72px] shrink-0 rounded-2xl border border-black/10 bg-white object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-3xl font-bold">{vendedor.nome}</h1>
          {emDestaque(vendedor) && (
            <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              ★ Destaque
            </span>
          )}
          <div className="mt-1">
            <NotaMedia media={vendedor.avaliacao_media} total={vendedor.avaliacao_total} extenso />
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
            {vendedor.categorias.map((c) => (
              <span key={c.id} className="rounded-full bg-gray-100 px-2 py-0.5">{c.nome}</span>
            ))}
            {vendedor.bairro ? (
              <span className="rounded-full bg-gray-100 px-2 py-0.5">{vendedor.bairro.nome}</span>
            ) : (
              vendedor.bairro_sugerido && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5">{vendedor.bairro_sugerido} (a confirmar)</span>
              )
            )}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
            situacao.aberto ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {situacao.rotulo}
        </span>
      </div>

      {situacao.aviso && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{situacao.aviso}</p>
      )}

      {vendedor.descricao && <p className="mt-4 text-zinc-700">{vendedor.descricao}</p>}

      {minha ? (
        <div className="mt-6 rounded-2xl border border-zinc-900 bg-zinc-50 p-4 text-sm">
          <p className="font-semibold">Esta é a sua loja</p>
          <p className="mt-1 text-zinc-700">
            Você está vendo como os clientes veem. O botão de pedir fica escondido para você, e as visitas e os toques que fizer
            aqui não entram nas suas métricas.
          </p>
          <Link href="/painel" className="mt-3 inline-block rounded-full bg-zinc-900 px-4 py-2 font-semibold text-white">
            Editar meu perfil
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3">
          {vendedor.link_pedido_url && (
            <BotaoLinkPedido
              href={vendedor.link_pedido_url}
              rotulo={vendedor.link_pedido_rotulo || ROTULO_PADRAO_LINK_PEDIDO}
              vendedorId={vendedor.id}
            />
          )}
          <BotaoWhatsApp href={link} vendedorId={vendedor.id} secundario={Boolean(vendedor.link_pedido_url)} />
        </div>
      )}

      {recebePedidos && !pedidosAtivos && (
        <p className="mt-6 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Esta loja recebe pedidos pelo site, mas só quando está aberta. Por enquanto, fale com ela pelo WhatsApp.
        </p>
      )}
      {pedidosAtivos && (
        <p className="mt-6 rounded-xl bg-green-50 p-3 text-sm text-green-800">
          <strong>Peça pelo site:</strong> toque em <strong>Adicionar</strong> nos itens que quiser
          {montaveis.length > 0 && (
            <>
              {" "}
              (ou em <strong>Montar</strong>, nos produtos que você escolhe tamanho e sabores)
            </>
          )}{" "}
          e finalize no fim da página. A loja confirma o pedido e você acompanha por aqui.
        </p>
      )}

      {montaveis.length > 0 && (
        <section className="mt-10" aria-labelledby="monte-o-seu">
          <h2 id="monte-o-seu" className="font-serif text-xl font-bold">
            Monte o seu
          </h2>
          <ul className="mt-3 space-y-3">
            {montaveis.map((m) => (
              <MontadorDeProduto
                key={m.id}
                vendedorId={vendedor.id}
                nomeDaLoja={vendedor.nome}
                whatsapp={vendedor.whatsapp}
                montavel={m}
                modo={minha ? "ver" : pedidosAtivos ? "site" : "whatsapp"}
              />
            ))}
          </ul>
        </section>
      )}

      {vendedor.cardapio_url && (
        <section className="mt-10">
          <h2 className="font-serif text-xl font-bold">Cardápio completo</h2>
          {vendedor.cardapio_tipo === "application/pdf" ? (
            <a
              href={vendedor.cardapio_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-full border border-zinc-900 px-5 py-2 text-sm font-semibold hover:bg-zinc-900 hover:text-white"
            >
              Abrir cardápio (PDF)
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vendedor.cardapio_url}
              alt={`Cardápio de ${vendedor.nome}`}
              className="mt-3 w-full rounded-2xl border border-black/10"
            />
          )}
        </section>
      )}

      {destaques.length > 0 && (
        <section className="mt-10" aria-labelledby="destaques-do-cardapio">
          <h2 id="destaques-do-cardapio" className="font-serif text-xl font-bold">
            Destaques do cardápio
          </h2>
          <CardapioLista
            vendedorId={vendedor.id}
            comPedido={pedidosAtivos}
            semBusca
            itens={destaques.slice(0, MAX_NA_SECAO_DE_DESTAQUES).map((d) => paraLista(d.item, selosDoItem(d.motivos)))}
          />
          <p className="mt-2 text-xs text-zinc-500">
            <strong>Destaque da casa</strong> é a escolha da loja. <strong>Mais pedido</strong> são os itens que mais receberam
            toques em &ldquo;Pedir&rdquo; neste site nos últimos 30 dias.
          </p>
        </section>
      )}

      {itens.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-xl font-bold">Cardápio</h2>
          <CardapioLista
            vendedorId={vendedor.id}
            comPedido={pedidosAtivos}
            buscaInicial={buscaInicial}
            categoriaInicial={categoriaInicial}
            itens={itens.map((i) => paraLista(i))}
          />
        </section>
      )}

      {vendedor.horarios && vendedor.horarios.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-xl font-bold">Horários</h2>
          <ul className="mt-3 rounded-2xl border border-black/10 bg-white p-4 text-sm">
            {DIAS.map((nome, dia) => {
              // um dia pode ter dois períodos (ex.: manhã e noite): mostra na mesma linha, em ordem
              const periodos = vendedor.horarios!
                .filter((h) => h.dia_semana === dia)
                .sort((a, b) => a.abre.localeCompare(b.abre));
              if (periodos.length === 0) return null;
              return (
                <li key={dia} className="flex justify-between gap-4 py-1">
                  <span>{nome}</span>
                  <span className="text-right">
                    {periodos.map((h) => `${h.abre.slice(0, 5)} – ${h.fecha.slice(0, 5)}`).join("  ·  ")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-10" id="avaliacoes">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-xl font-bold">Avaliações</h2>
          <NotaMedia media={vendedor.avaliacao_media} total={vendedor.avaliacao_total} extenso />
        </div>

        {avaliacoes.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {avaliacoes.map((a) => (
              <li key={a.id} className="rounded-2xl border border-black/10 bg-white p-4 text-sm">
                <p className="font-semibold text-amber-600">
                  <span className="sr-only">Nota {a.nota} de 5</span>
                  <span aria-hidden="true">
                    {"★".repeat(a.nota)}
                    {"☆".repeat(5 - a.nota)}
                  </span>
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    {a.autor_nome ?? "Cliente"} ·{" "}
                    {new Date(a.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </span>
                </p>
                {a.comentario && <p className="mt-1 text-zinc-700">{a.comentario}</p>}
                {!minha && <DenunciaForm vendedorId={vendedor.id} avaliacaoId={a.id} rotulo="Denunciar avaliação" />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-xl bg-zinc-100 p-4 text-sm text-zinc-700">
            Esta loja ainda não tem avaliações publicadas.
          </p>
        )}

        <p className="mt-3 text-xs text-zinc-500">
          Só avalia quem pediu: depois do pedido, a loja envia um convite <strong>por e-mail</strong> ao cliente. O link é
          só da pessoa que comprou, por isso a loja não consegue se avaliar sozinha. Toda avaliação passa por uma
          conferência da equipe antes de aparecer.
        </p>
        {minha && (
          <Link
            href="/painel?aba=clientes"
            className="mt-3 inline-block rounded-full border border-zinc-900 px-4 py-2 text-sm font-semibold hover:bg-zinc-900 hover:text-white"
          >
            Convidar clientes para avaliar
          </Link>
        )}
      </section>

      {pedidosAtivos && (
        <BarraDoPedido
          vendedorId={vendedor.id}
          disponiveis={itens.filter(disponivel).map((i) => ({ id: i.id, nome: i.nome, preco: i.preco }))}
          montaveis={montaveis}
        />
      )}

      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-black/10 pt-4">
        {!minha && <DenunciaForm vendedorId={vendedor.id} rotulo="Algo errado com este vendedor? Denunciar" />}
        <Link
          href={`/feedback?de=${encodeURIComponent(`/vendedores/${vendedor.id}`)}`}
          className="text-xs text-zinc-500 underline hover:text-zinc-800"
        >
          Reportar um problema no site
        </Link>
      </div>
    </div>
  );
}
