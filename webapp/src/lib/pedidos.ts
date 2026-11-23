// Regras do pedido pelo site que não dependem de banco nem de tela. Sem imports de outros arquivos do projeto,
// para rodar no navegador, no servidor e nos testes.

export const FORMAS_PAGAMENTO = ["pix", "dinheiro", "cartao"] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const ROTULOS_PAGAMENTO: Record<FormaPagamento, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão (na entrega ou na retirada)",
};

export type ModoPedido = "entrega" | "retirada";

export type StatusPedido =
  | "novo"
  | "em_preparo"
  | "saiu_para_entrega"
  | "pronto_para_retirada"
  | "concluido"
  | "cancelado";

export const STATUS_ABERTOS: readonly StatusPedido[] = ["novo", "em_preparo", "saiu_para_entrega", "pronto_para_retirada"];

export function pedidoAberto(status: string): boolean {
  return (STATUS_ABERTOS as readonly string[]).includes(status);
}

/** Texto do status para o cliente, que acompanha pelo link. */
export function rotuloDoStatusParaCliente(status: string): string {
  const mapa: Record<string, string> = {
    novo: "Enviado. Aguardando a loja confirmar",
    em_preparo: "A loja está preparando o seu pedido",
    saiu_para_entrega: "Saiu para entrega",
    pronto_para_retirada: "Pronto para retirar na loja",
    concluido: "Pedido concluído",
    cancelado: "Pedido cancelado",
  };
  return mapa[status] ?? status;
}

/** Texto curto do status para o vendedor (etiqueta na lista de pedidos). */
export function rotuloDoStatusParaLoja(status: string): string {
  const mapa: Record<string, string> = {
    novo: "Novo",
    em_preparo: "Em preparo",
    saiu_para_entrega: "Saiu para entrega",
    pronto_para_retirada: "Pronto para retirar",
    concluido: "Concluído",
    cancelado: "Cancelado",
  };
  return mapa[status] ?? status;
}

export interface AcaoDeStatus {
  status: StatusPedido;
  rotulo: string;
}

/** Botões que o vendedor vê para andar com o pedido (o cancelamento é um botão à parte). Espelha as regras do banco. */
export function proximasAcoes(modo: ModoPedido, status: string): AcaoDeStatus[] {
  const pronto: AcaoDeStatus =
    modo === "entrega"
      ? { status: "saiu_para_entrega", rotulo: "Saiu para entrega" }
      : { status: "pronto_para_retirada", rotulo: "Pronto para retirar" };
  if (status === "novo") return [{ status: "em_preparo", rotulo: "Começar a preparar" }, pronto];
  if (status === "em_preparo") return [pronto];
  if (status === "saiu_para_entrega" || status === "pronto_para_retirada") {
    return [{ status: "concluido", rotulo: "Concluir pedido" }];
  }
  return [];
}

export function podeCancelarNaLoja(status: string): boolean {
  return pedidoAberto(status);
}

export interface LinhaDoPedido {
  nome: string;
  /** Nulo = sob consulta (o valor se combina com a loja). */
  preco: number | null;
  quantidade: number;
  /** Montagem (pizza, açaí...): o que o cliente escolheu, uma linha por grupo ("Sabores: Calabresa, Frango"). */
  detalhesEmTexto?: readonly string[];
}

