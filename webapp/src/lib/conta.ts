// Exclusão completa da conta de um vendedor (direito de exclusão da LGPD).
// Sem imports de módulos do app para poder ser usado também pelos testes.

interface ClienteAdmin {
  from: (tabela: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  storage: { from: (bucket: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  auth: { admin: { deleteUser: (id: string) => Promise<{ error: { message: string } | null }> } };
}

/**
 * Apaga, nesta ordem: arquivos do Storage, o perfil do vendedor (e, em cascata, menu, horários,
 * datas especiais, códigos, avaliações recebidas, denúncias e pagamentos) e por fim o login.
 * O histórico de auditoria é mantido sem vínculo com a pessoa até vencer o prazo de retenção.
 */
export async function excluirContaCompleta(admin: ClienteAdmin, userId: string): Promise<{ erro?: string }> {
  const bucket = admin.storage.from("cardapios");
  const { data: arquivos } = await bucket.list(userId);
  if (arquivos?.length) {
    await bucket.remove(arquivos.map((a: { name: string }) => `${userId}/${a.name}`));
  }

  const { error: erroVendedor } = await admin.from("vendedores").delete().eq("owner_id", userId);
  if (erroVendedor) return { erro: erroVendedor.message };

  const { error: erroUsuario } = await admin.auth.admin.deleteUser(userId);
  if (erroUsuario) return { erro: erroUsuario.message };

  return {};
}
