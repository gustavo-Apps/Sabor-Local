import Link from "next/link";

export default function NaoEncontrada() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <p className="text-5xl font-bold text-orange-600">404</p>
      <h1 className="mt-3 font-serif text-2xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-zinc-600">
        O endereço pode ter mudado ou o vendedor pode ter saído do ar. Volte para o catálogo e procure de novo.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
        <Link href="/" className="rounded-full bg-orange-600 px-6 py-2.5 font-semibold text-white hover:bg-orange-700">
          Ver o catálogo
        </Link>
        <Link href="/feedback" className="rounded-full border border-black/10 px-6 py-2.5 font-semibold hover:bg-zinc-100">
          Avisar a equipe
        </Link>
      </div>
    </div>
  );
}
