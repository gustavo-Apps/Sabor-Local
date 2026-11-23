"use client";

export function ImprimirBotao() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full border border-zinc-900 px-4 py-1.5 text-xs font-semibold hover:bg-zinc-900 hover:text-white print:hidden"
    >
      Imprimir
    </button>
  );
}
