import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sobre o Sabor Local",
  description:
    "O que é, para quê e para quem é o Sabor Local, e como o projeto será desenvolvido.",
};

const problemas = [
  {
    icone: "🧳",
    titulo: "Quem chega não conhece nada",
    texto: "Sem rede de contatos, depende da sorte de perguntar à pessoa certa.",
  },
  {
    icone: "⏳",
    titulo: "Moradores descobrem tarde",
    texto:
      "Muitos só conhecem um estabelecimento meses ou anos depois, quando alguém indica.",
  },
  {
    icone: "👻",
    titulo: "O vendedor fica invisível",
    texto:
      "Quem faz o melhor lanche do bairro não sabe se divulgar nem paga anúncio.",
  },
];

const recursos = [
  ["📖", "Catálogo completo", "Cardápio, fotos, preços e horários de cada vendedor."],
  ["🔎", "Busca inteligente", "Por produto, categoria e bairro."],
  ["🟢", "Aberto agora", "Filtro que evita frustração na hora de comer."],
  ["💬", "WhatsApp direto", "Mensagem pré-preenchida para facilitar o pedido."],
  ["⭐", "Avaliações verificadas", "Confiança com verificação de compra."],
  ["🗺️", "Descoberta", "“Abriu agora”, “Destaque da semana” e mapa por bairro."],
];

const publico = [
  ["🏘️", "Moradores", "De todas as idades, querendo descobrir opções sem depender de indicação."],
  ["📦", "Recém-chegados", "Pessoas novas na cidade, sem nenhuma referência."],
  ["🥟", "Vendedores", "De todos os portes, especialmente quem está começando e não tem verba de marketing."],
];

const fases = [
  ["Fase 0", "Descoberta e validação", "Entrevistas com moradores e vendedores e teste de protótipo."],
  ["Fase 1", "Construção do MVP", "Catálogo, busca, perfis, WhatsApp e avaliações verificadas."],
  ["Fase 2", "Lançamento e tração", "Divulgação local e painel de autoatendimento do vendedor."],
  ["Fase 3", "Monetização", "Planos de destaque, sem comprometer a experiência de uso."],
  ["Fase 4", "Expansão regional", "Replicar o modelo em cidades vizinhas."],
];

const stack = [
  ["Next.js + TypeScript", "App Router, renderização no servidor"],
  ["Tailwind CSS", "Interface responsiva e leve"],
  ["Supabase", "Postgres, Auth e Row Level Security"],
  ["Vercel", "Deploy contínuo a cada push"],
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
      {children}
    </p>
  );
}

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-orange-50 to-zinc-50">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
          <Eyebrow>Projeto aberto para contribuições</Eyebrow>
          <h1 className="mt-2 max-w-3xl font-serif text-4xl font-bold sm:text-6xl">
            Descubra o que sua cidade tem de{" "}
            <span className="text-orange-600">bom</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-zinc-600">
            Plataforma de descoberta gastronômica para cidades pequenas que os
            grandes apps de delivery não atendem. Visibilidade para quem vende,
            descoberta para quem come.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full bg-orange-600 px-6 py-3 font-semibold text-white transition hover:bg-orange-700"
            >
              Ver o catálogo
            </Link>
            <Link
              href="/contribuicao"
              className="rounded-full border border-zinc-900 px-6 py-3 font-semibold transition hover:bg-zinc-900 hover:text-white"
            >
              Quero contribuir
            </Link>
          </div>
        </div>
      </section>

      {/* O quê */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16">
        <Eyebrow>O quê</Eyebrow>
        <h2 className="mt-1 font-serif text-3xl font-bold">
          Resolvemos a parte que os apps de delivery não resolvem
        </h2>
        <p className="mt-3 max-w-3xl text-zinc-600">
          O Sabor Local centraliza todos os vendedores de alimentação do
          município, de qualquer porte, com cardápios, fotos, preços, horários,
          avaliações e contato direto via WhatsApp. Não cuidamos de entrega nem
          de pagamento: cuidamos de <strong>descoberta e visibilidade</strong>.
          O vendedor entrega e o cliente paga diretamente a ele, como já
          acontece hoje.
        </p>
      </section>

      {/* Por quê */}
      <section className="bg-orange-50/60">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <Eyebrow>Pra quê</Eyebrow>
          <h2 className="mt-1 font-serif text-3xl font-bold">
            Boas opções que ninguém conhece
          </h2>
          <p className="mt-3 max-w-3xl text-zinc-600">
            Em cidades sem iFood e similares, a única forma de descobrir onde
            comer é o boca a boca. O problema não é falta de oferta, é falta de
            visibilidade.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {problemas.map((p) => (
              <div key={p.titulo} className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                <div className="text-3xl">{p.icone}</div>
                <h3 className="mt-2 font-serif text-lg font-bold">{p.titulo}</h3>
                <p className="mt-1 text-sm text-zinc-600">{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solução */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16">
        <Eyebrow>A solução</Eyebrow>
        <h2 className="mt-1 font-serif text-3xl font-bold">
          A vitrine gastronômica da cidade
        </h2>
        <p className="mt-3 text-zinc-600">
          Uma plataforma web simples, sem precisar instalar aplicativo.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recursos.map(([icone, titulo, texto]) => (
            <div key={titulo} className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
              <div className="text-3xl">{icone}</div>
              <h3 className="mt-2 font-serif text-lg font-bold">{titulo}</h3>
              <p className="mt-1 text-sm text-zinc-600">{texto}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 rounded-r-xl border-l-4 border-green-600 bg-green-50 p-4 text-sm text-green-900">
          Pedidos, pagamento e entrega continuam diretamente entre cliente e
          vendedor. A plataforma conecta; quem vende, atende.
        </p>
      </section>

      {/* Pra quem */}
      <section className="bg-orange-50/60">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <Eyebrow>Pra quem</Eyebrow>
          <h2 className="mt-1 font-serif text-3xl font-bold">
            Milhares de cidades, praticamente sem concorrência
          </h2>
          <p className="mt-3 max-w-3xl text-zinc-600">
            A grande maioria dos municípios brasileiros é de pequeno porte e
            não é atendida por grandes plataformas de delivery. Começamos em uma
            cidade-piloto e replicamos o modelo para as vizinhas.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {publico.map(([icone, titulo, texto]) => (
              <div key={titulo} className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                <div className="text-3xl">{icone}</div>
                <h3 className="mt-2 font-serif text-lg font-bold">{titulo}</h3>
                <p className="mt-1 text-sm text-zinc-600">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como será desenvolvido */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16">
        <Eyebrow>Como será desenvolvido</Eyebrow>
        <h2 className="mt-1 font-serif text-3xl font-bold">
          Passo a passo, validando antes de crescer
        </h2>
        <p className="mt-3 max-w-3xl text-zinc-600">
          Cinco fases em 12 meses. Cada uma termina com um ponto de decisão:
          seguir, ajustar ou pausar.
        </p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {fases.map(([fase, titulo, texto]) => (
            <li key={fase} className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <span className="font-serif text-lg font-bold text-orange-600">{fase}</span>
              <h3 className="mt-1 font-semibold">{titulo}</h3>
              <p className="mt-1 text-sm text-zinc-600">{texto}</p>
            </li>
          ))}
        </ol>

        <h3 className="mt-12 font-serif text-xl font-bold">Tecnologias</h3>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stack.map(([nome, desc]) => (
            <li key={nome} className="rounded-xl border border-black/10 bg-white p-4">
              <p className="font-semibold">{nome}</p>
              <p className="text-sm text-zinc-600">{desc}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
