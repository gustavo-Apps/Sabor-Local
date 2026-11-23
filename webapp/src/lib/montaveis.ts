// "Monte o seu": produtos que o cliente monta (pizza, açaí, marmita...). Tamanho com preço fixo, escolhas incluídas
// (sabores, acompanhamentos) até um máximo por tamanho, e adicionais pagos. Regras puras, sem imports de outros arquivos,
// para rodar no navegador, no servidor e nos testes. O banco confere tudo de novo (função `resolver_montagem`).

export interface TamanhoDoMontavel {
  id: string;
  nome: string;
  preco: number;
  /** Quantas escolhas (sabores...) este tamanho inclui; 0 = nenhuma. */
  maxEscolhas: number;
}

export interface EscolhaDoMontavel {
  id: string;
  nome: string;
  descricao?: string | null;
  foto_url?: string | null;
}

export interface AdicionalDoMontavel {
  id: string;
  nome: string;
  preco: number;
}

/** Um produto montável como o cliente vê: só o que está disponível agora. */
export interface Montavel {
  id: string;
  nome: string;
  descricao: string | null;
  /** Como chamar as escolhas incluídas: "Sabores", "Acompanhamentos", "Recheios"... */
  rotuloEscolhas: string;
  escolhaObrigatoria: boolean;
  rotuloAdicionais: string;
  maxAdicionais: number;
  tamanhos: TamanhoDoMontavel[];
  escolhas: EscolhaDoMontavel[];
  adicionais: AdicionalDoMontavel[];
}

/** O que o cliente montou. */
export interface Montagem {
  montavelId: string;
  tamanhoId: string;
  escolhas: string[];
  adicionais: string[];
}

export const MAX_TAMANHOS = 6;
export const MAX_MONTAVEIS_POR_LOJA = 5;
export const MAX_ADICIONAIS_CADASTRADOS = 30;

const arredondar = (n: number) => Math.round(n * 100) / 100;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const LISTA = `(?:${UUID}(?:,${UUID})*)?`;

/** Formato da chave no carrinho: m|produto|tamanho|escolhas|adicionais (ids separados por vírgula, em ordem). */
export const CHAVE_DE_MONTAGEM = new RegExp(`^m\\|${UUID}\\|${UUID}\\|${LISTA}\\|${LISTA}$`, "i");

// ---------------------------------------------------------------------------
// Chave no carrinho: a própria montagem. Duas pizzas iguais somam a quantidade; pizzas diferentes são linhas diferentes.
// ---------------------------------------------------------------------------

export function chaveDaMontagem(m: Montagem): string {
  return ["m", m.montavelId, m.tamanhoId, [...m.escolhas].sort().join(","), [...m.adicionais].sort().join(",")].join("|");
}

export function lerChaveDaMontagem(chave: string): Montagem | null {
  if (!CHAVE_DE_MONTAGEM.test(chave)) return null;
  const [, montavelId, tamanhoId, escolhas, adicionais] = chave.split("|");
  return {
    montavelId,
    tamanhoId,
    escolhas: escolhas ? escolhas.split(",") : [],
    adicionais: adicionais ? adicionais.split(",") : [],
  };
}

// ---------------------------------------------------------------------------
// Conferência e preço
// ---------------------------------------------------------------------------

export const tamanhoDa = (montavel: Montavel, m: Pick<Montagem, "tamanhoId">) => montavel.tamanhos.find((t) => t.id === m.tamanhoId);

/** Tamanhos em que dá para montar agora (inclui os sem escolhas; exige escolha disponível quando é obrigatória). */
export function tamanhosMontaveis(montavel: Montavel): TamanhoDoMontavel[] {
  return montavel.tamanhos.filter((t) => !(montavel.escolhaObrigatoria && t.maxEscolhas > 0 && montavel.escolhas.length === 0));
}

/**
 * O que falta ou sobra na montagem, escrito para o cliente; nulo quando está tudo certo.
 * Serve tanto para travar o botão quanto para descartar do carrinho uma montagem que deixou de valer.
 */
