import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { formatarData } from "@/lib/horarios";
import { AcaoForm } from "@/components/AcaoForm";
import { linkNovaIssue, linkResposta, saudeDoCanal, type SaudeDoCanal } from "@/lib/feedback";
import { META_PERFIS_COMPLETOS, progressoMeta, ROTULOS_SITUACAO, situacaoDaCidade, type SituacaoCidade } from "@/lib/metas";
import { lerContagemFeedback, lerResumoCidades, TIPOS_FEEDBACK, type Configuracoes } from "@/lib/validacao";
import {
  adicionarBairro,
  alternarCidade,
  alternarVendedor,
  atualizarCidade,
  criarCidade,
  limparAviso,
  alternarBairro,
  removerImagemPerfil,
  removerLinkPedido,
  renomearBairro,
  moderarAvaliacao,
  registrarPagamento,
  removerDestaque,
  salvarConfiguracoes,
  tratarDenuncia,
  tratarFeedback,
  tratarSugestaoBairro,
  unirBairros,
} from "./actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

const ABAS = [
  ["resumo", "Resumo"],
  ["vendedores", "Vendedores"],
  ["denuncias", "Denúncias"],
  ["feedback", "Feedback"],
  ["avaliacoes", "Avaliações"],
  ["cidades", "Cidades"],
  ["financeiro", "Financeiro"],
  ["historico", "Histórico"],
  ["configuracoes", "Configurações"],
] as const;
type Aba = (typeof ABAS)[number][0];

const MOTIVOS: Record<string, string> = {
  informacao_falsa: "Informação falsa",
  conteudo_improprio: "Conteúdo impróprio",
  golpe: "Suspeita de golpe",
  avaliacao_falsa: "Avaliação falsa",
  outro: "Outro",
};

const ENTIDADES: Record<string, string> = {
  vendedores: "Perfil",
  itens_cardapio: "Menu",
  horarios_funcionamento: "Horários",
  excecoes_horario: "Data especial",
  avaliacoes: "Avaliação",
  denuncias: "Denúncia",
  pagamentos: "Pagamento",
  pedidos: "Pedido",
};

const ACOES: Record<string, string> = {
  insert: "criou",
  update: "alterou",
  delete: "removeu",
  atualizar_horarios: "atualizou",
};

const CORES_SITUACAO: Record<SituacaoCidade, string> = {
  pausada: "bg-zinc-200 text-zinc-700",
  pronta: "bg-green-100 text-green-700",
  atencao: "bg-red-100 text-red-700",
  montando: "bg-amber-100 text-amber-800",
};

const btn = "rounded-full px-3 py-1.5 text-xs font-semibold";
const reais = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const campoCls = "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm";
const card = "rounded-2xl border border-black/10 bg-white p-4 text-sm";

interface Resumo {
  visitas_site_30d: number;
  visitas_vendedor_30d: number;
  cliques_whatsapp_30d: number;
  vendedores_ativos: number;
  vendedores_pendentes: number;
  vendedores_suspensos: number;
  denuncias_abertas: number;
  avaliacoes_pendentes: number;
  avaliacoes_total: number;
  destaques_ativos: number;
  pagantes_ativos: number;
  receita_30d: number;
}

interface VendedorAdmin {
  id: string;
  nome: string;
  whatsapp: string;
  ativo: boolean;
  aprovado_em: string | null;
  status_manual: string;
  status_manual_ate: string | null;
  created_at: string;
  username: string | null;
  email: string | null;
  bairro: string | null;
  itens: number;
  visitas_30d: number;
  cliques_30d: number;
  destaque_ate: string | null;
  cidade: string | null;
}

interface CidadeAdmin {
  id: string;
  nome: string;
  uf: string | null;
  slug: string;
  ativa: boolean;
  bairros: number;
  vendedores: number;
}

interface ResumoPedidos {
  lojas_aceitando: number;
  pedidos: number;
  concluidos: number;
  cancelados: number;
  valor_concluido: number | string;
  lojas: { id: string; nome: string; pedidos: number; concluidos: number; valor_concluido: number | string }[];
}

interface BairroLinha {
  id: string;
  nome: string;
  cidade_id: string;
  ativo: boolean;
}

interface SugestaoBairro {
  id: string;
  nome: string;
  cidade_id: string;
  cidade_nome: string;
  vendedor_nome: string;
  criado_em: string;
  iguais: number | string;
}

interface Pagamento {
  id: string;
  created_at: string;
  vendedor_nome: string | null;
  valor: number;
  forma: string;
  dias: number;
  destaque_ate: string;
  observacao: string | null;
  registrado_por: string;
}

interface Denuncia {
  id: string;
  motivo: string;
  descricao: string | null;
  contato: string | null;
  vendedor: { id: string; nome: string; ativo: boolean } | null;
  avaliacao: { id: string; nota: number; comentario: string | null } | null;
}

interface FeedbackAdmin {
  id: string;
  tipo: "problema" | "sugestao" | "duvida";
  mensagem: string;
  pagina: string | null;
  contato: string | null;
  status: "novo" | "aceito";
  issue_url: string | null;
  created_at: string;
}

interface AvaliacaoPendente {
  id: string;
  nota: number;
  comentario: string | null;
  autor_nome: string | null;
  vendedor: { nome: string } | null;
}

interface Evento {
  id: number;
  created_at: string;
  acao: string;
  entidade: string;
  vendedor_id: string | null;
  vendedor_nome: string | null;
  ator: string;
  dados: Record<string, unknown> | null;
}

