"use client";

import { useEffect, useRef, useState } from "react";
import { QUANTIDADE_MAXIMA } from "@/lib/carrinho";
import { brl, linkWhatsAppComTexto } from "@/lib/pedidos";
import {
  chaveDaMontagem,
  mensagemDaMontagem,
  precoDaMontagem,
  problemaDaMontagem,
  tamanhoDa,
  tamanhosMontaveis,
  type Montagem,
  type Montavel,
} from "@/lib/montaveis";
import { registrarEvento } from "@/components/Rastreio";
import { useCarrinho } from "@/components/useCarrinho";

export type ModoDoMontador =
  /** A loja recebe pedido pelo site: a montagem vai para o carrinho. */
  | "site"
  /** A loja só tem WhatsApp: a montagem vira a mensagem do pedido. */
  | "whatsapp"
  /** Só mostra (o dono vendo a própria loja). */
  | "ver";

interface Props {
  vendedorId: string;
  nomeDaLoja: string;
  whatsapp: string;
  montavel: Montavel;
  modo: ModoDoMontador;
}

const rotuloDoLimite = (rotulo: string, max: number) => (max === 1 ? `${rotulo}: 1` : `${rotulo}: até ${max}`);

// Cartão "Montar pizza" + janela onde o cliente escolhe o tamanho, as escolhas incluídas (sabores...) e os adicionais.
// Funciona para qualquer produto montável (pizza, açaí, marmita...): os nomes vêm da loja.
export function MontadorDeProduto({ vendedorId, nomeDaLoja, whatsapp, montavel, modo }: Props) {
  const { carrinho, definir } = useCarrinho(vendedorId);
  const janela = useRef<HTMLDialogElement>(null);
  const [tamanhoId, setTamanhoId] = useState("");
  const [escolhas, setEscolhas] = useState<string[]>([]);
  const [adicionais, setAdicionais] = useState<string[]>([]);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!aviso) return;
    const id = setTimeout(() => setAviso(""), 5000);
    return () => clearTimeout(id);
  }, [aviso]);

  const tamanhos = tamanhosMontaveis(montavel);
  const tamanho = tamanhoDa(montavel, { tamanhoId });
  const montagem: Montagem = { montavelId: montavel.id, tamanhoId, escolhas, adicionais };
  const problema = problemaDaMontagem(montavel, montagem);
  const preco = precoDaMontagem(montavel, montagem);
  const rotulo = montavel.rotuloEscolhas.toLowerCase();
  const rotuloExtras = montavel.rotuloAdicionais.toLowerCase();
  const chave = chaveDaMontagem(montagem);
  const jaNoPedido = carrinho[chave] ?? 0;
  const cheio = modo === "site" && jaNoPedido >= QUANTIDADE_MAXIMA;

  const alternar = (lista: string[], id: string, definirLista: (l: string[]) => void) =>
    definirLista(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  function fechar() {
    janela.current?.close();
  }

  function adicionar() {
    if (problema || cheio) return;
    definir(chave, jaNoPedido + 1);
    setAviso(`Adicionado ao pedido: ${montavel.nome} ${tamanho?.nome ?? ""}`.trim());
    setTamanhoId("");
    setEscolhas([]);
    setAdicionais([]);
    fechar();
  }

  const linkDoWhatsApp = linkWhatsAppComTexto(
    whatsapp,
    `Olá! Vi o perfil de ${nomeDaLoja} no Sabor Local e gostaria de pedir:\n${mensagemDaMontagem(montavel, montagem)}`,
  );

  const resumoDosTamanhos = tamanhos.map((t) => `${t.nome} ${brl(t.preco)}`).join(" · ");
  const maxDoTamanho = tamanho?.maxEscolhas ?? 0;
  const mostrarEscolhas = Boolean(tamanho) && maxDoTamanho > 0;
  const mostrarAdicionais = montavel.adicionais.length > 0 && montavel.maxAdicionais > 0;

  return (
    <li className="list-none rounded-2xl border border-orange-200 bg-orange-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-serif text-lg font-bold">{montavel.nome}</p>
          {montavel.descricao && <p className="text-sm text-zinc-600">{montavel.descricao}</p>}
          <p className="mt-1 text-sm text-zinc-700">{resumoDosTamanhos}</p>
        </div>
        {modo !== "ver" && (
          <button
            type="button"
            onClick={() => janela.current?.showModal()}
            className="shrink-0 rounded-full bg-orange-600 px-5 py-3 font-semibold text-white hover:bg-orange-700"
          >
            Montar {montavel.nome}
          </button>
        )}
      </div>
      {aviso && (
        <p role="status" className="mt-3 rounded-lg bg-green-100 p-2 text-sm font-medium text-green-800">
          ✓ {aviso}
        </p>
      )}

      {modo !== "ver" && (
        <dialog
          ref={janela}
          aria-labelledby={`montar-${montavel.id}`}
          onClick={(e) => {
            if (e.target === janela.current) fechar(); // toque fora da janela
          }}
          className="m-auto max-h-[92dvh] w-[calc(100%-1rem)] max-w-lg overflow-hidden rounded-2xl bg-white p-0 backdrop:bg-black/50"
        >
          <div className="flex max-h-[92dvh] flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
              <h2 id={`montar-${montavel.id}`} className="font-serif text-xl font-bold">
                Montar {montavel.nome}
              </h2>
              <button type="button" onClick={fechar} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full text-2xl leading-none hover:bg-zinc-100">
                ×
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
              <fieldset>
                <legend className="font-semibold">1. Escolha o tamanho</legend>
                <div className="mt-2 grid gap-2">
                  {tamanhos.map((t) => (
                    <label
                      key={t.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/15 p-3 has-[:checked]:border-orange-600 has-[:checked]:bg-orange-50"
                    >
                      <input type="radio" name={`tamanho-${montavel.id}`} value={t.id} checked={tamanhoId === t.id} onChange={() => setTamanhoId(t.id)} />
                      <span className="flex-1">
                        <span className="block font-medium">{t.nome}</span>
                        {t.maxEscolhas > 0 && <span className="block text-sm text-zinc-600">{rotuloDoLimite(montavel.rotuloEscolhas, t.maxEscolhas)}</span>}
                      </span>
                      <span className="font-semibold">{brl(t.preco)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {mostrarEscolhas ? (
                <fieldset>
                  <legend className="font-semibold">
                    2. {montavel.rotuloEscolhas}{" "}
                    <span className="font-normal text-zinc-600" aria-live="polite">
                      · {escolhas.length} de {maxDoTamanho}
                      {montavel.escolhaObrigatoria ? "" : " (opcional)"}
                    </span>
                  </legend>
                  <p className="text-sm text-zinc-600">O preço é o do tamanho, não muda com {maxDoTamanho === 1 ? "a escolha" : `os ${rotulo}`}.</p>
                  <div className="mt-2 grid gap-2">
                    {montavel.escolhas.map((e) => {
                      const marcado = escolhas.includes(e.id);
                      const semVaga = !marcado && escolhas.length >= maxDoTamanho;
                      return (
                        <label
                          key={e.id}
                          className={`flex items-start gap-3 rounded-xl border border-black/15 p-3 has-[:checked]:border-orange-600 has-[:checked]:bg-orange-50 ${
                            semVaga ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={marcado}
                            disabled={semVaga}
                            onChange={() => alternar(escolhas, e.id, setEscolhas)}
                          />
                          <span>
                            <span className="block font-medium">{e.nome}</span>
                            {e.descricao && <span className="block text-sm text-zinc-600">{e.descricao}</span>}
                            {semVaga && <span className="block text-xs text-zinc-500">Limite atingido. Tire um para trocar.</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : (
                tamanhos.some((t) => t.maxEscolhas > 0) && (
                  <p className="text-sm text-zinc-500">2. Escolha o tamanho para ver quantos {rotulo} cabem.</p>
                )
              )}

              {mostrarAdicionais && (
                <fieldset>
                  <legend className="font-semibold">
                    {mostrarEscolhas || tamanhos.some((t) => t.maxEscolhas > 0) ? "3" : "2"}. {montavel.rotuloAdicionais}{" "}
                    <span className="font-normal text-zinc-600" aria-live="polite">
                      · opcional, {adicionais.length} de {montavel.maxAdicionais}
                    </span>
                  </legend>
                  <div className="mt-2 grid gap-2">
                    {montavel.adicionais.map((a) => {
                      const marcado = adicionais.includes(a.id);
                      const semVaga = !marcado && adicionais.length >= montavel.maxAdicionais;
                      return (
                        <label
                          key={a.id}
                          className={`flex items-center gap-3 rounded-xl border border-black/15 p-3 has-[:checked]:border-orange-600 has-[:checked]:bg-orange-50 ${
                            semVaga ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                          }`}
                        >
                          <input type="checkbox" checked={marcado} disabled={semVaga} onChange={() => alternar(adicionais, a.id, setAdicionais)} />
                          <span className="flex-1 font-medium">{a.nome}</span>
                          <span className="text-sm font-semibold text-zinc-700">{a.preco > 0 ? `+ ${brl(a.preco)}` : "Grátis"}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">Os {rotuloExtras} são somados ao preço do tamanho.</p>
                </fieldset>
              )}
            </div>

            <div className="border-t border-black/10 bg-white px-4 py-3">
              {problema && tamanhoId !== "" && (
                <p role="alert" className="mb-2 text-sm font-medium text-amber-800">
                  {problema}
                </p>
              )}
              {modo === "site" ? (
                <button
                  type="button"
                  onClick={adicionar}
                  disabled={Boolean(problema) || cheio}
                  className="flex w-full items-center justify-between gap-3 rounded-full bg-green-600 px-5 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>{problema && tamanhoId === "" ? "Escolha o tamanho" : "Adicionar ao pedido"}</span>
                  <span>{tamanho ? brl(preco) : ""}</span>
                </button>
              ) : problema ? (
                <button type="button" disabled className="flex w-full items-center justify-between gap-3 rounded-full bg-green-600 px-5 py-3 font-semibold text-white opacity-50">
                  <span>{tamanhoId === "" ? "Escolha o tamanho" : "Pedir pelo WhatsApp"}</span>
                  <span>{tamanho ? brl(preco) : ""}</span>
                </button>
              ) : (
                <a
                  href={linkDoWhatsApp}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => registrarEvento("whatsapp", vendedorId)}
                  className="flex w-full items-center justify-between gap-3 rounded-full bg-green-600 px-5 py-3 font-semibold text-white hover:bg-green-700"
                >
                  <span>Pedir pelo WhatsApp</span>
                  <span>{brl(preco)}</span>
                </a>
              )}
              {cheio && <p className="mt-2 text-xs text-zinc-600">Você já tem {QUANTIDADE_MAXIMA} iguais a esta no pedido. Ajuste a quantidade ao finalizar.</p>}
            </div>
          </div>
        </dialog>
      )}
    </li>
  );
}
