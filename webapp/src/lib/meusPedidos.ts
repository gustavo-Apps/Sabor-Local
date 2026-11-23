// "Meus pedidos": a lista dos pedidos que a pessoa fez, guardada no navegador dela (não há conta de cliente).
// Só funções puras, sem imports e sem acesso ao navegador, para testar sem tela.
//
// O que se guarda de cada pedido é o mínimo para achá-lo de novo: o link secreto (token), a loja, o número e o valor.
// O status e os itens vêm sempre do banco, pelo link. Se o navegador for limpo ou a pessoa trocar de aparelho, a lista some;
// o link do pedido continua valendo.

export const CHAVE_DOS_PEDIDOS = "sabor-local:meus-pedidos";
export const MAX_PEDIDOS_GUARDADOS = 30;

export interface PedidoGuardado {
  /** O link secreto do pedido (64 caracteres). */
  token: string;
  lojaId: string;
  lojaNome: string;
  numero: number;
  total: number;
  /** Quando foi feito (ISO). */
  criadoEm: string;
}

const TOKEN = /^[0-9a-f]{64}$/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max) : "");

/** Confere um registro; nulo se estiver estragado ou adulterado. */
export function pedidoGuardadoValido(bruto: unknown): PedidoGuardado | null {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  const p = bruto as Record<string, unknown>;
  const token = typeof p.token === "string" ? p.token.toLowerCase() : "";
  const lojaNome = texto(p.lojaNome, 80);
  const criadoEm = typeof p.criadoEm === "string" ? p.criadoEm : "";
  if (!TOKEN.test(token) || typeof p.lojaId !== "string" || !ID.test(p.lojaId) || !lojaNome) return null;
  if (typeof p.numero !== "number" || !Number.isInteger(p.numero) || p.numero < 1 || p.numero > 10_000_000) return null;
  if (typeof p.total !== "number" || !Number.isFinite(p.total) || p.total < 0 || p.total > 1_000_000) return null;
  if (!criadoEm || Number.isNaN(Date.parse(criadoEm))) return null;
  return { token, lojaId: p.lojaId, lojaNome, numero: p.numero, total: p.total, criadoEm: new Date(criadoEm).toISOString() };
}

const maisNovoPrimeiro = (a: PedidoGuardado, b: PedidoGuardado) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm);

/** Lê o que estava guardado: qualquer coisa estranha é descartada, sem repetir o mesmo pedido, no máximo 30, do mais novo ao mais antigo. */
export function lerPedidosGuardados(guardado: string | null | undefined): PedidoGuardado[] {
  if (!guardado) return [];
  try {
    const bruto: unknown = JSON.parse(guardado);
    if (!Array.isArray(bruto)) return [];
    const vistos = new Set<string>();
    const lista: PedidoGuardado[] = [];
    for (const item of bruto.slice(0, MAX_PEDIDOS_GUARDADOS * 2)) {
      const p = pedidoGuardadoValido(item);
      if (!p || vistos.has(p.token)) continue;
      vistos.add(p.token);
      lista.push(p);
    }
    return lista.sort(maisNovoPrimeiro).slice(0, MAX_PEDIDOS_GUARDADOS);
  } catch {
    return [];
  }
}

/** Entra na lista (ou atualiza o que já estava); passando de 30, os mais antigos saem. Registro inválido não entra. */
export function guardarPedido(lista: readonly PedidoGuardado[], novo: PedidoGuardado): PedidoGuardado[] {
  const p = pedidoGuardadoValido(novo);
  if (!p) return [...lista];
  return [p, ...lista.filter((x) => x.token !== p.token)].sort(maisNovoPrimeiro).slice(0, MAX_PEDIDOS_GUARDADOS);
}

export function removerPedidoGuardado(lista: readonly PedidoGuardado[], token: string): PedidoGuardado[] {
  return lista.filter((p) => p.token !== token);
}

export const pedidosParaGuardar = (lista: readonly PedidoGuardado[]) => JSON.stringify(lista);

/**
 * Quais pedidos consultar no banco agora: os que ainda não se sabe o status (primeira vez, ou a consulta anterior falhou) e os
 * que estão abertos. Pedido concluído ou cancelado não muda mais, então não se consulta de novo.
 */
export function tokensParaConsultar(
  tokens: readonly string[],
  statusConhecidos: Readonly<Record<string, string | undefined>>,
  statusAbertos: readonly string[],
): string[] {
  return tokens.filter((t) => {
    const status = statusConhecidos[t];
    return status === undefined || statusAbertos.includes(status);
  });
}