function Numero({
  valor,
  rotulo,
  destaque,
  texto,
}: {
  valor: number;
  rotulo: string;
  destaque?: boolean;
  texto?: string;
}) {
  return (
    <div className={`${card} text-center ${destaque && valor > 0 ? "border-orange-400 bg-orange-50" : ""}`}>
      <p className="font-serif text-3xl font-bold">{texto ?? valor}</p>
      <p className="text-xs text-zinc-600">{rotulo}</p>
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; vendedor?: string }>;
}) {
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: ehAdmin } = await supabase.rpc("is_admin");
  if (!ehAdmin) redirect("/painel");

  const { aba: abaParam, vendedor: vendedorFiltro } = await searchParams;
  const aba: Aba = ABAS.find(([id]) => id === abaParam)?.[0] ?? "resumo";

  // Sempre busca o resumo: alimenta os contadores das abas
  const { data: resumoRaw } = await supabase.rpc("admin_resumo");
  const resumo = resumoRaw as Resumo;

  const { count: feedbacksNovos } = await supabase
    .from("feedbacks")
    .select("id", { count: "exact", head: true })
    .eq("status", "novo");

  const { data: sugestoesRaw } = await supabase.rpc("admin_bairros_sugeridos");
  const sugestoes = (sugestoesRaw ?? []) as SugestaoBairro[];

  const contadores: Partial<Record<Aba, number>> = {
    cidades: sugestoes.length,
    vendedores: resumo.vendedores_pendentes,
    denuncias: resumo.denuncias_abertas,
    feedback: feedbacksNovos ?? 0,
    avaliacoes: resumo.avaliacoes_pendentes,
  };

  let vendedores: VendedorAdmin[] = [];
  let denuncias: Denuncia[] = [];
  let avaliacoes: AvaliacaoPendente[] = [];
  let feedbacks: FeedbackAdmin[] = [];
  let resumoCidades: ReturnType<typeof lerResumoCidades> = [];
  let canal: SaudeDoCanal | null = null;
  let canalPorSituacao = { novo: 0, aceito: 0, recusado: 0, resolvido: 0 };
  const linksDePedido = new Map<string, string>();
  const imagensDoPerfil = new Map<string, { logo: string | null; banner: string | null }>();
  let historico: Evento[] = [];
  let configuracoes: (Configuracoes & { atualizado_em: string }) | null = null;
  let pagamentos: Pagamento[] = [];
  let cidades: CidadeAdmin[] = [];
  let bairros: BairroLinha[] = [];
  const vendedoresPorBairro = new Map<string, number>();

  let resumoPedidos: ResumoPedidos | null = null;

  if (aba === "resumo") {
    resumoPedidos = ((await supabase.rpc("admin_pedidos_resumo", { p_dias: 30 })).data ?? null) as ResumoPedidos | null;
    resumoCidades = lerResumoCidades((await supabase.rpc("admin_resumo_cidades")).data);
    const { data: situacoes } = await supabase.from("feedbacks").select("status").limit(5000);
    canalPorSituacao = lerContagemFeedback(situacoes);
    canal = saudeDoCanal(canalPorSituacao);
  } else if (aba === "vendedores") {
    vendedores = ((await supabase.rpc("admin_vendedores")).data ?? []) as VendedorAdmin[];
    const { data: comLink } = await supabase.from("vendedores").select("id, link_pedido_url").not("link_pedido_url", "is", null);
    for (const l of comLink ?? []) linksDePedido.set(l.id as string, l.link_pedido_url as string);
    const { data: comImagem } = await supabase
      .from("vendedores")
      .select("id, logo_url, banner_url")
      .or("logo_url.not.is.null,banner_url.not.is.null");
    for (const i of comImagem ?? []) {
      imagensDoPerfil.set(i.id as string, { logo: i.logo_url as string | null, banner: i.banner_url as string | null });
    }
  } else if (aba === "denuncias") {
    const { data } = await supabase
      .from("denuncias")
      .select(
        "id, motivo, descricao, contato, vendedor:vendedores ( id, nome, ativo ), avaliacao:avaliacoes ( id, nota, comentario )",
      )
      .eq("status", "aberta")
      .order("created_at");
    denuncias = (data ?? []) as unknown as Denuncia[];
  } else if (aba === "feedback") {
    const { data } = await supabase
      .from("feedbacks")
      .select("id, tipo, mensagem, pagina, contato, status, issue_url, created_at")
      .in("status", ["novo", "aceito"])
      .order("created_at");
    feedbacks = (data ?? []) as FeedbackAdmin[];
  } else if (aba === "avaliacoes") {
    const { data } = await supabase
      .from("avaliacoes")
      .select("id, nota, comentario, autor_nome, vendedor:vendedores ( nome )")
      .eq("aprovada", false)
      .order("created_at");
    avaliacoes = (data ?? []) as unknown as AvaliacaoPendente[];
  } else if (aba === "configuracoes") {
    const { data } = await supabase
      .from("configuracoes")
      .select("avaliacoes_exigem_aprovacao, vendedores_exigem_aprovacao, atualizado_em")
      .eq("id", true)
      .maybeSingle();
    configuracoes = data;
  } else if (aba === "cidades") {
    const [{ data: c }, { data: b }] = await Promise.all([
      supabase.rpc("admin_cidades"),
      supabase.from("bairros").select("id, nome, cidade_id, ativo").order("nome"),
    ]);
    cidades = (c ?? []) as CidadeAdmin[];
    bairros = (b ?? []) as BairroLinha[];
    const { data: usos } = await supabase.from("vendedores").select("bairro_id").not("bairro_id", "is", null);
    for (const u of usos ?? []) vendedoresPorBairro.set(u.bairro_id as string, (vendedoresPorBairro.get(u.bairro_id as string) ?? 0) + 1);
  } else if (aba === "financeiro") {
    pagamentos = ((await supabase.rpc("admin_pagamentos", { p_limite: 100 })).data ?? []) as Pagamento[];
  } else if (aba === "historico") {
    const { data } = await supabase.rpc("admin_historico", {
      p_vendedor: vendedorFiltro ?? null,
      p_limite: 150,
    });
    historico = (data ?? []) as Evento[];
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <header>
        <h1 className="font-serif text-2xl font-bold">Administração</h1>
        <p className="mt-1 text-sm text-zinc-600">
          <Link href="/painel" className="underline">
            Voltar ao painel
          </Link>
        </p>
      </header>

      <nav className="mt-6 flex gap-1 overflow-x-auto rounded-full bg-zinc-100 p-1" aria-label="Seções da administração">
        {ABAS.map(([id, rotulo]) => (
          <Link
            key={id}
            href={`/admin?aba=${id}`}
            className={`flex-1 whitespace-nowrap rounded-full px-4 py-2 text-center text-sm font-semibold ${
              aba === id ? "bg-white shadow-sm" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {rotulo}
            {contadores[id] ? (
              <span className="ml-1.5 rounded-full bg-orange-600 px-1.5 py-0.5 text-[10px] text-white">
                {contadores[id]}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      <div className="mt-6 space-y-4">
        {aba === "resumo" && (
          <>
            <section>
              <h2 className="font-serif text-lg font-bold">Precisa de atenção</h2>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <Numero valor={resumo.vendedores_pendentes} rotulo="vendedores para aprovar" destaque />
                <Numero valor={resumo.denuncias_abertas} rotulo="denúncias abertas" destaque />
                <Numero valor={resumo.avaliacoes_pendentes} rotulo="avaliações para aprovar" destaque />
              </div>
            </section>
            <section>
              <h2 className="font-serif text-lg font-bold">Últimos 30 dias</h2>
              <p className="text-xs text-zinc-500">Metas do roadmap (6º mês): 500 visitas e 100 contatos por mês.</p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <Numero valor={resumo.visitas_site_30d} rotulo="visitas ao catálogo" />
                <Numero valor={resumo.visitas_vendedor_30d} rotulo="visitas a perfis" />
                <Numero valor={resumo.cliques_whatsapp_30d} rotulo="toques no WhatsApp" />
              </div>
            </section>
            <section>
              <h2 className="font-serif text-lg font-bold">Plano destaque</h2>
              <p className="text-xs text-zinc-500">Meta da Fase 3: pelo menos 5 vendedores pagantes.</p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <Numero valor={resumo.pagantes_ativos} rotulo="pagantes ativos" />
                <Numero valor={resumo.destaques_ativos} rotulo="perfis em destaque" />
                <Numero valor={resumo.receita_30d} texto={reais(resumo.receita_30d)} rotulo="recebido em 30 dias" />
              </div>
            </section>
            {resumoPedidos && (
              <section>
                <h2 className="font-serif text-lg font-bold">Pedidos pelo site (30 dias)</h2>
                <p className="text-xs text-zinc-500">
                  Só números: o administrador não vê nome, telefone nem endereço de clientes. {resumoPedidos.lojas_aceitando} loja(s) com pedidos ligados.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Numero valor={resumoPedidos.pedidos} rotulo="pedidos" />
                  <Numero valor={resumoPedidos.concluidos} rotulo="concluídos" />
                  <Numero valor={resumoPedidos.cancelados} rotulo="cancelados" />
                  <Numero
                    valor={Number(resumoPedidos.valor_concluido)}
                    texto={reais(Number(resumoPedidos.valor_concluido))}
                    rotulo="em pedidos concluídos"
                  />
                </div>
                {resumoPedidos.lojas.length > 0 && (
                  <ul className="mt-3 divide-y divide-black/10 rounded-2xl border border-black/10 bg-white text-sm">
                    {resumoPedidos.lojas.map((l) => (
                      <li key={l.id} className="flex justify-between gap-3 px-4 py-2">
                        <span className="font-medium">{l.nome}</span>
                        <span className="text-zinc-600">
                          {l.pedidos} pedido(s) · {l.concluidos} concluído(s) · {reais(Number(l.valor_concluido))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            <section>
              <h2 className="font-serif text-lg font-bold">Base</h2>
              <p className="text-xs text-zinc-500">Meta de lançamento: 15 vendedores ativos.</p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <Numero valor={resumo.vendedores_ativos} rotulo="vendedores ativos" />
                <Numero valor={resumo.vendedores_suspensos} rotulo="suspensos" />
                <Numero valor={resumo.avaliacoes_total} rotulo="avaliações publicadas" />
              </div>
            </section>
            {canal && (
              <section>
                <h2 className="font-serif text-lg font-bold">Fale conosco</h2>
                <p className="text-xs text-zinc-500">
                  Saúde do canal. Só conta o que ainda está guardado: mensagens tratadas saem em 12 meses.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Numero valor={canal.pendentes} rotulo="para ler" destaque />
                  <Numero valor={canalPorSituacao.aceito + canalPorSituacao.resolvido} rotulo="aceitas ou resolvidas" />
                  <Numero valor={canalPorSituacao.recusado} rotulo="recusadas" />
                  <Numero
                    valor={canal.taxaDeAproveitamento ?? 0}
                    texto={canal.taxaDeAproveitamento === null ? "—" : `${canal.taxaDeAproveitamento}%`}
                    rotulo="aproveitadas (das tratadas)"
                  />
                </div>
              </section>
            )}
            <section>
              <h2 className="font-serif text-lg font-bold">Por cidade</h2>
              <p className="text-xs text-zinc-500">
                Meta de lançamento: {META_PERFIS_COMPLETOS} perfis completos (ativo, com bairro, horários e menu ou cardápio).
                Visitas e toques contam só perfis de vendedores; a visita ao catálogo não tem cidade.
              </p>
              <ul className="mt-2 space-y-3">
                {resumoCidades.length === 0 && <li className="text-sm text-zinc-500">Nenhuma cidade cadastrada.</li>}
                {resumoCidades.map((c) => {
                  const situacao = situacaoDaCidade(c);
                  const pct = progressoMeta(c.perfis_completos, META_PERFIS_COMPLETOS);
                  return (
                    <li key={c.cidade_id} className={card}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">
                          {c.nome}
                          {c.uf ? `/${c.uf}` : ""}
                        </p>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CORES_SITUACAO[situacao]}`}>
                          {ROTULOS_SITUACAO[situacao]}
                        </span>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-zinc-600">
                          <span>Perfis completos</span>
                          <span>
                            {c.perfis_completos} de {META_PERFIS_COMPLETOS}
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={pct}
                          aria-label={`Perfis completos em ${c.nome}`}
                          className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100"
                        >
                          <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-zinc-600">
                        {[
                          [c.vendedores_ativos, "ativos"],
                          [c.vendedores_pendentes, "para aprovar"],
                          [c.vendedores_suspensos, "suspensos"],
                          [c.visitas_perfis_30d, "visitas (30 dias)"],
                          [c.toques_whatsapp_30d, "toques no WhatsApp"],
                          [c.avaliacoes_publicadas, "avaliações"],
                        ].map(([valor, rotulo]) => (
                          <div key={rotulo} className="rounded-lg bg-zinc-50 p-2">
                            <dd className="text-lg font-bold text-zinc-900">{valor}</dd>
                            <dt>{rotulo}</dt>
                          </div>
                        ))}
                      </dl>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}

        {aba === "vendedores" && (
          <ul className="space-y-3">
            {vendedores.length === 0 && <li className="text-sm text-zinc-500">Nenhum vendedor cadastrado.</li>}
            {vendedores.map((v) => {
              const pendente = !v.ativo && !v.aprovado_em;
              const suspenso = !v.ativo && v.aprovado_em;
              return (
                <li key={v.id} className={`${card} ${pendente ? "border-orange-400" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-base font-semibold">
                      <Link href={`/vendedores/${v.id}`} target="_blank" className="underline">
                        {v.nome}
                      </Link>
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        pendente
                          ? "bg-orange-100 text-orange-700"
                          : suspenso
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                      }`}
                    >
                      {pendente ? "Aguardando aprovação" : suspenso ? "Suspenso" : "Ativo"}
                    </span>
                  </div>
                  <p className="mt-1 text-zinc-600">
                    {v.cidade ? `${v.cidade} · ` : ""}{v.bairro ?? "sem bairro"} · conta {v.username ?? "?"} · {v.email ?? "sem e-mail"} · cadastro em{" "}
                    {new Date(v.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="mt-1 text-zinc-600">
                    {v.itens} itens no menu · {v.visitas_30d} visitas e {v.cliques_30d} contatos (30 dias)
                    {v.status_manual !== "normal" && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        {v.status_manual === "ferias" ? "De férias" : "Não abre hoje"}
                        {v.status_manual_ate ? ` até ${formatarData(v.status_manual_ate)}` : ""}
                      </span>
                    )}
                  </p>
                  {linksDePedido.has(v.id) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 p-2 text-xs">
                      <span className="text-zinc-600">Link de pedidos:</span>
                      <a
                        href={linksDePedido.get(v.id)}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="break-all underline"
                      >
                        {linksDePedido.get(v.id)}
                      </a>
                      <form action={removerLinkPedido}>
                        <input type="hidden" name="vendedor_id" value={v.id} />
                        <button className={`${btn} bg-red-100 text-red-700`}>Remover link de pedidos</button>
                      </form>
                    </div>
                  )}
                  {imagensDoPerfil.has(v.id) && (
                    <div className="mt-2 flex flex-wrap items-start gap-3 rounded-lg bg-zinc-50 p-2 text-xs">
                      {(["logo", "banner"] as const).map((tipo) => {
                        const url = imagensDoPerfil.get(v.id)?.[tipo];
                        if (!url) return null;
                        return (
                          <div key={tipo} className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={tipo === "logo" ? "Logo do perfil" : "Banner do perfil"}
                              className={tipo === "logo" ? "h-12 w-12 rounded-lg object-cover" : "h-12 w-36 rounded-lg object-cover"}
                            />
                            <form action={removerImagemPerfil}>
                              <input type="hidden" name="vendedor_id" value={v.id} />
                              <input type="hidden" name="tipo" value={tipo} />
                              <button className={`${btn} bg-red-100 text-red-700`}>Remover {tipo === "logo" ? "logo" : "banner"}</button>
                            </form>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {v.destaque_ate && new Date(v.destaque_ate) > new Date() && (
                    <p className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      ★ Em destaque até{" "}
                      {new Date(v.destaque_ate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`https://wa.me/${v.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${btn} bg-green-100 text-green-700`}
                    >
                      Falar no WhatsApp
                    </a>
                    <form action={alternarVendedor}>
                      <input type="hidden" name="vendedor_id" value={v.id} />
                      <input type="hidden" name="ativo" value={v.ativo ? "false" : "true"} />
                      {pendente && <input type="hidden" name="aprovar" value="true" />}
                      <button className={`${btn} ${v.ativo ? "bg-red-100 text-red-700" : "bg-green-600 text-white"}`}>
                        {v.ativo ? "Suspender" : pendente ? "Aprovar" : "Reativar"}
                      </button>
                    </form>
                    {v.status_manual !== "normal" && (
                      <form action={limparAviso}>
                        <input type="hidden" name="vendedor_id" value={v.id} />
                        <button className={`${btn} bg-zinc-200 text-zinc-700`}>Limpar aviso</button>
                      </form>
                    )}
                    <Link href={`/admin?aba=historico&vendedor=${v.id}`} className={`${btn} bg-zinc-100 text-zinc-700`}>
                      Ver histórico
                    </Link>
                  </div>
                  {v.ativo && (
                    <details className="mt-3 rounded-xl border border-black/10 bg-zinc-50 p-3">
                      <summary className="cursor-pointer text-xs font-semibold">
                        Plano destaque: registrar pagamento
                      </summary>
                      <AcaoForm
                        action={registrarPagamento}
                        rotulo="Registrar e dar destaque"
                        limpar
                        className="mt-3 grid gap-2 sm:grid-cols-4"
                        botaoClassName="rounded-full bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                      >
                        <input type="hidden" name="vendedor_id" value={v.id} />
                        <label className="text-xs font-medium">
                          Dias
                          <select name="dias" defaultValue="30" className={campoCls}>
                            {[7, 15, 30, 60, 90].map((d) => (
                              <option key={d} value={d}>
                                {d} dias
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs font-medium">
                          Valor (R$)
                          <input name="valor" inputMode="decimal" placeholder="30,00" className={campoCls} />
                        </label>
                        <label className="text-xs font-medium">
                          Forma
                          <select name="forma" defaultValue="pix" className={campoCls}>
                            <option value="pix">Pix</option>
                            <option value="dinheiro">Dinheiro</option>
                            <option value="cortesia">Cortesia (sem cobrar)</option>
                          </select>
                        </label>
                        <label className="text-xs font-medium">
                          Observação
                          <input name="obs" maxLength={200} placeholder="Ex.: comprovante 1234" className={campoCls} />
                        </label>
                      </AcaoForm>
                      {v.destaque_ate && new Date(v.destaque_ate) > new Date() && (
                        <form action={removerDestaque} className="mt-2">
                          <input type="hidden" name="vendedor_id" value={v.id} />
                          <button className="text-xs text-red-600 underline">Remover destaque agora</button>
                        </form>
                      )}
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {aba === "denuncias" && (
          <ul className="space-y-3">
            {denuncias.length === 0 && <li className="text-sm text-zinc-500">Nenhuma denúncia aberta.</li>}
            {denuncias.map((d) => (
              <li key={d.id} className={card}>
                <p className="font-semibold">
                  {MOTIVOS[d.motivo] ?? d.motivo} ·{" "}
                  {d.vendedor ? (
                    <Link href={`/vendedores/${d.vendedor.id}`} className="underline" target="_blank">
                      {d.vendedor.nome}
                    </Link>
                  ) : (
                    "vendedor removido"
                  )}
                </p>
                {d.avaliacao && (
                  <p className="mt-1 rounded-lg bg-zinc-50 p-2 text-zinc-700">
                    Avaliação denunciada: {"★".repeat(d.avaliacao.nota)} {d.avaliacao.comentario}
                  </p>
                )}
                {d.descricao && <p className="mt-1 text-zinc-700">&ldquo;{d.descricao}&rdquo;</p>}
                {d.contato && <p className="mt-1 text-xs text-zinc-500">Contato de quem denunciou: {d.contato}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={tratarDenuncia}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="status" value="resolvida" />
                    <button className={`${btn} bg-green-100 text-green-700`}>Resolvida</button>
                  </form>
                  <form action={tratarDenuncia}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="status" value="descartada" />
                    <button className={`${btn} bg-zinc-200 text-zinc-700`}>Descartar</button>
                  </form>
                  {d.vendedor && (
                    <form action={alternarVendedor}>
                      <input type="hidden" name="vendedor_id" value={d.vendedor.id} />
                      <input type="hidden" name="ativo" value={d.vendedor.ativo ? "false" : "true"} />
                      <button className={`${btn} bg-red-100 text-red-700`}>
                        {d.vendedor.ativo ? "Suspender vendedor" : "Reativar vendedor"}
                      </button>
                    </form>
                  )}
                  {d.avaliacao && (
                    <form action={moderarAvaliacao}>
                      <input type="hidden" name="id" value={d.avaliacao.id} />
                      <input type="hidden" name="acao" value="remover" />
                      <button className={`${btn} bg-red-100 text-red-700`}>Remover avaliação</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {aba === "feedback" && (
          <div>
            <p className="mb-3 text-sm text-zinc-600">
              Mensagens do &ldquo;Fale conosco&rdquo;. <strong>Nada vai para o GitHub sozinho:</strong> leia, e se valer a pena
              clique em &ldquo;Abrir issue&rdquo; (o GitHub abre com o texto pronto; o contato de quem escreveu não vai junto), depois
              marque como aceita. Quem escreveu não vê a issue.
            </p>
            <ul className="space-y-3">
              {feedbacks.length === 0 && <li className="text-sm text-zinc-500">Nenhuma mensagem pendente.</li>}
              {feedbacks.map((f) => (
                <li key={f.id} className={card}>
                  <p className="font-semibold">
                    {TIPOS_FEEDBACK.find(([id]) => id === f.tipo)?.[1] ?? f.tipo}
                    <span className="ml-2 text-xs font-normal text-zinc-500">{new Date(f.created_at).toLocaleDateString("pt-BR")}</span>
                    {f.status === "aceito" && (
                      <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">aceita</span>
                    )}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-700">{f.mensagem}</p>
                  {f.pagina && <p className="mt-1 text-xs text-zinc-500">Página: {f.pagina}</p>}
                  {f.contato && <p className="mt-1 text-xs text-zinc-500">Contato: {f.contato}</p>}
                  {f.contato && !linkResposta(f) && (
                    <p className="mt-1 text-xs text-amber-700">O contato não parece um e-mail nem um telefone: sem botão de resposta.</p>
                  )}
                  {f.issue_url && (
                    <p className="mt-1 text-xs">
                      <a href={f.issue_url} target="_blank" rel="noopener noreferrer" className="underline">Issue no GitHub</a>
                    </p>
                  )}

                  {f.status === "novo" ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={linkNovaIssue(f)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${btn} inline-block bg-zinc-900 text-white`}
                        >
                          Abrir issue no GitHub
                        </a>
                        {linkResposta(f) && (
                          <a
                            href={linkResposta(f) ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${btn} inline-block bg-green-100 text-green-700`}
                          >
                            Responder
                          </a>
                        )}
                      </div>
                      <form action={tratarFeedback} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={f.id} />
                        <input name="issue_url" placeholder="Link da issue (opcional)" className={`${campoCls} max-w-xs`} />
                        <button name="status" value="aceito" className={`${btn} bg-green-100 text-green-700`}>Aceitar</button>
                        <button name="status" value="recusado" className={`${btn} bg-zinc-200 text-zinc-700`}>Recusar</button>
                      </form>
                    </div>
                  ) : (
                    <form action={tratarFeedback} className="mt-3">
                      <input type="hidden" name="id" value={f.id} />
                      <button name="status" value="resolvido" className={`${btn} bg-green-100 text-green-700`}>Marcar como resolvida</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {aba === "avaliacoes" && (
          <ul className="space-y-3">
            {avaliacoes.length === 0 && <li className="text-sm text-zinc-500">Nada pendente.</li>}
            {avaliacoes.map((a) => (
              <li key={a.id} className={card}>
                <p className="font-semibold">
                  {a.vendedor?.nome} · <span className="text-amber-600">{"★".repeat(a.nota)}</span>
                  <span className="ml-2 text-xs font-normal text-zinc-500">por {a.autor_nome ?? "anônimo"}</span>
                </p>
                {a.comentario && <p className="mt-1 text-zinc-700">{a.comentario}</p>}
                <div className="mt-3 flex gap-2">
                  {(["aprovar", "remover"] as const).map((acao) => (
                    <form key={acao} action={moderarAvaliacao}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="acao" value={acao} />
                      <button
                        className={`${btn} ${
                          acao === "aprovar" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {acao === "aprovar" ? "Aprovar" : "Remover"}
                      </button>
                    </form>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        {aba === "configuracoes" && configuracoes && (
          <section className={card}>
            <h2 className="font-serif text-lg font-bold">Aprovação do administrador</h2>
            <p className="mt-1 text-zinc-600">
              Escolha o que fica escondido até você aprovar e o que vai direto para o ar. Vale só para o que chegar a
              partir de agora; o que já está na fila continua esperando. Mesmo liberado, dá para remover qualquer
              avaliação ou suspender qualquer vendedor depois.
            </p>
            <AcaoForm
              action={salvarConfiguracoes}
              rotulo="Salvar configurações"
              className="mt-4 grid gap-5"
              botaoClassName="w-fit rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {(
                [
                  [
                    "avaliacoes",
                    "Avaliações",
                    configuracoes.avaliacoes_exigem_aprovacao,
                    "Exigir aprovação: a avaliação só aparece no perfil depois que você aprovar.",
                    "Liberar direto: a avaliação aparece assim que o cliente envia (continua sendo só de quem recebeu convite).",
                  ],
                  [
                    "vendedores",
                    "Criação de vendedores",
                    configuracoes.vendedores_exigem_aprovacao,
                    "Exigir aprovação: o perfil novo fica oculto até você aprovar.",
                    "Liberar direto: o perfil novo já aparece no catálogo assim que o vendedor salvar.",
                  ],
                ] as const
              ).map(([nome, titulo, exigir, textoExigir, textoLiberar]) => (
                <fieldset key={nome} className="grid gap-2">
                  <legend className="text-base font-semibold">{titulo}</legend>
                  {(
                    [
                      ["exigir", textoExigir],
                      ["liberar", textoLiberar],
                    ] as const
                  ).map(([valor, texto]) => (
                    <label key={valor} className="flex items-start gap-2 rounded-lg border border-black/10 p-3">
                      <input
                        type="radio"
                        name={nome}
                        value={valor}
                        defaultChecked={(valor === "exigir") === exigir}
                        className="mt-1"
                      />
                      <span>{texto}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </AcaoForm>
            <p className="mt-3 text-xs text-zinc-500">Última alteração: {new Date(configuracoes.atualizado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
          </section>
        )}

        {aba === "cidades" && (
          <>
            <section className={card}>
              <h2 className="font-serif text-lg font-bold">Sugestões de bairro</h2>
              <p className="mt-1 text-zinc-600">
                Bairros que os vendedores não acharam na lista. Aprovar cria o bairro; juntar usa um que já existe (evita
                &ldquo;Centro&rdquo; e &ldquo;centro&rdquo; repetidos); recusar descarta. Vale para todos os vendedores que sugeriram o mesmo nome.
              </p>
              {sugestoes.length === 0 && <p className="mt-3 text-zinc-500">Nenhuma sugestão esperando.</p>}
              <ul className="mt-3 space-y-3">
                {sugestoes.map((s) => (
                  <li key={s.id} className="rounded-xl border border-black/10 bg-zinc-50 p-3">
                    <p className="font-semibold">
                      {s.nome} <span className="font-normal text-zinc-600">· {s.cidade_nome}</span>
                    </p>
                    <p className="text-xs text-zinc-600">
                      Pedido por {s.vendedor_nome}
                      {Number(s.iguais) > 1 ? ` e mais ${Number(s.iguais) - 1}` : ""} · {new Date(s.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <form action={tratarSugestaoBairro}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="acao" value="aprovar" />
                        <button className={`${btn} bg-green-100 text-green-700`}>Aprovar como novo bairro</button>
                      </form>
                      <form action={tratarSugestaoBairro} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="acao" value="unir" />
                        <select name="bairro_id" required aria-label="Juntar com o bairro" className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs">
                          <option value="">Juntar com...</option>
                          {bairros
                            .filter((b) => b.cidade_id === s.cidade_id)
                            .map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.nome}
                              </option>
                            ))}
                        </select>
                        <button className={`${btn} bg-zinc-200 text-zinc-800`}>Juntar</button>
                      </form>
                      <form action={tratarSugestaoBairro}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="acao" value="recusar" />
                        <button className={`${btn} bg-red-100 text-red-700`}>Recusar</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className={card}>
              <h2 className="font-serif text-lg font-bold">Nova cidade</h2>
              <p className="mt-1 text-zinc-600">
                Depois de criar, cadastre os bairros dela. Com mais de uma cidade ativa, o site passa a mostrar o
                seletor de cidade e o vendedor escolhe a dele no cadastro.
              </p>
              <AcaoForm
                action={criarCidade}
                rotulo="Criar cidade"
                limpar
                className="mt-3 grid gap-2 sm:grid-cols-[1fr_6rem]"
                botaoClassName="rounded-full bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
              >
                <label className="text-xs font-medium">
                  Nome
                  <input name="nome" required maxLength={60} placeholder="Ex.: Santa Maria" className={campoCls} />
                </label>
                <label className="text-xs font-medium">
                  UF
                  <input name="uf" maxLength={2} placeholder="RS" className={campoCls} />
                </label>
              </AcaoForm>
            </section>

            <ul className="space-y-3">
              {cidades.map((c) => (
                <li key={c.id} className={`${card} ${c.ativa ? "" : "opacity-70"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-base font-semibold">
                      {c.nome}
                      {c.uf ? ` - ${c.uf}` : ""} <span className="text-xs font-normal text-zinc-500">/{c.slug}</span>
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        c.ativa ? "bg-green-100 text-green-700" : "bg-zinc-200 text-zinc-600"
                      }`}
                    >
                      {c.ativa ? "Ativa" : "Desativada"}
                    </span>
                  </div>
                  <p className="mt-1 text-zinc-600">
                    {c.bairros} bairros · {c.vendedores} vendedores
                  </p>

                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {bairros
                      .filter((b) => b.cidade_id === c.id)
                      .map((b) => (
                        <span
                          key={b.id}
                          className={`rounded-full px-2.5 py-0.5 text-xs ${b.ativo ? "bg-zinc-100" : "bg-zinc-100 text-zinc-400 line-through"}`}
                        >
                          {b.nome}
                        </span>
                      ))}
                  </p>

                  <details className="mt-3 rounded-xl border border-black/10 bg-zinc-50 p-3">
                    <summary className="cursor-pointer text-xs font-semibold">Editar cidade e bairros</summary>

                    <AcaoForm
                      action={adicionarBairro}
                      rotulo="Adicionar bairro"
                      limpar
                      className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"
                      botaoClassName="rounded-full bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                    >
                      <input type="hidden" name="cidade_id" value={c.id} />
                      <label className="text-xs font-medium">
                        Novo bairro
                        <input name="nome" required maxLength={60} placeholder="Ex.: Centro" className={campoCls} />
                      </label>
                    </AcaoForm>

                    <ul className="mt-4 divide-y divide-black/10 border-t border-black/10">
                      {bairros
                        .filter((b) => b.cidade_id === c.id)
                        .map((b) => {
                          const usos = vendedoresPorBairro.get(b.id) ?? 0;
                          return (
                            <li key={b.id} className="grid gap-2 py-2 text-xs">
                              <p className="text-zinc-600">
                                {usos} vendedor{usos === 1 ? "" : "es"} neste bairro{b.ativo ? "" : " · desativado"}
                              </p>
                              <AcaoForm
                                action={renomearBairro}
                                rotulo="Renomear"
                                className="flex flex-wrap items-center gap-2"
                                botaoClassName="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                <input type="hidden" name="id" value={b.id} />
                                <input name="nome" required maxLength={60} defaultValue={b.nome} aria-label={`Nome do bairro ${b.nome}`} className={`${campoCls} w-48`} />
                              </AcaoForm>
                              <div className="flex flex-wrap items-center gap-2">
                                <form action={alternarBairro}>
                                  <input type="hidden" name="id" value={b.id} />
                                  <input type="hidden" name="ativo" value={b.ativo ? "false" : "true"} />
                                  <button className={`${btn} ${b.ativo ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"}`}>
                                    {b.ativo ? "Desativar" : "Reativar"}
                                  </button>
                                </form>
                                <form action={unirBairros} className="flex items-center gap-1">
                                  <input type="hidden" name="origem" value={b.id} />
                                  <select name="destino" required aria-label={`Juntar ${b.nome} em`} className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs">
                                    <option value="">Juntar em...</option>
                                    {bairros
                                      .filter((o) => o.cidade_id === c.id && o.id !== b.id)
                                      .map((o) => (
                                        <option key={o.id} value={o.id}>
                                          {o.nome}
                                        </option>
                                      ))}
                                  </select>
                                  <button className={`${btn} bg-zinc-200 text-zinc-800`}>Juntar</button>
                                </form>
                              </div>
                            </li>
                          );
                        })}
                    </ul>

                    <AcaoForm
                      action={atualizarCidade}
                      rotulo="Salvar cidade"
                      className="mt-4 grid gap-2 border-t border-black/10 pt-3 sm:grid-cols-[1fr_5rem_1fr]"
                      botaoClassName="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      <input type="hidden" name="id" value={c.id} />
                      <label className="text-xs font-medium">
                        Nome
                        <input name="nome" required maxLength={60} defaultValue={c.nome} className={campoCls} />
                      </label>
                      <label className="text-xs font-medium">
                        UF
                        <input name="uf" maxLength={2} defaultValue={c.uf ?? ""} className={campoCls} />
                      </label>
                      <label className="text-xs font-medium">
                        Endereço (slug)
                        <input name="slug" required maxLength={60} defaultValue={c.slug} className={campoCls} />
                      </label>
                    </AcaoForm>

                    <AcaoForm
                      action={alternarCidade}
                      rotulo={c.ativa ? "Desativar cidade" : "Ativar cidade"}
                      className="mt-3"
                      botaoClassName={`${btn} ${c.ativa ? "bg-red-100 text-red-700" : "bg-green-600 text-white"}`}
                    >
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="ativa" value={c.ativa ? "false" : "true"} />
                    </AcaoForm>
                  </details>
                </li>
              ))}
            </ul>
          </>
        )}

        {aba === "financeiro" && (
          <>
            <p className="text-sm text-zinc-600">
              Pagamentos do plano destaque registrados à mão (Pix, dinheiro ou cortesia). Para registrar, abra o
              vendedor na aba Vendedores. Total listado:{" "}
              <strong>{reais(pagamentos.reduce((soma, p) => soma + Number(p.valor), 0))}</strong>
            </p>
            <ul className="divide-y divide-black/10 rounded-2xl border border-black/10 bg-white text-sm">
              {pagamentos.length === 0 && <li className="p-4 text-zinc-500">Nenhum pagamento registrado ainda.</li>}
              {pagamentos.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                  <span>
                    <strong>{p.vendedor_nome ?? "vendedor removido"}</strong> · {reais(p.valor)} ·{" "}
                    {p.forma === "pix" ? "Pix" : p.forma === "dinheiro" ? "dinheiro" : "cortesia"} · {p.dias} dias (até{" "}
                    {new Date(p.destaque_ate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })})
                    {p.observacao && <span className="text-zinc-500"> · {p.observacao}</span>}
                  </span>
                  <time className="text-xs text-zinc-500">
                    {new Date(p.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} ·{" "}
                    {p.registrado_por}
                  </time>
                </li>
              ))}
            </ul>
          </>
        )}

        {aba === "historico" && (
          <>
            {vendedorFiltro && (
              <p className="text-sm">
                Filtrando por um vendedor.{" "}
                <Link href="/admin?aba=historico" className="underline">
                  Ver tudo
                </Link>
              </p>
            )}
            <ul className="divide-y divide-black/10 rounded-2xl border border-black/10 bg-white text-sm">
              {historico.length === 0 && <li className="p-4 text-zinc-500">Sem registros.</li>}
              {historico.map((e) => {
                const detalhe =
                  (e.dados?.nome as string | undefined) ??
                  (e.dados?.comentario as string | undefined) ??
                  (e.dados?.motivo as string | undefined) ??
                  (e.dados?.data as string | undefined) ??
                  "";
                return (
                  <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                    <span>
                      <strong>{e.ator}</strong> {ACOES[e.acao] ?? e.acao} {ENTIDADES[e.entidade] ?? e.entidade}
                      {detalhe && <span className="text-zinc-600"> “{String(detalhe).slice(0, 60)}”</span>}
                      {e.vendedor_nome && e.entidade !== "vendedores" && (
                        <span className="text-zinc-500"> · {e.vendedor_nome}</span>
                      )}
                    </span>
                    <time className="text-xs text-zinc-500">
                      {new Date(e.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </time>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
