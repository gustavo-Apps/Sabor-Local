import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { listarBairros, listarCategorias } from "@/lib/catalogo";
import { listarCidades } from "@/lib/cidades";
import { CampoHora } from "@/components/CampoHora";
import { CampoLocal } from "@/components/CampoLocal";
import { CompartilharPainel } from "@/components/CompartilharPainel";
import { HorariosCampos } from "@/components/HorariosCampos";
import { linkDoPerfil, mensagemPadrao, ROTULOS_ORIGEM, type Origem } from "@/lib/compartilhar";
import { disponibilidadeDoItem, seloIndisponivel } from "@/lib/itens";
import { MAX_DESTAQUES_DA_CASA } from "@/lib/destaques";
import { ROTULO_PADRAO_LINK_PEDIDO } from "@/lib/validacao";
import { TERMOS_DATA, TERMOS_VERSAO } from "@/lib/legal";
import { precisaAceitarTermos } from "@/lib/termos";
import { agoraBR, formatarData } from "@/lib/horarios";
import { AcaoForm } from "@/components/AcaoForm";
import { CampoWhatsApp } from "@/components/CampoWhatsApp";
import { CardapioUpload } from "@/components/CardapioUpload";
import { ImagemPerfil } from "@/components/ImagemPerfil";
import { AtualizarSozinho } from "@/components/AtualizarSozinho";
import { PedidoCard, type PedidoDaLoja } from "@/components/PedidoCard";
import { brl, FORMAS_PAGAMENTO, pedidoAberto, ROTULOS_PAGAMENTO } from "@/lib/pedidos";
import { ItemFoto } from "@/components/ItemFoto";
import { CategoriaDoItem } from "@/components/CategoriaDoItem";
import { CampoNovaCategoria } from "@/components/CampoNovaCategoria";
import { PainelMontaveis } from "@/components/PainelMontaveis";
import type { MontavelBruto } from "@/lib/montaveis";
import { MAX_CATEGORIAS_POR_LOJA } from "@/lib/categoriasProduto";
import type { Vendedor } from "@/lib/types";
import {
  adicionarCategoria,
  adicionarItem,
  alternarDestaque,
  moverCategoria,
  removerCategoria,
  renomearCategoria,
  desbloquearCliente,
  salvarConfigPedidos,
  alternarDisponivel,
  aceitarTermos,
  cancelarConvite,
  convidarParaAvaliar,
  excluirConta,
  definirStatus,
  removerExcecao,
  removerItem,
  sair,
  salvarExcecao,
  salvarHorarios,
  salvarPerfil,
} from "./actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";


const ABAS = [
  ["perfil", "Perfil"],
  ["horarios", "Horários"],
  ["menu", "Menu"],
  ["cardapio", "Cardápio"],
  ["pedidos", "Pedidos"],
  ["clientes", "Clientes"],
  ["compartilhar", "Compartilhar"],
] as const;
type Aba = (typeof ABAS)[number][0];

const input = "w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-base";

const SELECT_PAINEL = `
  id, nome, descricao, whatsapp, modo_atendimento, ativo, aprovado_em, destaque_ate, cardapio_url, cardapio_tipo, logo_url, banner_url, aceita_pedidos, pagamentos_aceitos, taxa_entrega,
  link_pedido_url, link_pedido_rotulo, bairro_id, bairro_sugerido, cidade_id, status_manual, status_manual_ate, status_manual_msg,
  vendedor_categorias ( categoria_id ),
  horarios:horarios_funcionamento ( id, vendedor_id, dia_semana, abre, fecha ),
  excecoes:excecoes_horario ( id, vendedor_id, data, fechado, abre, fecha, motivo ),
  itens_cardapio ( id, vendedor_id, nome, descricao, preco, foto_url, ordem, disponivel, indisponivel_ate, destaque, categoria_produto_id )
`;

interface ResumoDePedidos {
  pedidos: number;
  concluidos: number;
  cancelados: number;
  valor_concluido: number | string;
}

type VendedorPainel = Omit<Vendedor, "categorias" | "bairro"> & {
  vendedor_categorias: { categoria_id: string }[];
  bairro_id: string | null;
  cidade_id: string | null;
  aprovado_em: string | null;
};

function trintaDiasAtras() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : "");

