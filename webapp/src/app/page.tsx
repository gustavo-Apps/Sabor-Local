import { listarVendedores } from "@/lib/vendedores";
import { listarCategorias, listarBairros } from "@/lib/catalogo";
import { resolverCidade } from "@/lib/cidades";
import { CatalogoClient } from "@/components/CatalogoClient";
import { CidadeSeletor } from "@/components/CidadeSeletor";
import { Rastreio } from "@/components/Rastreio";
import { lojaDoUsuarioLogado } from "@/lib/sessao";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ cidade?: string }> }) {
  const { cidade: slug } = await searchParams;
  const { cidade, cidades } = await resolverCidade(slug);

  const [vendedores, categorias, bairros, minhaLojaId] = await Promise.all([
    listarVendedores(cidade?.id),
    listarCategorias(),
    listarBairros(cidade?.id),
    lojaDoUsuarioLogado(),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Rastreio tipo="visita_site" />
      <section className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
            Vitrine gastronômica da cidade
          </p>
          {cidade && <CidadeSeletor cidades={cidades} atual={cidade} />}
        </div>
        <h1 className="mt-1 font-serif text-3xl font-bold sm:text-4xl">
          Descubra o que sua cidade tem de bom
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600">
          Cardápios, fotos, horários e contato direto pelo WhatsApp com quem
          vende perto de você.
        </p>
      </section>

      <CatalogoClient vendedores={vendedores} categorias={categorias} bairros={bairros} minhaLojaId={minhaLojaId} />
    </div>
  );
}
