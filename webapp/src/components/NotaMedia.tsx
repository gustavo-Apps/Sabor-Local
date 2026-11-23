/** "★ 4,7 (12 avaliações)": só aparece quando a loja já tem avaliação publicada. */
export function NotaMedia({
  media,
  total,
  extenso = false,
}: {
  media?: number | null;
  total?: number;
  extenso?: boolean;
}) {
  if (!media || !total) return null;
  const nota = media.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const rotulo = `${total} avaliaç${total === 1 ? "ão" : "ões"}`;
  return (
    <span className="inline-flex items-center gap-1 text-sm" title={`Nota média ${nota} em ${rotulo}`}>
      <span className="font-semibold text-amber-600">★ {nota}</span>
      <span className="text-zinc-500">({extenso ? rotulo : total})</span>
    </span>
  );
}