export function problemaDaMontagem(montavel: Montavel, m: Montagem): string | null {
  const tamanho = tamanhoDa(montavel, m);
  if (!tamanho) return `Escolha o tamanho.`;
  const rotulo = montavel.rotuloEscolhas.toLowerCase();

  if (new Set(m.escolhas).size !== m.escolhas.length || new Set(m.adicionais).size !== m.adicionais.length) return "Há uma opção repetida.";
  if (m.escolhas.some((id) => !montavel.escolhas.some((e) => e.id === id))) return `Um dos ${rotulo} não está mais disponível.`;
  if (m.adicionais.some((id) => !montavel.adicionais.some((a) => a.id === id))) return `Um dos ${montavel.rotuloAdicionais.toLowerCase()} não está mais disponível.`;

  if (m.escolhas.length > tamanho.maxEscolhas) {
    const sobra = m.escolhas.length - tamanho.maxEscolhas;
    return tamanho.maxEscolhas === 0
      ? `Este tamanho não inclui ${rotulo}. Tire ${sobra}.`
      : `Este tamanho aceita até ${tamanho.maxEscolhas} ${rotulo}. Tire ${sobra}.`;
  }
  if (montavel.escolhaObrigatoria && tamanho.maxEscolhas > 0 && m.escolhas.length === 0) return `Escolha pelo menos 1 entre os ${rotulo}.`;
  if (m.adicionais.length > montavel.maxAdicionais) return `Você pode pedir até ${montavel.maxAdicionais} ${montavel.rotuloAdicionais.toLowerCase()}.`;
  return null;
}

/** Preço de uma unidade: o do tamanho mais os adicionais. As escolhas incluídas não mudam o valor. */
export function precoDaMontagem(montavel: Montavel, m: Montagem): number {
  const tamanho = tamanhoDa(montavel, m);
  if (!tamanho) return 0;
  const extras = m.adicionais.reduce((soma, id) => soma + (montavel.adicionais.find((a) => a.id === id)?.preco ?? 0), 0);
  return arredondar(tamanho.preco + extras);
}

/** "Pizza Média (30 cm)": o nome que vai para o pedido. */
export function nomeDaMontagem(montavel: Montavel, m: Pick<Montagem, "tamanhoId">): string {
  const tamanho = tamanhoDa(montavel, m);
  return tamanho ? `${montavel.nome} ${tamanho.nome}` : montavel.nome;
}

export interface GrupoDeDetalhes {
  rotulo: string;
  opcoes: { nome: string; preco?: number | null }[];
}

/** O que o cliente escolheu, na ordem em que a loja cadastrou (a mesma que o banco grava no pedido). */
export function detalhesDaMontagem(montavel: Montavel, m: Montagem): GrupoDeDetalhes[] {
  const grupos: GrupoDeDetalhes[] = [];
  const escolhidas = montavel.escolhas.filter((e) => m.escolhas.includes(e.id));
  if (escolhidas.length > 0) grupos.push({ rotulo: montavel.rotuloEscolhas, opcoes: escolhidas.map((e) => ({ nome: e.nome })) });
  const extras = montavel.adicionais.filter((a) => m.adicionais.includes(a.id));
  if (extras.length > 0) grupos.push({ rotulo: montavel.rotuloAdicionais, opcoes: extras.map((a) => ({ nome: a.nome, preco: a.preco })) });
  return grupos;
}

/** "Sabores: Calabresa, Frango" / "Adicionais: Bacon (+R$ 3,00)": uma linha por grupo, para telas e mensagens. */
export function textoDosDetalhes(grupos: readonly GrupoDeDetalhes[] | null | undefined): string[] {
  const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (grupos ?? [])
    .filter((g) => g && Array.isArray(g.opcoes) && g.opcoes.length > 0)
    .map((g) => `${g.rotulo}: ${g.opcoes.map((o) => (o.preco ? `${o.nome} (+${reais(Number(o.preco))})` : o.nome)).join(", ")}`);
}

export function menorPreco(montavel: Montavel): number | null {
  const precos = tamanhosMontaveis(montavel).map((t) => t.preco);
  return precos.length > 0 ? Math.min(...precos) : null;
}

/** Montáveis em que o cliente consegue montar alguma coisa agora. */
export function montaveisDisponiveis(montaveis: readonly Montavel[]): Montavel[] {
  return montaveis.filter((m) => tamanhosMontaveis(m).length > 0);
}

// ---------------------------------------------------------------------------
// Carrinho
// ---------------------------------------------------------------------------

export interface LinhaMontada {
  chave: string;
  montavelId: string;
  nome: string;
  preco: number;
  quantidade: number;
  detalhes: GrupoDeDetalhes[];
  montagem: Montagem;
}

/** Junta o carrinho com os produtos de agora: montagem que deixou de valer (tamanho, sabor ou adicional sumiu) sai do pedido. */
export function linhasMontadas(carrinho: Readonly<Record<string, number>>, montaveis: readonly Montavel[]): LinhaMontada[] {
  const linhas: LinhaMontada[] = [];
  for (const [chave, quantidade] of Object.entries(carrinho)) {
    const montagem = lerChaveDaMontagem(chave);
    if (!montagem || !(quantidade > 0)) continue;
    const montavel = montaveis.find((m) => m.id === montagem.montavelId);
    if (!montavel || !tamanhosMontaveis(montavel).some((t) => t.id === montagem.tamanhoId)) continue;
    if (problemaDaMontagem(montavel, montagem)) continue;
    linhas.push({
      chave,
      montavelId: montavel.id,
      nome: nomeDaMontagem(montavel, montagem),
      preco: precoDaMontagem(montavel, montagem),
      quantidade,
      detalhes: detalhesDaMontagem(montavel, montagem),
      montagem,
    });
  }
  return linhas;
}

