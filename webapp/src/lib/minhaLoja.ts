// "Esta é a minha loja": quem está logado e dono do perfil não é cliente dele. Sem dependências, para rodar nos testes.

/** Verdadeiro quando a pessoa logada é a dona deste perfil. Sem login (ou sem loja), nunca. */
export function ehMinhaLoja(minhaLojaId: string | null | undefined, vendedorId: string | null | undefined): boolean {
  return Boolean(minhaLojaId) && Boolean(vendedorId) && minhaLojaId === vendedorId;
}
