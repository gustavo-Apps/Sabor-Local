// Content-Security-Policy em modo "só relatar" (Report-Only): monta a política e resume os relatórios que o navegador envia.
// Sem dependências do app, para rodar também nos testes.

/**
 * Política que o navegador só AVALIA e relata (não bloqueia nada). Serve para medir o que quebraria antes de passar a bloquear.
 * - 'unsafe-inline' em script e estilo: o Next injeta scripts e estilos inline (trocar por nonce é o passo seguinte);
 * - 'unsafe-eval' só em desenvolvimento (o recarregamento a quente precisa);
 * - imagens e conexões: o próprio site e o Supabase (fotos do menu, cardápios, banco e login).
 */
export function montarCspReportOnly(supabaseUrl: string | undefined, emDesenvolvimento: boolean): string {
  let supabase = "";
  let supabaseWs = "";
  try {
    if (supabaseUrl) {
      const u = new URL(supabaseUrl);
      supabase = u.origin;
      supabaseWs = `${u.protocol === "https:" ? "wss:" : "ws:"}//${u.host}`;
    }
  } catch {
    // endereço inválido: segue só com o próprio site
  }
  const fonte = (...itens: string[]) => itens.filter(Boolean).join(" ");

  return [
    "default-src 'self'",
    `script-src ${fonte("'self'", "'unsafe-inline'", emDesenvolvimento ? "'unsafe-eval'" : "")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${fonte("'self'", "data:", "blob:", supabase)}`,
    "font-src 'self' data:",
    `connect-src ${fonte("'self'", supabase, supabaseWs)}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "report-uri /csp-report",
  ].join("; ");
}

/** Endereço sem parâmetros nem âncora, e sem o segredo do link de avaliação (/avaliar/<token> vira /avaliar/*). */
export function limparEndereco(endereco: unknown): string {
  if (typeof endereco !== "string" || !endereco) return "";
  const bruto = endereco.slice(0, 500);
  let base = bruto;
  try {
    const u = new URL(bruto);
    base = `${u.origin}${u.pathname}`;
  } catch {
    base = bruto.split(/[?#]/)[0];
  }
  return base.replace(/\/avaliar\/[^/]+/g, "/avaliar/*").slice(0, 200);
}

const texto = (v: unknown) => (typeof v === "string" ? v.slice(0, 200) : "");

export interface ResumoViolacao {
  diretiva: string;
  bloqueado: string;
  pagina: string;
}

/**
 * Resume um relatório de violação (formato antigo `{"csp-report": {...}}` ou o novo, uma lista de `{type, body}`).
 * Devolve só o essencial, com endereços limpos, e nunca o texto livre que veio no relatório. Nulo se não for um relatório.
 */
export function resumirRelatorioCsp(corpo: unknown): ResumoViolacao | null {
  const item = Array.isArray(corpo) ? corpo[0] : corpo;
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;
  const r = (obj["csp-report"] && typeof obj["csp-report"] === "object" ? obj["csp-report"] : obj.body) as Record<string, unknown> | undefined;
  if (!r || typeof r !== "object") return null;

  const diretiva = texto(r["effective-directive"] ?? r["violated-directive"] ?? r.effectiveDirective ?? r.violatedDirective);
  if (!diretiva) return null;
  return {
    diretiva,
    bloqueado: limparEndereco(r["blocked-uri"] ?? r.blockedURL ?? r.blockedUri) || texto(r["blocked-uri"] ?? r.blockedURL),
    pagina: limparEndereco(r["document-uri"] ?? r.documentURL ?? r.documentUri),
  };
}