export interface Totais {
  quantidade: number;
  subtotal: number;
  taxaEntrega: number;
  total: number;
  sobConsulta: boolean;
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

/** Valor do pedido: preço x quantidade dos itens com preço, mais a taxa quando é entrega. Só para mostrar; o banco recalcula. */
export function calcularTotais(linhas: readonly LinhaDoPedido[], modo: ModoPedido, taxaEntrega: number): Totais {
  const subtotal = arredondar(linhas.reduce((soma, l) => soma + (l.preco ?? 0) * l.quantidade, 0));
  const taxa = modo === "entrega" ? arredondar(taxaEntrega) : 0;
  return {
    quantidade: linhas.reduce((soma, l) => soma + l.quantidade, 0),
    subtotal,
    taxaEntrega: taxa,
    total: arredondar(subtotal + taxa),
    sobConsulta: linhas.some((l) => l.preco === null),
  };
}

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Código que o banco devolve (`raise exception 'loja_fechada'`) -> o que dizer ao cliente. */
const ERROS_DO_PEDIDO: Record<string, string> = {
  loja_nao_aceita_pedidos: "Esta loja não está recebendo pedidos pelo site agora. Fale com ela pelo WhatsApp.",
  loja_fechada: "A loja está fechada agora. Os pedidos pelo site só entram com a loja aberta.",
  loja_propria: "Você não pode fazer pedido na sua própria loja.",
  modo_invalido: "A loja não atende desse jeito. Escolha entrega ou retirada, conforme a loja oferece.",
  nome_invalido: "Digite o seu nome (de 2 a 60 letras).",
  telefone_invalido: "Digite o telefone com DDD, por exemplo (11) 99999-0000.",
  endereco_obrigatorio: "Digite o endereço completo para a entrega (rua, número e bairro).",
  endereco_longo: "O endereço pode ter no máximo 200 caracteres.",
  observacoes_longas: "As observações podem ter no máximo 300 caracteres.",
  pagamento_invalido: "A loja não aceita esse meio de pagamento. Escolha outro.",
  itens_invalidos: "Não foi possível ler os itens do pedido. Volte ao cardápio e escolha de novo.",
  item_indisponivel: "Algum item não está mais disponível. Volte ao cardápio e confira.",
  montagem_invalida: "Não foi possível ler o que você montou. Volte ao cardápio e monte de novo.",
  montagem_indisponivel: "Algo do que você montou não está mais disponível (tamanho, sabor ou adicional). Volte ao cardápio e monte de novo.",
  pedido_grande: "O pedido passou do valor máximo (R$ 5.000). Fale com a loja pelo WhatsApp.",
  troco_invalido: "O troco precisa ser para um valor igual ou maior que o total do pedido.",
  muitos_pedidos: "Você já fez vários pedidos há pouco. Espere um pouco ou fale com a loja pelo WhatsApp.",
  cliente_bloqueado: "Não foi possível enviar este pedido. Fale com a loja pelo WhatsApp.",
};

export const ERRO_PEDIDO_PADRAO = "Não foi possível enviar o pedido agora. Tente de novo ou fale com a loja pelo WhatsApp.";

export function mensagemErroDoPedido(erro: string | null | undefined): string {
  if (!erro) return ERRO_PEDIDO_PADRAO;
  const codigo = Object.keys(ERROS_DO_PEDIDO).find((c) => erro.includes(c));
  return codigo ? ERROS_DO_PEDIDO[codigo] : ERRO_PEDIDO_PADRAO;
}

export interface DadosDoResumo {
  numero: number;
  nome: string | null;
  modo: ModoPedido;
  endereco: string | null;
  pagamento: FormaPagamento;
  troco: number | null;
  observacoes: string | null;
  linhas: readonly LinhaDoPedido[];
  totais: Totais;
}

/**
 * Resumo do pedido para mandar à loja pelo WhatsApp. NUNCA leva o link de acompanhamento: ele é só do cliente
 * (quem tem o link cancela e avalia o pedido; se a loja o recebesse, poderia se avaliar sozinha).
 */
export function montarResumoParaWhatsApp(nomeDaLoja: string, d: DadosDoResumo): string {
  const linhas = [
    `Olá! Fiz o pedido nº ${d.numero} pelo Sabor Local para a ${nomeDaLoja}.`,
    "",
    ...d.linhas.flatMap((l) => [
      `• ${l.quantidade}x ${l.nome}${l.preco !== null ? ` (${brl(l.preco * l.quantidade)})` : " (valor a combinar)"}`,
      ...(l.detalhesEmTexto ?? []).map((t) => `   ${t}`),
    ]),
    "",
    ...(d.totais.taxaEntrega > 0 ? [`Entrega: ${brl(d.totais.taxaEntrega)}`] : []),
    `Total: ${brl(d.totais.total)}${d.totais.sobConsulta ? " + itens a combinar" : ""}`,
    d.modo === "entrega" ? `Entrega em: ${d.endereco ?? "(endereço no pedido)"}` : "Retirada na loja",
    `Pagamento: ${ROTULOS_PAGAMENTO[d.pagamento]}${
      d.pagamento === "dinheiro" && d.troco ? ` (troco para ${brl(d.troco)})` : ""
    }`,
    ...(d.observacoes ? [`Observações: ${d.observacoes}`] : []),
    ...(d.nome ? ["", `Nome: ${d.nome}`] : []),
  ];
  return linhas.join("\n");
}

export function linkWhatsAppComTexto(whatsapp: string, texto: string): string {
  return `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

/** O que `pedido_por_token` devolve ao cliente que acompanha o pedido. */
export interface PedidoAcompanhado {
  numero: number;
  status: StatusPedido;
  modo: ModoPedido;
  pagamento: FormaPagamento;
  troco_para: number | null;
  nome: string | null;
  telefone: string | null;
  endereco: string | null;
  observacoes: string | null;
  subtotal: number;
  taxa_entrega: number;
  total: number;
  tem_item_sob_consulta: boolean;
  motivo_cancelamento: string | null;
  cancelado_por: "loja" | "cliente" | "sistema" | null;
  criado_em: string;
  atualizado_em: string;
  pode_avaliar: boolean;
  avaliado: boolean;
  moderada: boolean;
  loja: { id: string; nome: string; whatsapp: string };
  itens: { nome: string; preco_unit: number | null; quantidade: number; detalhes?: { rotulo: string; opcoes: { nome: string; preco?: number | null }[] }[] | null }[];
}

/** Etapas mostradas ao cliente, na ordem (o cancelamento é mostrado à parte). */
export function etapasDoPedido(modo: ModoPedido): { status: StatusPedido; rotulo: string }[] {
  return [
    { status: "novo", rotulo: "Enviado" },
    { status: "em_preparo", rotulo: "Em preparo" },
    modo === "entrega"
      ? { status: "saiu_para_entrega", rotulo: "Saiu para entrega" }
      : { status: "pronto_para_retirada", rotulo: "Pronto para retirar" },
    { status: "concluido", rotulo: "Concluído" },
  ];
}
