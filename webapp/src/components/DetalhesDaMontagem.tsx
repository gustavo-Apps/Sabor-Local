import { textoDosDetalhes, type GrupoDeDetalhes } from "@/lib/montaveis";

// O que o cliente escolheu numa pizza/açaí montado ("Sabores: Calabresa, Frango"), logo abaixo do nome do item.
export function DetalhesDaMontagem({ grupos, className = "text-zinc-600" }: { grupos: readonly GrupoDeDetalhes[] | null | undefined; className?: string }) {
  const linhas = textoDosDetalhes(grupos);
  if (linhas.length === 0) return null;
  return (
    <ul className={`text-sm ${className}`}>
      {linhas.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}
