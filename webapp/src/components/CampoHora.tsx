"use client";

import { completarHora, mascararHora } from "@/lib/validacao";

interface Props {
  name: string;
  defaultValue?: string;
  rotulo: string;
  className?: string;
}

// Hora em 24 horas, digitada com o teclado numérico: "1830" vira "18:30".
// Não usa <input type="time">, que no celular abre o relógio com AM/PM e confunde (principalmente no Samsung).
export function CampoHora({ name, defaultValue = "", rotulo, className }: Props) {
  return (
    <input
      name={name}
      defaultValue={defaultValue}
      inputMode="numeric"
      autoComplete="off"
      enterKeyHint="next"
      maxLength={5}
      placeholder="18:00"
      aria-label={rotulo}
      className={className}
      onChange={(e) => {
        e.currentTarget.value = mascararHora(e.currentTarget.value);
      }}
      onBlur={(e) => {
        e.currentTarget.value = completarHora(e.currentTarget.value);
      }}
    />
  );
}
