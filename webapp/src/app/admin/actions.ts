"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { caminhoNoBucket } from "@/lib/imagem";
import { issueDoRepositorio } from "@/lib/feedback";
import { validarBairro, validarCidade, validarConfiguracoes, validarPagamento } from "@/lib/validacao";

type Estado = { erro?: string; ok?: string };

// A autorização real é o RLS (is_admin()); aqui só evitamos trabalho inútil.
async function admin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.rpc("is_admin");
  if (!data) redirect("/painel");
  return supabase;
}

const campo = (form: FormData, nome: string) => String(form.get(nome) ?? "");

export async function tratarDenuncia(form: FormData) {
  const supabase = await admin();
  const status = campo(form, "status");
  if (!["resolvida", "descartada"].includes(status)) return;
  await supabase.from("denuncias").update({ status }).eq("id", campo(form, "id"));
  revalidatePath("/admin");
}

// Fale conosco: aceitar (vira issue no GitHub), recusar ou marcar como resolvido.
export async function tratarFeedback(form: FormData) {
  const supabase = await admin();
  const status = campo(form, "status");
  if (!["aceito", "recusado", "resolvido"].includes(status)) return;
  const issue = issueDoRepositorio(campo(form, "issue_url"));
  await supabase
    .from("feedbacks")
    .update({ status, tratado_em: new Date().toISOString(), ...(issue ? { issue_url: issue } : {}) })
    .eq("id", campo(form, "id"));
  revalidatePath("/admin");
}

// Moderação: tira o link de pedidos de um perfil (endereço impróprio, golpe, site fora do ar). O histórico registra a alteração.
export async function removerLinkPedido(form: FormData) {
  const supabase = await admin();
  await supabase
    .from("vendedores")
    .update({ link_pedido_url: null, link_pedido_rotulo: null })
    .eq("id", campo(form, "vendedor_id"));
  revalidatePath("/admin");
  revalidatePath("/vendedores/[id]", "page");
}

// Moderação: tira a logo ou o banner de um perfil (imagem imprópria ou que não é do vendedor). O histórico registra a alteração.
export async function removerImagemPerfil(form: FormData) {
  const supabase = await admin();
  const tipo = campo(form, "tipo");
  if (tipo !== "logo" && tipo !== "banner") return;
  const coluna = tipo === "logo" ? "logo_url" : "banner_url";
  const id = campo(form, "vendedor_id");

  const { data } = await supabase.from("vendedores").select(coluna).eq("id", id).maybeSingle();
  const { error } = await supabase.from("vendedores").update({ [coluna]: null }).eq("id", id);
  if (error) return;

  // O arquivo fica na pasta do dono; só a chave de serviço consegue apagá-lo. É faxina: se falhar, a imagem já saiu do ar.
  const caminho = caminhoNoBucket((data as Record<string, string | null> | null)?.[coluna]);
  if (caminho) {
    try {
      await createAdminClient().storage.from("cardapios").remove([caminho]);
    } catch {
      // sem a chave de serviço (ambiente local sem .env completo): o arquivo órfão não afeta o site
    }
  }
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/vendedores/[id]", "page");
}

export async function alternarVendedor(form: FormData) {
  const supabase = await admin();
  const ativo = campo(form, "ativo") === "true";
  await supabase
    .from("vendedores")
    .update({
      ativo,
      // aprovar pela primeira vez registra a data de aprovação
      ...(ativo && campo(form, "aprovar") === "true" ? { aprovado_em: new Date().toISOString() } : {}),
    })
    .eq("id", campo(form, "vendedor_id"));
  revalidatePath("/admin");
  revalidatePath("/");
}

