export type ModoAtendimento = "entrega" | "retirada" | "ambos";

export interface Cidade {
  id: string;
  nome: string;
  uf: string | null;
  slug: string;
}

export interface Bairro {
  id: string;
  nome: string;
  cidade_id?: string;
  /** Desativado = deixa de ser oferecido a quem escolhe bairro; quem já o usa continua nele. */
  ativo?: boolean;
}

export interface Categoria {
  id: string;
  nome: string;
  slug: string;
}

export interface HorarioFuncionamento {
  id: string;
  vendedor_id: string;
  dia_semana: number; // 0 = domingo ... 6 = sábado
  abre: string; // "HH:MM:SS"
  fecha: string;
}

export interface ExcecaoHorario {
  id: string;
  vendedor_id: string;
  data: string; // YYYY-MM-DD
  fechado: boolean;
  abre: string | null;
  fecha: string | null;
  motivo: string | null;
}

export type StatusManual = "normal" | "fechado_hoje" | "ferias";

/** Categoria do menu de UMA loja ("Bebidas", "Salgados"...). Opcional; a `chave` junta nomes parecidos entre lojas. */
export interface CategoriaProduto {
  id: string;
  nome: string;
  chave: string;
  ordem?: number;
}

export interface ItemCardapio {
  id: string;
  vendedor_id: string;
  nome: string;
  descricao: string | null;
  preco: number | null;
  foto_url: string | null;
  ordem: number;
  disponivel?: boolean;
  indisponivel_ate?: string | null; // até quando fica indisponível (YYYY-MM-DD)
  /** "Destaque da casa": escolha do vendedor (até 3 itens). */
  destaque?: boolean;
  /** Categoria que o vendedor escolheu para o item (opcional). */
  categoria_produto_id?: string | null;
  categoria?: CategoriaProduto | null;
}

export interface Avaliacao {
  id: string;
  vendedor_id: string;
  nota: number;
  comentario: string | null;
  /** Nome que o cliente escolheu mostrar; ausente = anônimo. */
  autor_nome?: string | null;
  aprovada: boolean;
  created_at: string;
}

export interface Vendedor {
  id: string;
  nome: string;
  descricao: string | null;
  whatsapp: string;
  modo_atendimento: ModoAtendimento;
  foto_capa_url: string | null;
  /** Pedidos pelo site (versão 2.x): o vendedor liga quando quiser. */
  aceita_pedidos?: boolean;
  pagamentos_aceitos?: string[];
  taxa_entrega?: number;
  /** Logo quadrada e banner largo (opcionais); sem eles, o perfil mantém o visual de sempre. */
  logo_url?: string | null;
  banner_url?: string | null;
  ativo: boolean;
  destaque_ate: string | null;
  cardapio_url?: string | null;
  cardapio_tipo?: string | null;
  /** Site, cardápio online ou outro canal de pedidos do próprio vendedor (opcional). */
  link_pedido_url?: string | null;
  link_pedido_rotulo?: string | null;
  categorias: Categoria[];
  bairro: Bairro | null;
  /** Bairro sugerido pelo vendedor que a equipe ainda não confirmou: aparece como "a confirmar". */
  bairro_sugerido?: string | null;
  horarios?: HorarioFuncionamento[];
  excecoes?: ExcecaoHorario[];
  status_manual?: StatusManual;
  status_manual_ate?: string | null;
  status_manual_msg?: string | null;
  created_at?: string;
  itens_cardapio?: ItemCardapio[];
  /** Nota média (1 a 5) e total das avaliações já publicadas; ausente quando a loja ainda não tem nenhuma. */
  avaliacao_media?: number | null;
  avaliacao_total?: number;
}
