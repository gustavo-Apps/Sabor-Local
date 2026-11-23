import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { VENDEDORES_MOCK } from "@/lib/mock-data";
import { disponibilidadeDoItem } from "@/lib/itens";
import { itensSoDeEscolha, montarMontaveis, type Montavel, type MontavelBruto } from "@/lib/montaveis";
import type { Avaliacao, Vendedor } from "@/lib/types";

const VENDEDOR_SELECT = `
  id, nome, descricao, whatsapp, modo_atendimento, foto_capa_url, logo_url, banner_url, bairro_sugerido, aceita_pedidos, pagamentos_aceitos, taxa_entrega, ativo, destaque_ate, cardapio_url, cardapio_tipo,
  link_pedido_url, link_pedido_rotulo, created_at, status_manual, status_manual_ate, status_manual_msg,
  vendedor_categorias ( categoria:categorias ( id, nome, slug ) ),
  bairro:bairros ( id, nome ),
  horarios:horarios_funcionamento ( id, vendedor_id, dia_semana, abre, fecha ),
  excecoes:excecoes_horario ( id, vendedor_id, data, fechado, abre, fecha, motivo ),
  itens_cardapio ( id, vendedor_id, nome, descricao, preco, foto_url, ordem, disponivel, indisponivel_ate, destaque, categoria:categorias_produto ( id, nome, chave, ordem ) )
`;

export async function listarVendedores(cidadeId?: string): Promise<Vendedor[]> {
  if (!isSupabaseConfigured()) return VENDEDORES_MOCK;

  const supabase = await createClient();
  let consulta = supabase.from("vendedores").select(VENDEDOR_SELECT).eq("ativo", true).order("nome");
  if (cidadeId) consulta = consulta.eq("cidade_id", cidadeId);
  const { data, error } = await consulta;

  if (error) {
    console.error("Erro ao listar vendedores:", error.message);
    return [];
  }

  return comResumo(supabase, (data ?? []).map(normalizar));
}

export async function buscarVendedorPorId(id: string): Promise<Vendedor | null> {
  if (!isSupabaseConfigured()) {
    return VENDEDORES_MOCK.find((v) => v.id === id) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendedores")
    .select(VENDEDOR_SELECT)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Erro ao buscar vendedor:", error.message);
    return null;
  }

  const [vendedor] = await comResumo(supabase, [normalizar(data)]);
  return vendedor;
}

type ClienteServidor = Awaited<ReturnType<typeof createClient>>;

/** Anexa a nota média e o total de avaliações publicadas (view avaliacoes_resumo) a cada loja. */
async function comResumo(supabase: ClienteServidor, vendedores: Vendedor[]): Promise<Vendedor[]> {
  if (vendedores.length === 0) return vendedores;
  const { data, error } = await supabase
    .from("avaliacoes_resumo")
    .select("vendedor_id, media, total")
    .in("vendedor_id", vendedores.map((v) => v.id));
  if (error) {
    console.error("Erro ao buscar notas:", error.message);
    return vendedores;
  }
  const porLoja = new Map((data ?? []).map((r) => [r.vendedor_id as string, r]));
  return vendedores.map((v) => {
    const r = porLoja.get(v.id);
    return r ? { ...v, avaliacao_media: Number(r.media), avaliacao_total: Number(r.total) } : v;
  });
}

type VendedorBruto = Omit<Vendedor, "categorias"> & {
  vendedor_categorias: { categoria: Vendedor["categorias"][number] | null }[];
};

function normalizar(bruto: unknown): Vendedor {
  const { vendedor_categorias, ...resto } = bruto as VendedorBruto;
  const categorias = (vendedor_categorias ?? [])
    .map((vc) => vc.categoria)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  return { ...resto, categorias };
}

const MONTAVEL_SELECT = `
  id, nome, descricao, rotulo_escolhas, escolha_obrigatoria, rotulo_adicionais, max_adicionais, disponivel, ordem,
  tamanhos:montavel_tamanhos ( id, nome, preco, max_escolhas, ordem ),
  adicionais:montavel_adicionais ( id, nome, preco, disponivel, ordem ),
  categorias:montavel_categorias ( categoria_produto_id )
`;

/**
 * Produtos "monte o seu" da loja (pizza, açaí...) como o cliente vê, mais os ids dos itens que são só escolha
 * desses produtos (sabores sem preço: não se pedem sozinhos).
 */
export async function listarMontaveis(vendedor: Vendedor, hoje: string): Promise<{ montaveis: Montavel[]; soDeEscolha: Set<string> }> {
  const vazio = { montaveis: [], soDeEscolha: new Set<string>() };
  if (!isSupabaseConfigured()) return vazio;

  const supabase = await createClient();
  const { data, error } = await supabase.from("montaveis").select(MONTAVEL_SELECT).eq("vendedor_id", vendedor.id);
  if (error) {
    console.error("Erro ao buscar os produtos montáveis:", error.message);
    return vazio;
  }

  const brutos = (data ?? []) as unknown as MontavelBruto[];
  const itens = (vendedor.itens_cardapio ?? []).map((i) => ({
    id: i.id,
    nome: i.nome,
    descricao: i.descricao,
    foto_url: i.foto_url,
    ordem: i.ordem,
    preco: i.preco,
    categoria_produto_id: i.categoria?.id ?? null,
    disponivel: disponibilidadeDoItem(i, hoje) === "disponivel",
  }));
  return { montaveis: montarMontaveis(brutos, itens), soDeEscolha: itensSoDeEscolha(brutos, itens) };
}

/** Ids dos itens "mais pedidos" (toques no "Pedir" nos últimos 30 dias; o banco só devolve quem passou de 5). */
export async function listarMaisPedidos(vendedorId: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("itens_mais_pedidos", { p_vendedor: vendedorId });
  if (error) {
    console.error("Erro ao buscar os mais pedidos:", error.message);
    return [];
  }
  return ((data ?? []) as { item_id: string }[]).map((r) => r.item_id);
}

export async function listarAvaliacoes(vendedorId: string): Promise<Avaliacao[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("avaliacoes")
    .select("id, vendedor_id, nota, comentario, autor_nome, aprovada, created_at")
    .eq("vendedor_id", vendedorId)
    .eq("aprovada", true)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Erro ao listar avaliações:", error.message);
    return [];
  }
  return data ?? [];
}