async function urlDoSite() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  return `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}`;
}

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto w-full max-w-xl flex-1 px-4 py-16">
        <h1 className="font-serif text-2xl font-bold">Painel do vendedor</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Configure as variáveis do Supabase (<code>.env.local</code>) para habilitar o login.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data }, categorias, bairros, cidades, { data: perfil }, { data: ehAdmin }] = await Promise.all([
    supabase.from("vendedores").select(SELECT_PAINEL).eq("owner_id", user.id).maybeSingle(),
    listarCategorias(),
    listarBairros(),
    listarCidades(),
    supabase.from("perfis_vendedor").select("username, categoria_ids, termos_versao").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("is_admin"),
  ]);
  const vendedor = data as unknown as VendedorPainel | null;

  // Sem perfil criado, só a aba Perfil faz sentido
  const { aba: abaParam } = await searchParams;
  const aba: Aba = vendedor && ABAS.some(([id]) => id === abaParam) ? (abaParam as Aba) : "perfil";

  const ramosSelecionados = vendedor
    ? vendedor.vendedor_categorias.map((vc) => vc.categoria_id)
    : (perfil?.categoria_ids ?? []);
  // até dois períodos por dia, em ordem de horário
  const periodosPorDia = Array.from({ length: 7 }, (_, dia) =>
    (vendedor?.horarios ?? [])
      .filter((h) => h.dia_semana === dia)
      .sort((a, b) => a.abre.localeCompare(b.abre))
      .map((h) => ({ abre: hhmm(h.abre), fecha: hhmm(h.fecha) })),
  );
  const itens = [...(vendedor?.itens_cardapio ?? [])].sort((a, b) => a.ordem - b.ordem);
  const hoje = agoraBR().data;
  const excecoes = (vendedor?.excecoes ?? []).filter((e) => e.data >= hoje).sort((a, b) => a.data.localeCompare(b.data));

  // Dados da aba "Clientes" (só buscados quando ela está aberta)
  let visitas = 0;
  let contatos = 0;
  let toquesNoLink = 0;
  let convites: { id: string; email_mascarado: string; criado_em: string; expira_em: string; estado: string }[] = [];
  let pagamentosDoVendedor: {
    id: string;
    valor: number;
    forma: string;
    dias: number;
    destaque_ate: string;
    created_at: string;
  }[] = [];
  let categoriasDoMenu: { id: string; nome: string; chave: string; ordem: number }[] = [];
  let montaveisDoMenu: MontavelBruto[] = [];
  if (vendedor && aba === "menu") {
    const [{ data: cs }, { data: ms }] = await Promise.all([
      supabase.from("categorias_produto").select("id, nome, chave, ordem").eq("vendedor_id", vendedor.id).order("ordem"),
      supabase
        .from("montaveis")
        .select(
          "id, nome, descricao, rotulo_escolhas, escolha_obrigatoria, rotulo_adicionais, max_adicionais, disponivel, ordem, tamanhos:montavel_tamanhos ( id, nome, preco, max_escolhas, ordem ), adicionais:montavel_adicionais ( id, nome, preco, disponivel, ordem ), categorias:montavel_categorias ( categoria_produto_id )",
        )
        .eq("vendedor_id", vendedor.id)
        .order("ordem"),
    ]);
    categoriasDoMenu = cs ?? [];
    montaveisDoMenu = (ms ?? []) as unknown as MontavelBruto[];
  }
  let pedidosDaLoja: PedidoDaLoja[] = [];
  let bloqueados: { telefone_hash: string; telefone_final: string; criado_em: string }[] = [];
  let resumoPedidos: ResumoDePedidos | null = null;
  let pedidosNovos = 0;
  if (vendedor) {
    pedidosNovos = (await supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("status", "novo")).count ?? 0;
  }
  if (vendedor && aba === "pedidos") {
    const [{ data: ps }, { data: bl }, { data: rs }] = await Promise.all([
      supabase
        .from("pedidos")
        .select(
          "id, numero, modo, cliente_nome, cliente_telefone, endereco, observacoes, pagamento, troco_para, subtotal, taxa_entrega, total, tem_item_sob_consulta, status, motivo_cancelamento, cancelado_por, criado_em, pedido_itens ( nome, preco_unit, quantidade, detalhes )",
        )
        .order("criado_em", { ascending: false })
        .limit(60),
      supabase.from("clientes_bloqueados").select("telefone_hash, telefone_final, criado_em").order("criado_em", { ascending: false }),
      supabase.rpc("meus_pedidos_resumo", { p_dias: 30 }),
    ]);
    pedidosDaLoja = (ps ?? []) as unknown as PedidoDaLoja[];
    bloqueados = bl ?? [];
    resumoPedidos = rs as ResumoDePedidos;
  }
  let itensTocados: { item_id: string; nome: string; toques: number | string }[] = [];
  let qrSvg = "";
  let siteBase = "";
  let origens: { origem: string; visitas: number }[] = [];
  if (vendedor && aba === "compartilhar") {
    siteBase = await urlDoSite();
    qrSvg = await QRCode.toString(linkDoPerfil(siteBase, vendedor.id, "qr"), { type: "svg", margin: 1, width: 220 });
    const { data } = await supabase.rpc("visitas_por_origem", { p_dias: 30 });
    origens = ((data ?? []) as { origem: string; visitas: number | string }[]).map((r) => ({ origem: r.origem, visitas: Number(r.visitas) }));
  }
  if (vendedor && aba === "clientes") {
    const desde = trintaDiasAtras();
    const contar = async (tipo: string) =>
      (
        await supabase
          .from("eventos")
          .select("id", { count: "exact", head: true })
          .eq("vendedor_id", vendedor.id)
          .eq("tipo", tipo)
          .gte("created_at", desde)
      ).count ?? 0;
    const [v, c, l, { data: convs }, { data: pags }, { data: tocados }] = await Promise.all([
      contar("visita_vendedor"),
      contar("whatsapp"),
      contar("link_pedido"),
      supabase.rpc("meus_convites"),
      supabase
        .from("pagamentos")
        .select("id, valor, forma, dias, destaque_ate, created_at")
        .eq("vendedor_id", vendedor.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.rpc("meus_itens_tocados", { p_dias: 30 }),
    ]);
    itensTocados = (tocados ?? []) as typeof itensTocados;
    pagamentosDoVendedor = pags ?? [];
    visitas = v;
    contatos = c;
    toquesNoLink = l;
    convites = (convs ?? []) as typeof convites;
  }

  const contatoEquipe = (process.env.NEXT_PUBLIC_CONTATO_WHATSAPP ?? "").replace(/\D/g, "");

  const pendente = vendedor && !vendedor.ativo && !vendedor.aprovado_em;
  const suspenso = vendedor && !vendedor.ativo && vendedor.aprovado_em;

  // Os Termos ou a Política mudaram (ou nunca houve aceite registrado): só segue depois de aceitar a versão atual.
  if (perfil && precisaAceitarTermos(perfil.termos_versao, TERMOS_VERSAO)) {
    return (
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-12">
        <h1 className="font-serif text-2xl font-bold">Atualizamos nossos Termos</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Antes de continuar, leia e aceite a versão atual dos Termos de Uso e da Política de Privacidade (versão{" "}
          <strong>{TERMOS_VERSAO}</strong>, de {TERMOS_DATA}). Seu perfil e seus dados continuam como estão.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/termos" target="_blank" className="font-semibold text-orange-600 underline">
            Ler os Termos de Uso
          </Link>
          {" · "}
          <Link href="/privacidade" target="_blank" className="font-semibold text-orange-600 underline">
            Ler a Política de Privacidade
          </Link>
        </p>
        <AcaoForm action={aceitarTermos} rotulo="Aceitar e continuar" className="mt-6 space-y-4">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="aceite_termos" className="mt-0.5" />
            <span>Li e aceito os Termos de Uso e a Política de Privacidade (versão {TERMOS_VERSAO}).</span>
          </label>
        </AcaoForm>
        <form action={sair} className="mt-6">
          <button className="text-sm text-zinc-600 underline hover:text-zinc-900">Sair sem aceitar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">{vendedor?.nome ?? "Meu negócio"}</h1>
          <p className="mt-1 text-sm text-zinc-600">Conta: {perfil?.username ?? user.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/redefinir-senha" className="text-sm text-zinc-600 underline hover:text-zinc-900">
            Trocar senha
          </Link>
          <Link href="/feedback?de=/painel" className="text-sm text-zinc-600 underline hover:text-zinc-900">
            Ajuda
          </Link>
          <form action={sair}>
            <button className="text-sm text-zinc-600 underline hover:text-zinc-900">Sair</button>
          </form>
        </div>
      </header>

      {ehAdmin && (
        <p className="mt-3 rounded-xl bg-zinc-900 p-3 text-sm text-white">
          Você é administrador.{" "}
          <Link href="/admin" className="font-semibold underline">
            Abrir painel de administração
          </Link>
        </p>
      )}

      {pendente && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          ⏳ Seu cadastro está <strong>aguardando aprovação</strong>. Enquanto isso, você já pode preencher
          horários, menu e cardápio. Quando aprovarmos, seu negócio aparece no catálogo.
        </p>
      )}
      {suspenso && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Seu perfil está <strong>suspenso</strong> e não aparece no catálogo. Fale com a equipe do Sabor Local.
        </p>
      )}

      {vendedor && (
        <nav className="mt-6 flex gap-1 overflow-x-auto rounded-full bg-zinc-100 p-1" aria-label="Seções do painel">
          {ABAS.map(([id, rotulo]) => (
            <Link
              key={id}
              href={`/painel?aba=${id}`}
              className={`flex-1 whitespace-nowrap rounded-full px-4 py-2 text-center text-sm font-semibold ${
                aba === id ? "bg-white shadow-sm" : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {rotulo}
              {id === "pedidos" && pedidosNovos > 0 && (
                <span className="ml-1.5 rounded-full bg-orange-600 px-2 py-0.5 text-xs text-white" aria-label={`${pedidosNovos} pedidos novos`}>
                  {pedidosNovos}
                </span>
              )}
            </Link>
          ))}
        </nav>
      )}

      <div className="mt-6 space-y-6">
        {aba === "perfil" && (
          <section className="rounded-2xl border border-black/10 bg-white p-6">
            <AcaoForm
              action={salvarPerfil}
              rotulo={vendedor ? "Salvar" : "Cadastrar meu negócio"}
              className="grid gap-4"
            >
              <h2 className="font-serif text-lg font-bold">
                {vendedor ? "Seu perfil" : "Primeiro, cadastre seu negócio"}
              </h2>
              <label className="text-sm font-medium">
                Nome do negócio
                <input name="nome" required maxLength={60} defaultValue={vendedor?.nome} className={input} />
              </label>
              <label className="text-sm font-medium">
                Fale um pouco sobre vocês
                <textarea name="descricao" rows={3} maxLength={300} defaultValue={vendedor?.descricao ?? ""} className={input} />
              </label>
              <label className="text-sm font-medium">
                WhatsApp com DDD
                <CampoWhatsApp defaultValue={vendedor?.whatsapp} className={input} />
              </label>
              <label className="text-sm font-medium">
                Como atendem?
                <select name="modo_atendimento" defaultValue={vendedor?.modo_atendimento ?? "ambos"} className={input}>
                  <option value="ambos">Entrega e retirada</option>
                  <option value="entrega">Só entrega</option>
                  <option value="retirada">Só retirada</option>
                </select>
              </label>
              <CampoLocal
                cidades={cidades}
                bairros={bairros}
                bairroInicial={vendedor?.bairro_id}
                sugestaoInicial={vendedor?.bairro_sugerido}
                cidadeInicial={vendedor?.cidade_id}
              />
              {vendedor && !vendedor.bairro_id && vendedor.bairro_sugerido && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 sm:col-span-2">
                  Seu bairro <strong>&ldquo;{vendedor.bairro_sugerido}&rdquo;</strong> está esperando a conferência da equipe. Até lá,
                  o perfil mostra &ldquo;a confirmar&rdquo; e você não aparece no filtro por bairro.
                </p>
              )}
              {vendedor && !vendedor.bairro_id && !vendedor.bairro_sugerido && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">
                  Seu perfil está sem bairro (a sugestão anterior não foi aceita). Escolha um da lista ou sugira outro e salve.
                </p>
              )}
              <fieldset className="rounded-lg border border-black/10 p-3 text-sm sm:col-span-2">
                <legend className="px-1 font-medium">Já tem site ou cardápio online? (opcional)</legend>
                <p className="text-zinc-600">
                  Coloque o endereço e o botão aparece no seu perfil, ao lado do WhatsApp. Cada toque é contado.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr]">
                  <label className="font-medium">
                    Endereço do site de pedidos
                    <input
                      name="link_pedido"
                      defaultValue={vendedor?.link_pedido_url ?? ""}
                      inputMode="url"
                      autoCapitalize="none"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={300}
                      placeholder="meusite.com.br/cardapio"
                      className={input}
                    />
                  </label>
                  <label className="font-medium">
                    Texto do botão
                    <input
                      name="link_rotulo"
                      defaultValue={vendedor?.link_pedido_rotulo ?? ""}
                      maxLength={30}
                      placeholder={ROTULO_PADRAO_LINK_PEDIDO}
                      className={input}
                    />
                  </label>
                </div>
              </fieldset>
              <fieldset className="text-sm font-medium">
                <legend>Ramos (marque um ou mais)</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {categorias.map((c) => (
                    <label key={c.id} className="cursor-pointer">
                      <input
                        type="checkbox"
                        name="categoria_ids"
                        value={c.id}
                        defaultChecked={ramosSelecionados.includes(c.id)}
                        className="peer sr-only"
                      />
                      <span className="inline-block rounded-full border border-black/10 px-4 py-1.5 text-sm peer-checked:border-orange-600 peer-checked:bg-orange-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-orange-400">
                        {c.nome}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </AcaoForm>

            {vendedor && (
              <section className="mt-8 rounded-xl border border-black/10 p-4">
                <h3 className="text-sm font-semibold">Logo e banner</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Dê a cara do seu negócio ao perfil. É opcional: sem imagem, o perfil continua como está. Use fotos suas ou
                  de que você tem o direito de uso.
                </p>
                <div className="mt-4 grid gap-6">
                  <ImagemPerfil tipo="logo" vendedorId={vendedor.id} userId={user.id} urlAtual={vendedor.logo_url ?? null} />
                  <ImagemPerfil tipo="banner" vendedorId={vendedor.id} userId={user.id} urlAtual={vendedor.banner_url ?? null} />
                </div>
              </section>
            )}

            <section className="mt-8 rounded-xl border border-black/10 bg-zinc-50 p-4">
              <h3 className="text-sm font-semibold">Seus dados</h3>
              <p className="mt-1 text-sm text-zinc-600">
                Baixe uma cópia do que guardamos sobre você: conta, perfil, horários, menu, avaliações recebidas, pagamentos do
                destaque e o uso do seu perfil. O arquivo não inclui denúncias nem dados de outras pessoas.
              </p>
              <a
                href="/painel/exportar"
                download
                className="mt-3 inline-block rounded-full border border-zinc-900 px-4 py-2 text-sm font-semibold hover:bg-zinc-900 hover:text-white"
              >
                Baixar meus dados
              </a>
            </section>

            {vendedor && (
              <details className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-red-700">Excluir minha conta</summary>
                <p className="mt-2 text-sm text-red-800">
                  Isso apaga para sempre seu perfil, menu, horários, fotos, cardápio e o seu login. Não dá para
                  desfazer. Para confirmar, digite seu usuário (<strong>{perfil?.username ?? user.email}</strong>).
                </p>
                <AcaoForm
                  action={excluirConta}
                  rotulo="Excluir minha conta para sempre"
                  className="mt-3 grid gap-3"
                  botaoClassName="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  <input name="confirmacao" required autoComplete="off" placeholder="Digite seu usuário" className={input} />
                </AcaoForm>
              </details>
            )}
          </section>
        )}

        {vendedor && aba === "horarios" && (
          <>
            <section className="rounded-2xl border border-black/10 bg-white p-6">
              <h2 className="font-serif text-lg font-bold">Aviso aos clientes</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Vai fechar hoje ou viajar? Avise aqui e seu perfil mostra que você não está atendendo.
              </p>
              {vendedor.status_manual && vendedor.status_manual !== "normal" && (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  Aviso ativo: <strong>{vendedor.status_manual === "ferias" ? "De férias" : "Não abre hoje"}</strong>
                  {vendedor.status_manual_ate && vendedor.status_manual === "ferias"
                    ? ` (volta em ${formatarData(vendedor.status_manual_ate)})`
                    : ""}
                </p>
              )}
              <AcaoForm action={definirStatus} rotulo="Publicar aviso" className="mt-4 grid gap-3">
                <fieldset className="space-y-2 text-sm">
                  <legend className="sr-only">Situação</legend>
                  {[
                    ["normal", "Normal: sigo o meu horário"],
                    ["fechado_hoje", "Não abro hoje"],
                    ["ferias", "Estou de férias"],
                  ].map(([valor, rotulo]) => (
                    <label key={valor} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="status"
                        value={valor}
                        defaultChecked={(vendedor.status_manual ?? "normal") === valor}
                      />
                      {rotulo}
                    </label>
                  ))}
                </fieldset>
                <label className="text-sm font-medium">
                  Volto em (só para férias)
                  <input type="date" name="ate" min={hoje} defaultValue={vendedor.status_manual_ate ?? ""} className={input} />
                </label>
                <label className="text-sm font-medium">
                  Mensagem para os clientes (opcional)
                  <input
                    name="msg"
                    maxLength={140}
                    placeholder="Ex.: Voltamos com cardápio novo!"
                    defaultValue={vendedor.status_manual_msg ?? ""}
                    className={input}
                  />
                </label>
              </AcaoForm>
            </section>

            <section className="rounded-2xl border border-black/10 bg-white p-6">
              <AcaoForm action={salvarHorarios} rotulo="Salvar horários" className="space-y-3">
                <h2 className="font-serif text-lg font-bold">Horário de atendimento</h2>
                <HorariosCampos inicial={periodosPorDia} />
              </AcaoForm>
            </section>

            <section className="rounded-2xl border border-black/10 bg-white p-6">
              <h2 className="font-serif text-lg font-bold">Datas especiais</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Feriado, evento ou folga marcada: o horário da data vale no lugar do horário normal.
              </p>
              <ul className="mt-3 divide-y divide-black/10 text-sm">
                {excecoes.length === 0 && <li className="py-2 text-zinc-500">Nenhuma data especial.</li>}
                {excecoes.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <strong>{formatarData(e.data)}</strong>{" "}
                      {e.fechado ? "fechado o dia todo" : `${hhmm(e.abre)} às ${hhmm(e.fecha)}`}
                      {e.motivo ? ` · ${e.motivo}` : ""}
                    </span>
                    <form action={removerExcecao}>
                      <input type="hidden" name="id" value={e.id} />
                      <button className="text-red-600 hover:underline">Excluir</button>
                    </form>
                  </li>
                ))}
              </ul>
              <AcaoForm
                action={salvarExcecao}
                rotulo="Salvar data"
                limpar
                className="mt-4 grid gap-3 border-t border-black/10 pt-4 sm:grid-cols-3"
              >
                <label className="text-sm font-medium sm:col-span-3">
                  Data
                  <input type="date" name="data" required min={hoje} className={input} />
                </label>
                <label className="flex items-center gap-2 text-sm sm:col-span-3">
                  <input type="checkbox" name="fechado" /> Fechado o dia todo
                </label>
                <label className="text-sm font-medium">
                  Abre às
                  <CampoHora name="abre" rotulo="Abre às" className={`${input} text-center`} />
                </label>
                <label className="text-sm font-medium">
                  Fecha às
                  <CampoHora name="fecha" rotulo="Fecha às" className={`${input} text-center`} />
                </label>
                <label className="text-sm font-medium">
                  Motivo (opcional)
                  <input name="motivo" maxLength={100} placeholder="Ex.: Feriado" className={input} />
                </label>
              </AcaoForm>
            </section>
          </>
        )}

        {vendedor && aba === "menu" && (
          <section className="rounded-2xl border border-black/10 bg-white p-6">
            <h2 className="font-serif text-lg font-bold">Menu</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Acabou um produto? Toque em <strong>Indisponível hoje</strong>: ele continua no seu perfil, esmaecido e com um aviso, e volta sozinho amanhã. Use <strong>Sem previsão</strong> se não sabe quando volta.
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              <strong>★ Destaque da casa:</strong> escolha até {MAX_DESTAQUES_DA_CASA} itens para aparecerem no topo do seu perfil
              ({itens.filter((i) => i.destaque).length} de {MAX_DESTAQUES_DA_CASA} escolhidos). O selo <strong>Mais pedido</strong> não é
              escolha sua: aparece sozinho nos itens que mais recebem toques em &ldquo;Pedir&rdquo;.
            </p>
            <section className="mt-5 rounded-xl border border-black/10 bg-zinc-50 p-4" aria-labelledby="categorias-do-menu">
              <h3 id="categorias-do-menu" className="text-sm font-semibold">
                Categorias do menu <span className="font-normal text-zinc-500">(opcional)</span>
              </h3>
              <p className="mt-1 text-sm text-zinc-600">
                Organize o menu em grupos como <strong>Bebidas</strong>, <strong>Salgados</strong>, <strong>Doces</strong>, <strong>Xis</strong> ou{" "}
                <strong>Cachorro quente</strong>. O cliente vê o seu menu em seções e pode filtrar a busca por tipo de produto. Se não quiser,
                é só não criar nenhuma. As categorias são só da sua loja.
              </p>
              {categoriasDoMenu.length > 0 && (
                <ul className="mt-3 divide-y divide-black/10 rounded-xl border border-black/10 bg-white">
                  {categoriasDoMenu.map((cat, i) => (
                    <li key={cat.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                      <div className="flex gap-1">
                        <form action={moverCategoria}>
                          <input type="hidden" name="id" value={cat.id} />
                          <input type="hidden" name="direcao" value="subir" />
                          <button disabled={i === 0} aria-label={`Subir ${cat.nome}`} className="rounded-full border border-black/10 px-2.5 py-1 disabled:opacity-30">
                            ↑
                          </button>
                        </form>
                        <form action={moverCategoria}>
                          <input type="hidden" name="id" value={cat.id} />
                          <input type="hidden" name="direcao" value="descer" />
                          <button
                            disabled={i === categoriasDoMenu.length - 1}
                            aria-label={`Descer ${cat.nome}`}
                            className="rounded-full border border-black/10 px-2.5 py-1 disabled:opacity-30"
                          >
                            ↓
                          </button>
                        </form>
                      </div>
                      <AcaoForm
                        action={renomearCategoria}
                        rotulo="Renomear"
                        className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                        botaoClassName="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        <input type="hidden" name="id" value={cat.id} />
                        <input
                          name="nome"
                          defaultValue={cat.nome}
                          required
                          maxLength={30}
                          aria-label={`Nome da categoria ${cat.nome}`}
                          className="min-w-0 flex-1 rounded-lg border border-black/10 px-3 py-1.5"
                        />
                      </AcaoForm>
                      <span className="text-xs text-zinc-500">
                        {itens.filter((it) => it.categoria_produto_id === cat.id).length} itens
                      </span>
                      <form action={removerCategoria}>
                        <input type="hidden" name="id" value={cat.id} />
                        <button className="text-xs text-red-600 hover:underline" title="Os itens ficam sem categoria">
                          Remover
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              {categoriasDoMenu.length < MAX_CATEGORIAS_POR_LOJA ? (
                <AcaoForm
                  action={adicionarCategoria}
                  rotulo="Criar categoria"
                  limpar
                  className="mt-3 grid gap-3"
                  botaoClassName="w-fit rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                >
                  <CampoNovaCategoria jaTem={categoriasDoMenu.map((c) => c.nome)} />
                </AcaoForm>
              ) : (
                <p className="mt-3 text-sm text-zinc-600">Você chegou ao máximo de {MAX_CATEGORIAS_POR_LOJA} categorias.</p>
              )}
            </section>

            <PainelMontaveis montaveis={montaveisDoMenu} categorias={categoriasDoMenu} itens={itens} />

            <ul className="mt-4 divide-y divide-black/10">
              {itens.length === 0 && <li className="py-3 text-sm text-zinc-500">Nenhum item ainda.</li>}
              {itens.map((item) => (
                <li key={item.id} className="space-y-2 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className={disponibilidadeDoItem(item, hoje) !== "disponivel" ? "opacity-60" : ""}>
                      <p className="font-medium">{item.nome}</p>
                      {item.descricao && <p className="text-zinc-600">{item.descricao}</p>}
                      {item.preco != null && (
                        <p className="font-semibold">
                          {Number(item.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <div className="flex flex-col items-end gap-1.5">
                        {seloIndisponivel(disponibilidadeDoItem(item, hoje)) && (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                            {seloIndisponivel(disponibilidadeDoItem(item, hoje))}
                          </span>
                        )}
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <form action={alternarDestaque}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="destaque" value={item.destaque ? "false" : "true"} />
                            <button
                              disabled={!item.destaque && itens.filter((i) => i.destaque).length >= MAX_DESTAQUES_DA_CASA}
                              title={
                                !item.destaque && itens.filter((i) => i.destaque).length >= MAX_DESTAQUES_DA_CASA
                                  ? `Você já escolheu ${MAX_DESTAQUES_DA_CASA}. Tire um destaque para escolher outro.`
                                  : undefined
                              }
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                                item.destaque ? "bg-amber-200 text-amber-900" : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                              }`}
                            >
                              {item.destaque ? "★ Destaque da casa" : "☆ Destacar"}
                            </button>
                          </form>
                          {disponibilidadeDoItem(item, hoje) !== "disponivel" ? (
                            <form action={alternarDisponivel}>
                              <input type="hidden" name="id" value={item.id} />
                              <input type="hidden" name="modo" value="disponivel" />
                              <button className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">Voltar a ter</button>
                            </form>
                          ) : (
                            <form action={alternarDisponivel}>
                              <input type="hidden" name="id" value={item.id} />
                              <input type="hidden" name="modo" value="hoje" />
                              <button className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white">Indisponível hoje</button>
                            </form>
                          )}
                          {disponibilidadeDoItem(item, hoje) !== "indisponivel" && (
                            <form action={alternarDisponivel}>
                              <input type="hidden" name="id" value={item.id} />
                              <input type="hidden" name="modo" value="sem_previsao" />
                              <button className="rounded-full bg-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700">Sem previsão</button>
                            </form>
                          )}
                        </div>
                      </div>
                      <form action={removerItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <button className="text-red-600 hover:underline">Excluir</button>
                      </form>
                    </div>
                  </div>
                  <CategoriaDoItem
                    itemId={item.id}
                    categoriaAtual={item.categoria_produto_id ?? null}
                    categorias={categoriasDoMenu}
                    nomeDoItem={item.nome}
                  />
                  <ItemFoto itemId={item.id} userId={user.id} fotoAtual={item.foto_url} />
                </li>
              ))}
            </ul>

            <AcaoForm
              action={adicionarItem}
              rotulo="Adicionar"
              limpar
              className="mt-5 grid gap-3 border-t border-black/10 pt-5 sm:grid-cols-[1fr_9rem]"
            >
              <h3 className="text-sm font-semibold sm:col-span-2">Adicionar item</h3>
              <input name="nome" required maxLength={80} placeholder="Nome (ex.: X-Burguer)" className={input} />
              <input name="preco" inputMode="decimal" placeholder="Preço (ex.: 25,90)" className={input} />
              <input name="descricao" maxLength={200} placeholder="O que vem nele? (opcional)" className={`${input} sm:col-span-2`} />
              {categoriasDoMenu.length > 0 && (
                <label className="text-sm font-medium sm:col-span-2">
                  Categoria (opcional)
                  <select name="categoria_id" defaultValue="" className={input}>
                    <option value="">Sem categoria</option>
                    {categoriasDoMenu.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </AcaoForm>
          </section>
        )}

        {vendedor && aba === "cardapio" && (
          <section className="rounded-2xl border border-black/10 bg-white p-6">
            <h2 className="font-serif text-lg font-bold">Cardápio completo</h2>
            <p className="mb-4 mt-1 text-sm text-zinc-600">
              Já tem o cardápio pronto em PDF ou em foto? Envie aqui e ele aparece no seu perfil.
            </p>
            <CardapioUpload
              vendedorId={vendedor.id}
              userId={user.id}
              urlAtual={vendedor.cardapio_url ?? null}
              tipoAtual={vendedor.cardapio_tipo ?? null}
            />
          </section>
        )}

        {vendedor && aba === "pedidos" && (
          <>
            <AtualizarSozinho />
            <section className="rounded-2xl border border-black/10 bg-white p-6">
              <h2 className="font-serif text-lg font-bold">Receber pedidos pelo site</h2>
              <p className="mt-1 text-sm text-zinc-600">
                O cliente monta o pedido no seu perfil, informa entrega ou retirada, o meio de pagamento e observações. Você vê tudo aqui
                e muda o andamento; o cliente acompanha por um link. <strong>O site não cobra nem recebe dinheiro</strong>: o pagamento é
                direto entre você e o cliente. O pedido só entra com a sua loja <strong>aberta</strong> (confira a aba Horários).
              </p>
              {!vendedor.ativo && (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  Os pedidos só aparecem para os clientes depois que o seu perfil estiver aprovado e no ar.
                </p>
              )}
              <AcaoForm action={salvarConfigPedidos} rotulo="Salvar" className="mt-4 grid gap-4">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/10 p-3 has-[:checked]:border-green-600 has-[:checked]:bg-green-50">
                  <input type="checkbox" name="aceita_pedidos" defaultChecked={Boolean(vendedor.aceita_pedidos)} className="mt-1 h-5 w-5" />
                  <span>
                    <strong>Quero receber pedidos pelo site</strong>
                    <span className="block text-sm text-zinc-600">
                      Desligado, o seu perfil continua só com o botão do WhatsApp. Entrega e retirada seguem o que você marcou em Perfil
                      &rarr; &ldquo;Como atendem?&rdquo;.
                    </span>
                  </span>
                </label>
                <fieldset className="text-sm">
                  <legend className="font-medium">Que meios de pagamento você aceita?</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {FORMAS_PAGAMENTO.map((f) => (
                      <label key={f} className="cursor-pointer">
                        <input
                          type="checkbox"
                          name="pagamentos"
                          value={f}
                          defaultChecked={(vendedor.pagamentos_aceitos ?? ["pix", "dinheiro", "cartao"]).includes(f)}
                          className="peer sr-only"
                        />
                        <span className="inline-block rounded-full border border-black/10 px-4 py-1.5 peer-checked:border-orange-600 peer-checked:bg-orange-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-orange-400">
                          {ROTULOS_PAGAMENTO[f]}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="text-sm font-medium">
                  Taxa de entrega (opcional)
                  <input
                    name="taxa_entrega"
                    inputMode="decimal"
                    defaultValue={Number(vendedor.taxa_entrega ?? 0) > 0 ? String(vendedor.taxa_entrega).replace(".", ",") : ""}
                    placeholder="Ex.: 5 ou 5,50. Em branco = entrega grátis"
                    className={input}
                  />
                </label>
              </AcaoForm>
            </section>

            {resumoPedidos && (
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumo dos últimos 30 dias">
                {[
                  [resumoPedidos.pedidos, "pedidos (30 dias)"],
                  [resumoPedidos.concluidos, "concluídos"],
                  [resumoPedidos.cancelados, "cancelados"],
                  [brl(Number(resumoPedidos.valor_concluido)), "em pedidos concluídos"],
                ].map(([valor, rotulo]) => (
                  <div key={String(rotulo)} className="rounded-2xl border border-black/10 bg-white p-4 text-center">
                    <p className="font-serif text-2xl font-bold">{valor}</p>
                    <p className="text-xs text-zinc-600">{rotulo}</p>
                  </div>
                ))}
              </section>
            )}

            <section>
              <h2 className="font-serif text-lg font-bold">Em andamento</h2>
              <ul className="mt-3 space-y-3">
                {pedidosDaLoja.filter((p) => pedidoAberto(p.status)).length === 0 && (
                  <li className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-zinc-500">
                    Nenhum pedido em andamento. Quando chegar um, ele aparece aqui sozinho.
                  </li>
                )}
                {pedidosDaLoja
                  .filter((p) => pedidoAberto(p.status))
                  .sort((a, b) => (a.status === "novo" ? 0 : 1) - (b.status === "novo" ? 0 : 1) || a.criado_em.localeCompare(b.criado_em))
                  .map((p) => (
                    <PedidoCard key={p.id} pedido={p} nomeDaLoja={vendedor.nome} />
                  ))}
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-lg font-bold">Encerrados</h2>
              <ul className="mt-3 space-y-3">
                {pedidosDaLoja.filter((p) => !pedidoAberto(p.status)).length === 0 && (
                  <li className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-zinc-500">Nenhum pedido encerrado ainda.</li>
                )}
                {pedidosDaLoja
                  .filter((p) => !pedidoAberto(p.status))
                  .map((p) => (
                    <PedidoCard key={p.id} pedido={p} nomeDaLoja={vendedor.nome} />
                  ))}
              </ul>
              <p className="mt-3 text-xs text-zinc-500">
                Por privacidade, nome, telefone e endereço do cliente saem do pedido 90 dias depois que ele é encerrado. Os valores ficam
                para os seus números.
              </p>
            </section>

            {bloqueados.length > 0 && (
              <section className="rounded-2xl border border-black/10 bg-white p-6">
                <h2 className="font-serif text-lg font-bold">Telefones bloqueados</h2>
                <ul className="mt-3 divide-y divide-black/10 text-sm">
                  {bloqueados.map((b) => (
                    <li key={b.telefone_hash} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        Telefone terminado em <strong>{b.telefone_final}</strong>
                      </span>
                      <form action={desbloquearCliente}>
                        <input type="hidden" name="hash" value={b.telefone_hash} />
                        <button className="text-red-600 hover:underline">Desbloquear</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {vendedor && aba === "clientes" && (
          <>
            <section className={`grid grid-cols-2 gap-3 ${vendedor.link_pedido_url ? "sm:grid-cols-3" : ""}`}>
              <div className="rounded-2xl border border-black/10 bg-white p-5 text-center">
                <p className="font-serif text-3xl font-bold text-orange-600">{visitas}</p>
                <p className="text-xs text-zinc-600">visitas ao seu perfil (30 dias)</p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white p-5 text-center">
                <p className="font-serif text-3xl font-bold text-green-600">{contatos}</p>
                <p className="text-xs text-zinc-600">toques no WhatsApp (30 dias)</p>
              </div>
              {vendedor.link_pedido_url && (
                <div className="col-span-2 rounded-2xl border border-black/10 bg-white p-5 text-center sm:col-span-1">
                  <p className="font-serif text-3xl font-bold text-blue-600">{toquesNoLink}</p>
                  <p className="text-xs text-zinc-600">toques no seu site de pedidos (30 dias)</p>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-black/10 bg-white p-6">
              <h2 className="font-serif text-lg font-bold">Itens mais tocados (30 dias)</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Quantas vezes clientes tocaram em <strong>Pedir</strong> em cada item. O selo <strong>Mais pedido</strong> aparece no
                perfil para quem passa de 5 toques de pessoas diferentes no mês. Repetir o toque na mesma hora não conta de novo.
              </p>
              <ol className="mt-3 divide-y divide-black/10 text-sm">
                {itensTocados.length === 0 && (
                  <li className="py-2 text-zinc-500">Ainda não houve toques em &ldquo;Pedir&rdquo; nos seus itens.</li>
                )}
                {itensTocados.map((t) => (
                  <li key={t.item_id} className="flex items-center justify-between gap-3 py-2">
                    <span>{t.nome}</span>
                    <span className="font-semibold">
                      {Number(t.toques)} {Number(t.toques) === 1 ? "toque" : "toques"}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-2xl border border-black/10 bg-white p-6">
              <h2 className="font-serif text-lg font-bold">Convidar cliente para avaliar</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Depois de entregar um pedido, digite o <strong>e-mail do cliente</strong>. O Sabor Local envia um link único
                direto para ele, e <strong>você não vê o link</strong>: assim a avaliação é de quem comprou. O convite vale 30
                dias e uma vez; o mesmo e-mail só recebe um convite seu a cada 30 dias.
              </p>
              <AcaoForm action={convidarParaAvaliar} rotulo="Enviar convite" limpar className="mt-4 grid gap-3">
                <label className="text-sm font-medium">
                  E-mail do cliente
                  <input
                    name="email"
                    type="email"
                    required
                    inputMode="email"
                    autoComplete="off"
                    autoCapitalize="none"
                    maxLength={254}
                    placeholder="cliente@email.com"
                    className={input}
                  />
                </label>
              </AcaoForm>
              <ul className="mt-4 divide-y divide-black/10 text-sm">
                {convites.length === 0 && <li className="py-2 text-zinc-500">Nenhum convite enviado ainda.</li>}
                {convites.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="font-mono">{c.email_mascarado}</span>
                    <span className="flex items-center gap-3 text-xs">
                      <span
                        className={
                          c.estado === "avaliou" ? "text-green-700" : c.estado === "pendente" ? "text-orange-600" : "text-zinc-500"
                        }
                      >
                        {{ avaliou: "Avaliou", pendente: "Aguardando", expirado: "Venceu", cancelado: "Cancelado" }[c.estado] ?? c.estado}
                      </span>
                      {c.estado === "pendente" && (
                        <form action={cancelarConvite}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="text-red-600 hover:underline">Cancelar</button>
                        </form>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-black/10 bg-white p-6">
              <h2 className="font-serif text-lg font-bold">Destaque no catálogo</h2>
              {vendedor.destaque_ate && new Date(vendedor.destaque_ate) > new Date() ? (
                <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  ★ Seu perfil está em destaque até{" "}
                  <strong>
                    {new Date(vendedor.destaque_ate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </strong>
                  : aparece primeiro na busca, com o selo “Destaque”.
                </p>
              ) : (
                <p className="mt-2 text-sm text-zinc-600">
                  Quer aparecer primeiro na busca, com o selo “Destaque”? Fale com a equipe do Sabor Local. O pagamento
                  é combinado direto (Pix ou dinheiro) e o destaque é ativado por nós.
                </p>
              )}
              {contatoEquipe && (
                <a
                  href={`https://wa.me/${contatoEquipe}?text=${encodeURIComponent(`Olá! Quero destacar o perfil ${vendedor.nome} no Sabor Local.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  Falar com a equipe no WhatsApp
                </a>
              )}
              {pagamentosDoVendedor.length > 0 && (
                <ul className="mt-4 divide-y divide-black/10 text-sm">
                  {pagamentosDoVendedor.map((p) => (
                    <li key={p.id} className="flex justify-between py-2">
                      <span>
                        {p.dias} dias ·{" "}
                        {p.forma === "cortesia"
                          ? "cortesia"
                          : Number(p.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                      <span className="text-zinc-500">
                        {new Date(p.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-center text-sm text-zinc-600">
              Quer divulgar seu perfil? Veja a aba{" "}
              <Link href="/painel?aba=compartilhar" className="font-semibold text-orange-600 underline">
                Compartilhar
              </Link>{" "}
              (WhatsApp, Facebook, QR code e de onde vêm as visitas).
            </p>
          </>
        )}

        {vendedor && aba === "compartilhar" && (
          <>
            <CompartilharPainel
              nome={vendedor.nome}
              mensagemInicial={mensagemPadrao(vendedor.nome)}
              links={{
                whatsapp: linkDoPerfil(siteBase, vendedor.id, "whatsapp"),
                facebook: linkDoPerfil(siteBase, vendedor.id, "facebook"),
                instagram: linkDoPerfil(siteBase, vendedor.id, "instagram"),
                link: linkDoPerfil(siteBase, vendedor.id, "link"),
                qr: linkDoPerfil(siteBase, vendedor.id, "qr"),
              }}
              qrSvg={qrSvg}
            />

            <section className="rounded-2xl border border-black/10 bg-white p-6">
              <h2 className="font-serif text-lg font-bold">De onde vêm suas visitas</h2>
              <p className="mt-1 text-sm text-zinc-600">Últimos 30 dias. Só conta quem entrou por um dos links acima.</p>
              <ul className="mt-3 divide-y divide-black/10 text-sm">
                {origens.length === 0 && <li className="py-2 text-zinc-500">Ainda não há visitas nos últimos 30 dias.</li>}
                {origens.map((o) => (
                  <li key={o.origem} className="flex justify-between py-2">
                    <span>{ROTULOS_ORIGEM[o.origem as Origem | "direto"] ?? o.origem}</span>
                    <strong>{o.visitas}</strong>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
