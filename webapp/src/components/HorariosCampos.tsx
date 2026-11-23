"use client";

import { useRef } from "react";
import { MAX_PERIODOS } from "@/lib/validacao";
import { CampoHora } from "./CampoHora";

export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const ROTULOS = ["1º período", "2º período (opcional)"];
const ALVOS: Record<string, number[]> = {
  todos: [0, 1, 2, 3, 4, 5, 6],
  uteis: [1, 2, 3, 4, 5],
  fimdesemana: [0, 6],
};

type Periodo = { abre: string; fecha: string };

const campo = "w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-center text-base";

// Horário da semana: até dois períodos por dia (ex.: manhã e tarde/noite), com atalho para copiar de um dia para outros.
export function HorariosCampos({ inicial }: { inicial: Periodo[][] }) {
  const raiz = useRef<HTMLDivElement>(null);

  const entrada = (nome: string) => raiz.current?.querySelector<HTMLInputElement>(`input[name="${nome}"]`) ?? null;

  function copiar() {
    const origem = Number((raiz.current?.querySelector("select[name='_origem']") as HTMLSelectElement).value);
    const alvo = (raiz.current?.querySelector("select[name='_alvo']") as HTMLSelectElement).value;
    for (const dia of ALVOS[alvo] ?? []) {
      if (dia === origem) continue;
      for (let i = 0; i < MAX_PERIODOS; i++) {
        const de = { abre: entrada(`abre_${origem}_${i}`), fecha: entrada(`fecha_${origem}_${i}`) };
        const para = { abre: entrada(`abre_${dia}_${i}`), fecha: entrada(`fecha_${dia}_${i}`) };
        if (para.abre) para.abre.value = de.abre?.value ?? "";
        if (para.fecha) para.fecha.value = de.fecha?.value ?? "";
      }
    }
  }

  function limpar(dia: number) {
    for (let i = 0; i < MAX_PERIODOS; i++) {
      const a = entrada(`abre_${dia}_${i}`);
      const f = entrada(`fecha_${dia}_${i}`);
      if (a) a.value = "";
      if (f) f.value = "";
    }
  }

  return (
    <div ref={raiz} className="space-y-3">
      <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
        Digite só os números, em <strong>24 horas</strong>: <strong>1800</strong> vira 18:00 (6 da tarde). Se você abre de manhã e
        de novo à tarde ou à noite, use os <strong>dois períodos</strong>. Deixe em branco os dias em que não abre.
      </p>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-black/15 p-3 text-sm">
        <label className="flex flex-col gap-1">
          Copiar o horário de
          <select name="_origem" defaultValue="1" className="rounded-lg border border-black/10 bg-white px-2 py-2">
            {DIAS_SEMANA.map((nome, dia) => (
              <option key={dia} value={dia}>{nome}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          para
          <select name="_alvo" defaultValue="uteis" className="rounded-lg border border-black/10 bg-white px-2 py-2">
            <option value="uteis">segunda a sexta</option>
            <option value="fimdesemana">sábado e domingo</option>
            <option value="todos">todos os dias</option>
          </select>
        </label>
        <button type="button" onClick={copiar} className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white">
          Copiar
        </button>
      </div>

      {DIAS_SEMANA.map((nome, dia) => (
        <fieldset key={dia} className="rounded-xl border border-black/10 p-3">
          <legend className="px-1 text-sm font-semibold">{nome}</legend>
          <div className="space-y-2">
            {Array.from({ length: MAX_PERIODOS }, (_, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr] items-end gap-2 sm:grid-cols-[9rem_1fr_1fr]">
                <span className="col-span-2 text-xs text-zinc-500 sm:col-span-1 sm:pb-3">{ROTULOS[i]}</span>
                <label className="text-xs text-zinc-600">
                  Abre
                  <CampoHora name={`abre_${dia}_${i}`} defaultValue={inicial[dia]?.[i]?.abre ?? ""} rotulo={`${nome}, ${ROTULOS[i]}: abre às`} className={campo} />
                </label>
                <label className="text-xs text-zinc-600">
                  Fecha
                  <CampoHora name={`fecha_${dia}_${i}`} defaultValue={inicial[dia]?.[i]?.fecha ?? ""} rotulo={`${nome}, ${ROTULOS[i]}: fecha às`} className={campo} />
                </label>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => limpar(dia)} className="mt-2 text-xs text-zinc-500 underline hover:text-zinc-800">
            Não abro {nome === "Sábado" || nome === "Domingo" ? "no" : "na"} {nome.toLowerCase()}
          </button>
        </fieldset>
      ))}
    </div>
  );
}
