// Arquivo de "Baixar meus dados" (LGPD): confere o que o banco devolveu e dá nome ao arquivo.
// Sem dependências do app, para rodar também nos testes.

/** Chaves que nunca podem sair no arquivo, em nenhum nível, mesmo que o banco um dia as devolva por engano. */
export const CHAVES_PROIBIDAS = ["owner_id", "codigo_verificacao", "ip_hash", "denuncias", "contato_de_quem_denunciou", "password", "encrypted_password"];

const SECOES = ["conta", "perfil", "ramos", "horarios", "datas_especiais", "menu", "avaliacoes_recebidas", "pagamentos_do_destaque"];

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Copia o valor sem as chaves proibidas (recursivo). Não altera o original. */
export function removerCamposSensiveis(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(removerCamposSensiveis);
  if (!ehObjeto(valor)) return valor;
  const limpo: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(valor)) {
    if (CHAVES_PROIBIDAS.includes(k)) continue;
    limpo[k] = removerCamposSensiveis(v);
  }
  return limpo;
}

/** "sabor-local-meus-dados-2031-10-06.json" (data de Brasília). */
export function nomeDoArquivo(agora: Date = new Date()): string {
  // en-CA formata como AAAA-MM-DD
  const data = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  return `sabor-local-meus-dados-${data}.json`;
}

export type Exportacao = { ok: true; corpo: string; nome: string } | { ok: false; erro: string };

/**
 * Valida a resposta de `exportar_meus_dados` e devolve o texto do arquivo (JSON legível) e o nome.
 * Recusa resposta vazia ou fora do formato, para nunca entregar um arquivo quebrado.
 */
export function prepararExportacao(bruto: unknown, agora: Date = new Date()): Exportacao {
  if (!ehObjeto(bruto)) return { ok: false, erro: "Não foi possível gerar o arquivo agora." };
  for (const secao of SECOES) {
    if (!(secao in bruto)) return { ok: false, erro: `O arquivo veio incompleto (faltou: ${secao}).` };
  }
  if (!ehObjeto(bruto.conta) || typeof bruto.conta.email !== "string") {
    return { ok: false, erro: "Não encontramos os dados da sua conta." };
  }
  return { ok: true, corpo: JSON.stringify(removerCamposSensiveis(bruto), null, 2), nome: nomeDoArquivo(agora) };
}
