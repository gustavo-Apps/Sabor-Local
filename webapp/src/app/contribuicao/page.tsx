import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contribuição",
  description: "Como contribuir com o Sabor Local, um projeto aberto para estudar Next.js e Supabase.",
};

const GITHUB_PERFIL = "https://github.com/gustavo-Apps";
const GITHUB_REPO = "https://github.com/gustavo-Apps/projeto-cardapio-digital";

export default function ContribuicaoPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
      <div className="rounded-3xl bg-zinc-900 px-6 py-14 text-center text-white">
        <h1 className="font-serif text-3xl font-bold">
          Deseja contribuir com o projeto? Entre em contato!
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-zinc-300">
          O Sabor Local é um projeto aberto, ótimo para estudar Next.js e
          Supabase na prática. Veja o código, abra uma issue ou fale comigo.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a
            href={GITHUB_PERFIL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-orange-600 px-7 py-3 font-semibold text-white transition hover:bg-orange-700"
          >
            github.com/gustavo-Apps
          </a>
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-white/40 px-7 py-3 font-semibold text-white transition hover:bg-white/10"
          >
            Ver o repositório
          </a>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-zinc-600">
        Quer entender o projeto antes?{" "}
        <Link href="/sobre" className="font-semibold text-orange-600 underline">
          Leia a página Sobre
        </Link>
        .
      </p>
    </div>
  );
}
