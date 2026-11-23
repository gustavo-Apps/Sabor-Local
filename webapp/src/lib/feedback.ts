// Fale conosco: texto e link da issue do GitHub. Sem dependências, para rodar no servidor e nos testes.

export const REPOSITORIO = "https://github.com/gustavo-Apps/projeto-cardapio-digital";

const ROTULOS = { problema: "bug", sugestao: "enhancement", duvida: "question" } as const;
const PREFIXOS = { problema: "Problema", sugestao: "Sugestão", duvida: "Dúvida" } as const;

export interface FeedbackBasico {
  tipo: keyof typeof ROTULOS;
  mensagem: string;
  pagina: string | null;
}

/**
 * Link do "Nova issue" do GitHub já preenchido. O administrador confere, ajusta e envia.
 * O contato de quem escreveu NUNCA entra aqui: a issue pode ficar pública.
 */
export function linkNovaIssue(f: FeedbackBasico): string {
  const primeiraLinha = f.mensagem.split("\n")[0].trim();
  const titulo = `${PREFIXOS[f.tipo]}: ${primeiraLinha.length > 70 ? `${primeiraLinha.slice(0, 67)}...` : primeiraLinha}`;
  const corpo = [
    f.mensagem,
    "",
    "---",
    f.pagina ? `Página: ${f.pagina}` : "Página: não informada",
    "Origem: formulário Fale conosco do Sabor Local",
  ].join("\n");
  const params = new URLSearchParams({ title: titulo, body: corpo, labels: ROTULOS[f.tipo] });
  return `${REPOSITORIO}/issues/new?${params.toString()}`;
}

/** Só aceita endereço de issue do próprio repositório (campo opcional do painel). */
export function issueDoRepositorio(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  return u.startsWith(`${REPOSITORIO}/issues/`) && u.length <= 300 && !/\s/.test(u) ? u : null;
}

/** Aceita só caminhos internos: "/painel" sim, "https://outro.site" e "//x.com" não. */
export function caminhoInterno(valor: string | undefined): string {
  const v = (valor ?? "").trim();
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") && v.length <= 200 ? v : "";
}

// ---------------------------------------------------------------------------
// Responder a quem escreveu (o contato é opcional e fica só com o administrador)
// ---------------------------------------------------------------------------

export type ContatoClassificado =
  | { tipo: "email"; valor: string }
  | { tipo: "whatsapp"; valor: string } // só dígitos, com 55
  | { tipo: "desconhecido" };

const EMAIL_CONTATO = /^[^\s@,;<>()"']+@[^\s@,;<>()"']+\.[^\s@,;<>()"']{2,}$/;

/**
 * O campo "contato" é texto livre digitado por qualquer pessoa. Só vira link de resposta se for claramente um e-mail ou um
 * telefone brasileiro (10 a 11 dígitos, com ou sem 55); qualquer outra coisa fica como "desconhecido" e não vira link.
 */
export function classificarContato(contato: string | null | undefined): ContatoClassificado {
  const c = (contato ?? "").trim();
  if (!c) return { tipo: "desconhecido" };

  if (c.includes("@")) {
    return c.length <= 254 && EMAIL_CONTATO.test(c) ? { tipo: "email", valor: c.toLowerCase() } : { tipo: "desconhecido" };
  }

  // só aceita telefone escrito como telefone (dígitos, espaço, parênteses, hífen e +), nada de texto no meio
  if (!/^[+\d\s().-]+$/.test(c)) return { tipo: "desconhecido" };
  let d = c.replace(/\D/g, "");
  if (d.length === 12 || d.length === 13) {
    if (!d.startsWith("55")) return { tipo: "desconhecido" };
  } else if (d.length === 10 || d.length === 11) {
    d = `55${d}`;
  } else {
    return { tipo: "desconhecido" };
  }
  return { tipo: "whatsapp", valor: d };
}

const TITULOS_RESPOSTA = { problema: "sobre o problema que você relatou", sugestao: "sobre a sua sugestão", duvida: "sobre a sua dúvida" } as const;

/** Texto-base da resposta: a equipe revisa e completa antes de enviar. */
export function textoBaseDaResposta(f: { tipo: keyof typeof TITULOS_RESPOSTA; mensagem: string }): string {
  const trecho = f.mensagem.replace(/\s+/g, " ").trim();
  const resumo = trecho.length > 100 ? `${trecho.slice(0, 97)}...` : trecho;
  return `Olá! Aqui é a equipe do Sabor Local, respondendo ${TITULOS_RESPOSTA[f.tipo]}: “${resumo}”\n\n`;
}

/**
 * Link para o administrador responder: mailto: (e-mail) ou wa.me (WhatsApp) já com o texto-base.
 * Devolve null quando não há contato confiável.
 */
export function linkResposta(f: { tipo: keyof typeof TITULOS_RESPOSTA; mensagem: string; contato: string | null }): string | null {
  const c = classificarContato(f.contato);
  const texto = textoBaseDaResposta(f);
  if (c.tipo === "email") {
    return `mailto:${encodeURIComponent(c.valor).replace(/%40/g, "@")}?subject=${encodeURIComponent("Sabor Local: resposta à sua mensagem")}&body=${encodeURIComponent(texto)}`;
  }
  if (c.tipo === "whatsapp") return `https://wa.me/${c.valor}?text=${encodeURIComponent(texto)}`;
  return null;
}

// ---------------------------------------------------------------------------
// Saúde do canal Fale conosco (Resumo do administrador)
// ---------------------------------------------------------------------------

export interface ContagemFeedback {
  novo: number;
  aceito: number;
  recusado: number;
  resolvido: number;
}

export interface SaudeDoCanal {
  total: number;
  /** Mensagens que o administrador já olhou (aceitas, recusadas ou resolvidas). */
  tratadas: number;
  /** Ainda esperando leitura. */
  pendentes: number;
  /** Aceitas ou já resolvidas: as que viraram melhoria. */
  aproveitadas: number;
  /** % das tratadas que foram aproveitadas; nulo enquanto nada foi tratado. */
  taxaDeAproveitamento: number | null;
}

export function saudeDoCanal(c: ContagemFeedback): SaudeDoCanal {
  const aproveitadas = c.aceito + c.resolvido;
  const tratadas = aproveitadas + c.recusado;
  return {
    total: tratadas + c.novo,
    tratadas,
    pendentes: c.novo,
    aproveitadas,
    taxaDeAproveitamento: tratadas === 0 ? null : Math.round((aproveitadas / tratadas) * 100),
  };
}
