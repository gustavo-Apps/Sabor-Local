import type { Metadata } from "next";
import { FeedbackForm } from "@/components/FeedbackForm";
import { caminhoInterno } from "@/lib/feedback";
import { responsavel } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Fale conosco",
  description: "Relate um problema, mande uma sugestão ou tire uma dúvida sobre o Sabor Local.",
};

export default async function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  const { de } = await searchParams;
  const pagina = caminhoInterno(typeof de === "string" ? de : undefined);
  const r = responsavel();

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="font-serif text-3xl font-bold">Fale conosco</h1>
      <p className="mt-2 text-zinc-600">
        Encontrou um problema, tem uma ideia ou ficou com dúvida? Escreva aqui. Cada mensagem é lida pela equipe; as que
        ajudam o projeto são aceitas e entram no planejamento.
      </p>

      <div className="mt-6">
        <FeedbackForm pagina={pagina} />
      </div>

      <section className="mt-8 rounded-2xl bg-zinc-100 p-5 text-sm text-zinc-700">
        <h2 className="font-semibold text-zinc-900">Outras formas de falar com a gente</h2>
        <ul className="mt-2 space-y-1">
          {r.email && (
            <li>
              E-mail: <a href={`mailto:${r.email}`} className="font-medium text-orange-700 underline">{r.email}</a>
            </li>
          )}
          {r.whatsapp && (
            <li>
              WhatsApp:{" "}
              <a href={`https://wa.me/${r.whatsapp}`} target="_blank" rel="noopener noreferrer" className="font-medium text-orange-700 underline">
                chamar no WhatsApp
              </a>
            </li>
          )}
          <li>
            Código e melhorias:{" "}
            <a href={r.github} target="_blank" rel="noopener noreferrer" className="font-medium text-orange-700 underline">
              GitHub do projeto
            </a>
          </li>
        </ul>
        <p className="mt-3 text-xs text-zinc-500">
          Para denunciar um vendedor ou uma avaliação, use o botão &ldquo;Denunciar&rdquo; na página dele. Não escreva senhas
          nem dados de pagamento aqui.
        </p>
      </section>
    </div>
  );
}
