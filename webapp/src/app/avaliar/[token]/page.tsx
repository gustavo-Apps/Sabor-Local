import type { Metadata } from "next";
import Link from "next/link";
import { AvaliarPorConviteForm } from "@/components/AvaliarPorConviteForm";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// O link é o segredo: sem indexação e sem repassar o endereço (com o token) por "referer" a outros sites.
export const metadata: Metadata = {
  title: "Avaliar pedido",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const MOTIVOS: Record<string, string> = {
  usado: "Esse link já foi usado para uma avaliação. Cada convite vale uma vez.",
  expirado: "Esse link venceu (eles valem 30 dias). Peça um novo convite à loja.",
  invalido: "Não encontramos esse convite. Confira se copiou o endereço inteiro do e-mail.",
};

export default async function AvaliarPage(props: PageProps<"/avaliar/[token]">) {
  const { token } = await props.params;

  let estado = "invalido";
  let loja = "";
  let moderada = true;
  if (isSupabaseConfigured() && /^[0-9a-f]{64}$/.test(token)) {
    const { data } = await (await createClient()).rpc("convite_info", { p_token: token });
    const info = (data ?? {}) as { estado?: string; vendedor_nome?: string; moderada?: boolean };
    estado = info.estado ?? "invalido";
    loja = info.vendedor_nome ?? "";
    moderada = info.moderada !== false;
  }

  return (
    <div className="mx-auto w-full max-w-lg flex-1 px-4 py-12">
      {estado === "ok" ? (
        <>
          <h1 className="font-serif text-2xl font-bold">Como foi seu pedido na {loja}?</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Sua avaliação ajuda outras pessoas da cidade.{" "}
            {moderada ? "Ela entra no ar depois de uma conferência da equipe. " : ""}
            Seu nome é opcional: sem ele, a avaliação aparece como anônima.
          </p>
          <div className="mt-6">
            <AvaliarPorConviteForm token={token} nomeDaLoja={loja} moderada={moderada} />
          </div>
        </>
      ) : (
        <>
          <h1 className="font-serif text-2xl font-bold">Este convite não pode ser usado</h1>
          <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            {MOTIVOS[estado] ?? MOTIVOS.invalido}
          </p>
          <p className="mt-6 text-sm">
            <Link href="/" className="font-semibold text-orange-600 underline">
              Ver o catálogo
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
