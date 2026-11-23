import Link from "next/link";
import type { ItemCardapio, Vendedor } from "@/lib/types";
import { situacaoAgora } from "@/lib/horarios";
import { NotaMedia } from "@/components/NotaMedia";

interface Props {
  vendedor: Vendedor;
  minha?: boolean;
  /** Busca de produto em andamento: leva o termo ao perfil e mostra os itens que bateram. */
  busca?: string;
  /** Chave do tipo de produto escolhido no catálogo; o perfil abre já filtrado nele. */
  categoria?: string;
  itensEncontrados?: ItemCardapio[];
}

const MAX_ITENS_NO_CARD = 3;

export function VendorCard({ vendedor, minha = false, busca = "", categoria = "", itensEncontrados = [] }: Props) {
  const situacao = situacaoAgora(vendedor);
  const emDestaque = vendedor.destaque_ate
    ? new Date(vendedor.destaque_ate) > new Date()
    : false;
  const termo = busca.trim();
  const filtros = new URLSearchParams();
  if (termo) filtros.set("q", termo);
  if (categoria) filtros.set("categoria", categoria);
  const href = filtros.size > 0 ? `/vendedores/${vendedor.id}?${filtros}` : `/vendedores/${vendedor.id}`;

  return (
    <Link
      href={href}
      className={`block rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
        minha ? "border-zinc-900" : "border-black/10"
      }`}
    >
      {minha && (
        <span className="mb-2 inline-block rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-semibold text-white">
          Sua loja
        </span>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {vendedor.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vendedor.logo_url}
              alt={`Logo de ${vendedor.nome}`}
              width={48}
              height={48}
              loading="lazy"
              className="h-12 w-12 shrink-0 rounded-xl border border-black/10 object-cover"
            />
          )}
          <h3 className="font-semibold text-lg">{vendedor.nome}</h3>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            situacao.aberto ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {situacao.rotulo}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        {emDestaque && (
          <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Destaque
          </span>
        )}
        <NotaMedia media={vendedor.avaliacao_media} total={vendedor.avaliacao_total} />
        {vendedor.aceita_pedidos && (
          <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Pede pelo site</span>
        )}
      </div>

      {vendedor.descricao && (
        <p className="mt-2 text-sm text-gray-600 line-clamp-2">{vendedor.descricao}</p>
      )}

      {itensEncontrados.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-xl bg-orange-50 p-3 text-sm">
          {itensEncontrados.slice(0, MAX_ITENS_NO_CARD).map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span className="font-medium text-orange-900">{i.nome}</span>
              {i.preco != null && (
                <span className="shrink-0 text-orange-900">
                  {i.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              )}
            </li>
          ))}
          {itensEncontrados.length > MAX_ITENS_NO_CARD && (
            <li className="text-xs text-orange-800">+ {itensEncontrados.length - MAX_ITENS_NO_CARD} no cardápio</li>
          )}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
        {vendedor.categorias.map((c) => (
          <span key={c.id} className="rounded-full bg-gray-100 px-2 py-0.5">{c.nome}</span>
        ))}
        {vendedor.bairro ? (
          <span className="rounded-full bg-gray-100 px-2 py-0.5">{vendedor.bairro.nome}</span>
        ) : (
          vendedor.bairro_sugerido && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5">{vendedor.bairro_sugerido} (a confirmar)</span>
          )
        )}
      </div>
    </Link>
  );
}
