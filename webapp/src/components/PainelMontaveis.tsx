import { AcaoForm } from "@/components/AcaoForm";
import { CampoNovoMontavel } from "@/components/CampoNovoMontavel";
import { MAX_MONTAVEIS_POR_LOJA, MAX_TAMANHOS, type MontavelBruto } from "@/lib/montaveis";
import { brl } from "@/lib/pedidos";
import {
  adicionarAdicional,
  adicionarTamanho,
  alternarAdicional,
  alternarMontavel,
  criarMontavel,
  removerAdicional,
  removerMontavel,
  removerTamanho,
  salvarCategoriasDoMontavel,
  salvarMontavel,
  salvarTamanho,
} from "@/app/painel/actions";

const input = "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-base";
const botaoEscuro = "rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60";
const botaoLaranja = "w-fit rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60";
const moeda = (n: number | string) => String(n).replace(".", ",");

interface Props {
  montaveis: MontavelBruto[];
  categorias: { id: string; nome: string }[];
  itens: { categoria_produto_id?: string | null }[];
}

// Aba Menu: produtos que o cliente monta (pizza, açaí, marmita...). Tudo opcional e só da loja.
export function PainelMontaveis({ montaveis, categorias, itens }: Props) {
  const lista = [...montaveis].sort((a, b) => a.ordem - b.ordem);

  return (
    <section className="mt-5 rounded-xl border border-black/10 bg-zinc-50 p-4" aria-labelledby="monte-o-seu-painel">
      <h3 id="monte-o-seu-painel" className="text-sm font-semibold">
        Monte o seu: pizza, açaí, marmita… <span className="font-normal text-zinc-500">(opcional)</span>
      </h3>
      <p className="mt-1 text-sm text-zinc-600">
        Para produtos em que o <strong>preço depende do tamanho</strong> e o cliente escolhe o que vai nele. Exemplo: pizza média{" "}
        <strong>R$ 54</strong> com até 2 sabores e grande <strong>R$ 62</strong> com até 3, qualquer que seja o sabor. Você pode ainda oferecer{" "}
        <strong>adicionais pagos</strong> (açaí + granola, + leite ninho). No seu perfil aparece o botão <strong>Montar</strong>, no topo do cardápio.
      </p>

      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
        <li>
          Crie as <strong>categorias</strong> acima (ex.: Pizzas salgadas, Pizzas doces) e cadastre os sabores como itens dessas categorias. Os sabores
          podem ficar <strong>sem preço</strong>: o preço é o do tamanho.
        </li>
        <li>Crie o produto abaixo, com os tamanhos e o preço de cada um.</li>
        <li>Marque de quais categorias vêm os sabores. Pronto.</li>
      </ol>

      {lista.map((m, i) => {
        const tamanhos = [...m.tamanhos].sort((a, b) => a.ordem - b.ordem);
        const adicionais = [...m.adicionais].sort((a, b) => a.ordem - b.ordem);
        const marcadas = new Set(m.categorias.map((c) => c.categoria_produto_id));
        const nEscolhas = itens.filter((it) => it.categoria_produto_id && marcadas.has(it.categoria_produto_id)).length;
        const rotulo = m.rotulo_escolhas.toLowerCase();
        const precisaDeEscolhas = tamanhos.some((t) => t.max_escolhas > 0);
        const pendencias = [
          tamanhos.length === 0 ? "Adicione pelo menos um tamanho com preço." : null,
          precisaDeEscolhas && marcadas.size === 0 ? `Marque de quais categorias vêm os ${rotulo}.` : null,
          precisaDeEscolhas && marcadas.size > 0 && nEscolhas === 0 ? `As categorias marcadas ainda não têm itens. Cadastre os ${rotulo} como itens do menu.` : null,
        ].filter((p): p is string => Boolean(p));

        return (
          <details key={m.id} open={i === 0} className="mt-4 rounded-xl border border-black/10 bg-white">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3 font-semibold">
              <span>{m.nome}</span>
              <span className="flex flex-wrap items-center gap-2 text-xs font-normal">
                <span className="text-zinc-500">
                  {tamanhos.length} {tamanhos.length === 1 ? "tamanho" : "tamanhos"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold ${
                    !m.disponivel ? "bg-zinc-200 text-zinc-700" : pendencias.length > 0 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                  }`}
                >
                  {!m.disponivel ? "Pausado" : pendencias.length > 0 ? "Falta configurar" : "No ar"}
                </span>
              </span>
            </summary>

            <div className="space-y-6 border-t border-black/10 p-3 text-sm">
              {pendencias.length > 0 && m.disponivel && (
                <ul className="list-disc rounded-lg bg-amber-50 p-3 pl-7 text-amber-900">
                  {pendencias.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}

              {/* 1. Tamanhos */}
              <div>
                <h4 className="font-semibold">1. Tamanhos e preços</h4>
                <p className="text-zinc-600">
                  O preço é do tamanho e não muda com {rotulo}. Em “inclui”, diga quantos {rotulo} cabem naquele tamanho (0 = nenhum).
                </p>
                {tamanhos.length > 0 && (
                  <ul className="mt-2 divide-y divide-black/10 rounded-lg border border-black/10">
                    {tamanhos.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-end gap-2 p-2">
                        <AcaoForm
                          action={salvarTamanho}
                          rotulo="Salvar"
                          className="grid min-w-0 flex-1 grid-cols-[1fr_8rem_6rem] items-end gap-2 max-sm:grid-cols-2"
                          botaoClassName={botaoEscuro}
                        >
                          <input type="hidden" name="id" value={t.id} />
                          <label className="text-xs font-medium max-sm:col-span-2">
                            Tamanho
                            <input name="nome" defaultValue={t.nome} required maxLength={40} className={input} />
                          </label>
                          <label className="text-xs font-medium">
                            Preço (R$)
                            <input name="preco" defaultValue={moeda(t.preco)} required inputMode="decimal" className={input} />
                          </label>
                          <label className="text-xs font-medium">
                            Inclui ({rotulo})
                            <input name="max_escolhas" type="number" min={0} max={10} defaultValue={t.max_escolhas} className={input} />
                          </label>
                        </AcaoForm>
                        <form action={removerTamanho}>
                          <input type="hidden" name="id" value={t.id} />
                          <button className="pb-2 text-xs text-red-600 hover:underline" aria-label={`Remover o tamanho ${t.nome}`}>
                            Remover
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                {tamanhos.length < MAX_TAMANHOS ? (
                  <AcaoForm
                    action={adicionarTamanho}
                    rotulo="Adicionar tamanho"
                    limpar
                    className="mt-2 grid items-end gap-2 sm:grid-cols-[1fr_8rem_6rem]"
                    botaoClassName={botaoLaranja}
                  >
                    <input type="hidden" name="montavel_id" value={m.id} />
                    <label className="text-xs font-medium">
                      Novo tamanho
                      <input name="nome" required maxLength={40} placeholder="Ex.: Média (30 cm)" className={input} />
                    </label>
                    <label className="text-xs font-medium">
                      Preço (R$)
                      <input name="preco" required inputMode="decimal" placeholder="54,00" className={input} />
                    </label>
                    <label className="text-xs font-medium">
                      Inclui ({rotulo})
                      <input name="max_escolhas" type="number" min={0} max={10} defaultValue={1} className={input} />
                    </label>
                  </AcaoForm>
                ) : (
                  <p className="mt-2 text-zinc-600">Você chegou ao máximo de {MAX_TAMANHOS} tamanhos.</p>
                )}
              </div>

              {/* 2. De onde vêm as escolhas */}
              <div>
                <h4 className="font-semibold">2. De onde vêm os {rotulo}</h4>
                {categorias.length === 0 ? (
                  <p className="mt-1 rounded-lg bg-zinc-50 p-3 text-zinc-700">
                    Crie uma categoria do menu (acima) e cadastre os {rotulo} como itens dela. Se o seu produto não tem {rotulo} (só tamanho e
                    adicionais), coloque <strong>0</strong> em “inclui” nos tamanhos.
                  </p>
                ) : (
                  <AcaoForm action={salvarCategoriasDoMontavel} rotulo="Salvar" className="mt-1 flex flex-col gap-2" botaoClassName={botaoEscuro}>
                    <input type="hidden" name="montavel_id" value={m.id} />
                    <p className="text-zinc-600">Os itens das categorias marcadas viram as opções para o cliente escolher ({nEscolhas} itens agora).</p>
                    <div className="flex flex-wrap gap-2">
                      {categorias.map((c) => (
                        <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-black/15 px-3 py-1.5 has-[:checked]:border-orange-600 has-[:checked]:bg-orange-50">
                          <input type="checkbox" name="categoria_ids" value={c.id} defaultChecked={marcadas.has(c.id)} />
                          {c.nome}
                        </label>
                      ))}
                    </div>
                  </AcaoForm>
                )}
              </div>

              {/* 3. Adicionais */}
              <div>
                <h4 className="font-semibold">
                  3. {m.rotulo_adicionais} pagos <span className="font-normal text-zinc-500">(opcional)</span>
                </h4>
                <p className="text-zinc-600">O valor de cada um é somado ao preço do tamanho. Deixe o preço vazio para adicional sem custo.</p>
                {adicionais.length > 0 && (
                  <ul className="mt-2 divide-y divide-black/10 rounded-lg border border-black/10">
                    {adicionais.map((a) => (
                      <li key={a.id} className={`flex flex-wrap items-center justify-between gap-2 p-2 ${a.disponivel ? "" : "opacity-60"}`}>
                        <span>
                          {a.nome} <span className="font-semibold">{Number(a.preco) > 0 ? `+ ${brl(Number(a.preco))}` : "grátis"}</span>
                          {!a.disponivel && <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-semibold">Em falta</span>}
                        </span>
                        <span className="flex items-center gap-3">
                          <form action={alternarAdicional}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="disponivel" value={a.disponivel ? "false" : "true"} />
                            <button className="text-xs font-semibold text-zinc-700 hover:underline">{a.disponivel ? "Acabou" : "Voltou"}</button>
                          </form>
                          <form action={removerAdicional}>
                            <input type="hidden" name="id" value={a.id} />
                            <button className="text-xs text-red-600 hover:underline" aria-label={`Remover ${a.nome}`}>
                              Remover
                            </button>
                          </form>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {adicionais.length < 30 ? (
                  <AcaoForm action={adicionarAdicional} rotulo="Adicionar" limpar className="mt-2 grid gap-2 sm:grid-cols-[1fr_8rem]" botaoClassName={botaoLaranja}>
                    <input type="hidden" name="montavel_id" value={m.id} />
                    <input name="nome" required maxLength={40} placeholder="Ex.: Granola" aria-label="Nome do adicional" className={input} />
                    <input name="preco" inputMode="decimal" placeholder="Preço (3,00)" aria-label="Preço do adicional" className={input} />
                  </AcaoForm>
                ) : (
                  <p className="mt-2 text-zinc-600">Você chegou ao máximo de 30 adicionais.</p>
                )}
              </div>

              {/* Ajustes */}
              <details className="rounded-lg border border-black/10 p-3">
                <summary className="cursor-pointer font-semibold">Ajustes e nomes</summary>
                <AcaoForm action={salvarMontavel} rotulo="Salvar ajustes" className="mt-3 grid gap-3 sm:grid-cols-2" botaoClassName={botaoEscuro}>
                  <input type="hidden" name="id" value={m.id} />
                  <label className="text-xs font-medium">
                    Nome do produto
                    <input name="nome" defaultValue={m.nome} required maxLength={40} className={input} />
                  </label>
                  <label className="text-xs font-medium">
                    O cliente escolhe os…
                    <input name="rotulo_escolhas" defaultValue={m.rotulo_escolhas} required maxLength={30} className={input} />
                  </label>
                  <label className="text-xs font-medium sm:col-span-2">
                    Descrição (opcional)
                    <input name="descricao" defaultValue={m.descricao ?? ""} maxLength={200} placeholder="Ex.: Massa fininha, borda recheada sob consulta" className={input} />
                  </label>
                  <label className="text-xs font-medium">
                    Nome dos adicionais
                    <input name="rotulo_adicionais" defaultValue={m.rotulo_adicionais} required maxLength={30} className={input} />
                  </label>
                  <label className="text-xs font-medium">
                    Máximo de adicionais por pedido
                    <input name="max_adicionais" type="number" min={0} max={20} defaultValue={m.max_adicionais} className={input} />
                  </label>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" name="escolha_obrigatoria" defaultChecked={m.escolha_obrigatoria} />
                    O cliente precisa escolher pelo menos 1 de {rotulo} (nos tamanhos que incluem)
                  </label>
                </AcaoForm>
              </details>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3">
                <form action={alternarMontavel}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="disponivel" value={m.disponivel ? "false" : "true"} />
                  <button className={m.disponivel ? "rounded-full bg-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-800" : "rounded-full bg-green-100 px-4 py-2 text-xs font-semibold text-green-800"}>
                    {m.disponivel ? "Pausar (some do perfil)" : "Voltar ao perfil"}
                  </button>
                </form>
                <form action={removerMontavel}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="text-xs text-red-600 hover:underline" title="Apaga o produto, os tamanhos e os adicionais. Os itens do menu ficam.">
                    Excluir “{m.nome}”
                  </button>
                </form>
              </div>
            </div>
          </details>
        );
      })}

      {lista.length < MAX_MONTAVEIS_POR_LOJA ? (
        <AcaoForm action={criarMontavel} rotulo="Criar produto" limpar className="mt-4 flex flex-col gap-3 border-t border-black/10 pt-4" botaoClassName={botaoLaranja}>
          <p className="text-sm font-semibold">Novo produto “monte o seu”</p>
          <CampoNovoMontavel />
        </AcaoForm>
      ) : (
        <p className="mt-3 text-sm text-zinc-600">Você chegou ao máximo de {MAX_MONTAVEIS_POR_LOJA} produtos.</p>
      )}
    </section>
  );
}
