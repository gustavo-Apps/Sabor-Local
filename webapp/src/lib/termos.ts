// Aceite dos Termos de Uso e da Política de Privacidade por versão. Sem dependências, para rodar nos testes.

/** Mesmo formato que o banco aceita em aceitar_termos: AAAA-MM, com sufixo opcional. */
export const FORMATO_VERSAO_TERMOS = /^\d{4}-\d{2}(-[a-z0-9]{1,10})?$/;

/**
 * O vendedor precisa aceitar de novo quando nunca aceitou (conta antiga ou sem registro) ou quando
 * aceitou uma versão diferente da atual (os Termos ou a Política mudaram).
 */
export function precisaAceitarTermos(versaoAceita: string | null | undefined, versaoAtual: string): boolean {
  return (versaoAceita ?? "").trim() !== versaoAtual;
}