// Suporte: tira o aviso de férias/"não abre hoje" de um vendedor
export async function limparAviso(form: FormData) {
  const supabase = await admin();
  await supabase
    .from("vendedores")
    .update({ status_manual: "normal", status_manual_ate: null, status_manual_msg: null })
    .eq("id", campo(form, "vendedor_id"));
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function moderarAvaliacao(form: FormData) {
  const supabase = await admin();
  const id = campo(form, "id");
  if (campo(form, "acao") === "aprovar") {
    await supabase.from("avaliacoes").update({ aprovada: true }).eq("id", id);
  } else {
    await supabase.from("avaliacoes").delete().eq("id", id);
  }
  revalidatePath("/admin");
}

export async function registrarPagamento(_: Estado, form: FormData): Promise<Estado> {
  const supabase = await admin();
  const v = validarPagamento({
    dias: campo(form, "dias"),
    valor: campo(form, "valor"),
    forma: campo(form, "forma"),
    obs: campo(form, "obs"),
  });
  if (!v.ok) return { erro: v.erro };

  const { data, error } = await supabase.rpc("admin_registrar_pagamento", {
    p_vendedor: campo(form, "vendedor_id"),
    p_dias: v.valor.dias,
    p_valor: v.valor.valor,
    p_forma: v.valor.forma,
    p_observacao: v.valor.observacao,
  });
  if (error) return { erro: "Não foi possível registrar agora. Tente novamente." };

  revalidatePath("/admin");
  revalidatePath("/");
  const ate = new Date(data as string).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return { ok: `Registrado! Destaque ativo até ${ate}.` };
}

export async function removerDestaque(form: FormData) {
  const supabase = await admin();
  await supabase.rpc("admin_remover_destaque", { p_vendedor: campo(form, "vendedor_id") });
  revalidatePath("/admin");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Cidades e bairros (Fase 4)
// ---------------------------------------------------------------------------

function revalidarCidades() {
  revalidatePath("/admin");
  revalidatePath("/painel");
  revalidatePath("/", "layout");
}

function erroDeCidade(codigo: string | undefined): string {
  if (codigo === "23505") return "Já existe uma cidade com esse nome ou com esse endereço (slug).";
  return "Não foi possível salvar agora. Tente novamente.";
}

// O que passa por conferência do admin: avaliações novas e vendedores novos. Vale só para o que chegar depois;
// o que já está na fila continua pendente até alguém aprovar.
export async function salvarConfiguracoes(_: Estado, form: FormData): Promise<Estado> {
  const supabase = await admin();
  const v = validarConfiguracoes({ avaliacoes: campo(form, "avaliacoes"), vendedores: campo(form, "vendedores") });
  if (!v.ok) return { erro: v.erro };

  const { error } = await supabase.from("configuracoes").update(v.valor).eq("id", true);
  if (error) return { erro: "Não foi possível salvar agora. Tente de novo." };

  revalidatePath("/admin");
  return { ok: "Configurações salvas. Valem para o que chegar a partir de agora." };
}

export async function criarCidade(_: Estado, form: FormData): Promise<Estado> {
  const supabase = await admin();
  const v = validarCidade({ nome: campo(form, "nome"), uf: campo(form, "uf") });
  if (!v.ok) return { erro: v.erro };

  const { error } = await supabase.from("cidades").insert(v.valor);
  if (error) return { erro: erroDeCidade(error.code) };

  revalidarCidades();
  return { ok: `Cidade "${v.valor.nome}" criada. Agora cadastre os bairros dela.` };
}

// Fila de sugestões de bairro (feitas pelos vendedores): aprovar cria o bairro, juntar usa um existente, recusar descarta.
export async function tratarSugestaoBairro(form: FormData) {
  const supabase = await admin();
  const acao = campo(form, "acao");
  if (!["aprovar", "unir", "recusar"].includes(acao)) return;
  await supabase.rpc("admin_tratar_sugestao", {
    p_id: campo(form, "id"),
    p_acao: acao,
    p_bairro: campo(form, "bairro_id") || null,
  });
  revalidarCidades();
  revalidatePath("/vendedores/[id]", "page");
}

export async function renomearBairro(_: Estado, form: FormData): Promise<Estado> {
  const supabase = await admin();
  const v = validarBairro(campo(form, "nome"));
  if (!v.ok) return { erro: v.erro };

  const { error } = await supabase.from("bairros").update({ nome: v.valor }).eq("id", campo(form, "id"));
  if (error) {
    return { erro: error.code === "23505" ? `Já existe um bairro "${v.valor}" nessa cidade. Use "Juntar".` : "Não foi possível renomear agora." };
  }
  revalidarCidades();
  return { ok: "Bairro renomeado." };
}

// Desativar tira o bairro da lista de quem escolhe; quem já está nele continua. Não apaga nada.
export async function alternarBairro(form: FormData) {
  const supabase = await admin();
  await supabase.from("bairros").update({ ativo: campo(form, "ativo") === "true" }).eq("id", campo(form, "id"));
  revalidarCidades();
}

// Junta dois bairros da mesma cidade: o vendedor do bairro de origem passa para o de destino e o de origem sai.
export async function unirBairros(form: FormData) {
  const supabase = await admin();
  const destino = campo(form, "destino");
  if (!destino) return;
  await supabase.rpc("admin_unir_bairros", { p_origem: campo(form, "origem"), p_destino: destino });
  revalidarCidades();
  revalidatePath("/vendedores/[id]", "page");
}

export async function atualizarCidade(_: Estado, form: FormData): Promise<Estado> {
  const supabase = await admin();
  const v = validarCidade({ nome: campo(form, "nome"), uf: campo(form, "uf"), slug: campo(form, "slug") });
  if (!v.ok) return { erro: v.erro };

  const { error } = await supabase.from("cidades").update(v.valor).eq("id", campo(form, "id"));
  if (error) return { erro: erroDeCidade(error.code) };

  revalidarCidades();
  return { ok: "Cidade atualizada." };
}

export async function alternarCidade(_: Estado, form: FormData): Promise<Estado> {
  const supabase = await admin();
  const ativar = campo(form, "ativa") === "true";

  if (!ativar) {
    const { count } = await supabase.from("cidades").select("id", { count: "exact", head: true }).eq("ativa", true);
    if ((count ?? 0) <= 1) return { erro: "Mantenha pelo menos uma cidade ativa: o site precisa de uma cidade para mostrar." };
  }

  const { error } = await supabase.from("cidades").update({ ativa: ativar }).eq("id", campo(form, "id"));
  if (error) return { erro: "Não foi possível salvar agora. Tente novamente." };

  revalidarCidades();
  return { ok: ativar ? "Cidade ativada." : "Cidade desativada: some do seletor e dos cadastros novos." };
}

export async function adicionarBairro(_: Estado, form: FormData): Promise<Estado> {
  const supabase = await admin();
  const v = validarBairro(campo(form, "nome"));
  if (!v.ok) return { erro: v.erro };

  const { error } = await supabase.from("bairros").insert({ nome: v.valor, cidade_id: campo(form, "cidade_id") });
  if (error) {
    return {
      erro:
        error.code === "23505"
          ? `Já existe um bairro "${v.valor}" nessa cidade.`
          : "Não foi possível adicionar agora. Tente novamente.",
    };
  }

  revalidarCidades();
  return { ok: `Bairro "${v.valor}" adicionado.` };
}