/** O que vai para `criar_pedido`: só ids e quantidade (o preço nunca sai daqui). */
export function montagemParaEnviar(l: Pick<LinhaMontada, "montagem" | "quantidade">) {
  return {
    montavel_id: l.montagem.montavelId,
    tamanho_id: l.montagem.tamanhoId,
    escolhas: l.montagem.escolhas,
    adicionais: l.montagem.adicionais,
    quantidade: l.quantidade,
  };
}

// ---------------------------------------------------------------------------
// Do banco para a tela
// ---------------------------------------------------------------------------

/** Como o Supabase devolve um produto montável com tamanhos, adicionais e categorias das escolhas. */
export interface MontavelBruto {
  id: string;
  nome: string;
  descricao: string | null;
  rotulo_escolhas: string;
  escolha_obrigatoria: boolean;
  rotulo_adicionais: string;
  max_adicionais: number;
  disponivel: boolean;
  ordem: number;
  tamanhos: { id: string; nome: string; preco: number | string; max_escolhas: number; ordem: number }[];
  adicionais: { id: string; nome: string; preco: number | string; disponivel: boolean; ordem: number }[];
  categorias: { categoria_produto_id: string }[];
}

export interface ItemParaEscolha {
  id: string;
  nome: string;
  descricao: string | null;
  foto_url: string | null;
  ordem: number;
  categoria_produto_id: string | null;
  /** Só os itens disponíveis agora entram como escolha. */
  disponivel: boolean;
}

/** Monta o que o cliente vê. Produto pausado ou sem tamanhos não aparece; as escolhas são os itens disponíveis das categorias marcadas. */
export function montarMontaveis(brutos: readonly MontavelBruto[], itens: readonly ItemParaEscolha[]): Montavel[] {
  return [...brutos]
    .filter((b) => b.disponivel && b.tamanhos.length > 0)
    .sort((a, b) => a.ordem - b.ordem)
    .map((b) => {
      const categorias = new Set(b.categorias.map((c) => c.categoria_produto_id));
      return {
        id: b.id,
        nome: b.nome,
        descricao: b.descricao,
        rotuloEscolhas: b.rotulo_escolhas,
        escolhaObrigatoria: b.escolha_obrigatoria,
        rotuloAdicionais: b.rotulo_adicionais,
        maxAdicionais: b.max_adicionais,
        tamanhos: [...b.tamanhos]
          .sort((x, y) => x.ordem - y.ordem)
          .map((t) => ({ id: t.id, nome: t.nome, preco: Number(t.preco), maxEscolhas: t.max_escolhas })),
        escolhas: itens
          .filter((i) => i.disponivel && i.categoria_produto_id !== null && categorias.has(i.categoria_produto_id))
          .sort((x, y) => x.ordem - y.ordem)
          .map((i) => ({ id: i.id, nome: i.nome, descricao: i.descricao, foto_url: i.foto_url })),
        adicionais: [...b.adicionais]
          .filter((a) => a.disponivel)
          .sort((x, y) => x.ordem - y.ordem)
          .map((a) => ({ id: a.id, nome: a.nome, preco: Number(a.preco) })),
      };
    });
}

/** Ids dos itens que são só "escolha" de algum produto montável: sem preço, não se pede sozinho. */
export function itensSoDeEscolha(brutos: readonly MontavelBruto[], itens: readonly { id: string; preco: number | null; categoria_produto_id: string | null }[]): Set<string> {
  const categorias = new Set(brutos.flatMap((b) => b.categorias.map((c) => c.categoria_produto_id)));
  return new Set(itens.filter((i) => i.preco === null && i.categoria_produto_id !== null && categorias.has(i.categoria_produto_id)).map((i) => i.id));
}

/** Resumo de uma montagem para o WhatsApp de uma loja que não recebe pedido pelo site. */
export function mensagemDaMontagem(montavel: Montavel, m: Montagem): string {
  const linhas = [`${nomeDaMontagem(montavel, m)} (${precoDaMontagem(montavel, m).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`];
  for (const texto of textoDosDetalhes(detalhesDaMontagem(montavel, m))) linhas.push(`   ${texto}`);
  return linhas.join("\n");
}
