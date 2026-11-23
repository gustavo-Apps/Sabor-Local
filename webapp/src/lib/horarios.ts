import type { ExcecaoHorario, HorarioFuncionamento, Vendedor } from "@/lib/types";

const FUSO = "America/Sao_Paulo";
const DIAS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface AgoraBR {
  data: string; // YYYY-MM-DD
  minutos: number; // minutos desde 00:00
  diaSemana: number; // 0 = domingo
}

// O servidor (Vercel) roda em UTC; o horário que importa é o da cidade.
export function agoraBR(now: Date = new Date()): AgoraBR {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: FUSO,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );

  return {
    data: `${partes.year}-${partes.month}-${partes.day}`,
    minutos: Number(partes.hour) * 60 + Number(partes.minute),
    diaSemana: DIAS_EN.indexOf(partes.weekday),
  };
}

export function formatarData(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function dentroDaJanela(abre: string, fecha: string, minutos: number, viradaDeOntem = false) {
  const a = toMinutes(abre);
  const f = toMinutes(fecha);
  if (f <= a) {
    // janela que cruza a meia-noite (ex.: 18:00–02:00)
    return viradaDeOntem ? minutos < f : minutos >= a;
  }
  return !viradaDeOntem && minutos >= a && minutos < f;
}

export function estaAbertoAgora(
  horarios: HorarioFuncionamento[] | undefined,
  now: Date = new Date(),
): boolean {
  if (!horarios || horarios.length === 0) return false;
  const { diaSemana, minutos } = agoraBR(now);
  const ontem = (diaSemana + 6) % 7;

  return horarios.some(
    (h) =>
      (h.dia_semana === diaSemana && dentroDaJanela(h.abre, h.fecha, minutos)) ||
      (h.dia_semana === ontem && dentroDaJanela(h.abre, h.fecha, minutos, true)),
  );
}

export interface Situacao {
  aberto: boolean;
  rotulo: string;
  aviso?: string;
}

type DadosHorario = Pick<
  Vendedor,
  "horarios" | "excecoes" | "status_manual" | "status_manual_ate" | "status_manual_msg"
>;

export function statusManualVigente(v: DadosHorario, hoje: string): boolean {
  if (!v.status_manual || v.status_manual === "normal") return false;
  return !v.status_manual_ate || v.status_manual_ate >= hoje;
}

export function excecaoDeHoje(excecoes: ExcecaoHorario[] | undefined, hoje: string) {
  return excecoes?.find((e) => e.data === hoje);
}

// Ordem de prioridade: férias/"não abre hoje" > exceção da data > horário semanal
export function situacaoAgora(v: DadosHorario, now: Date = new Date()): Situacao {
  const { data: hoje, minutos } = agoraBR(now);

  if (statusManualVigente(v, hoje)) {
    const volta = v.status_manual_ate ? `Volta em ${formatarData(v.status_manual_ate)}` : undefined;
    return {
      aberto: false,
      rotulo: v.status_manual === "ferias" ? "De férias" : "Não abre hoje",
      aviso: [v.status_manual_msg, v.status_manual === "ferias" ? volta : undefined]
        .filter(Boolean)
        .join(" · ") || undefined,
    };
  }

  const excecao = excecaoDeHoje(v.excecoes, hoje);
  if (excecao) {
    if (excecao.fechado) {
      return { aberto: false, rotulo: "Fechado hoje", aviso: excecao.motivo ?? undefined };
    }
    const aberto = dentroDaJanela(excecao.abre!, excecao.fecha!, minutos);
    return {
      aberto,
      rotulo: aberto ? "Aberto agora" : "Fechado agora",
      aviso: `Hoje: ${excecao.abre!.slice(0, 5)} às ${excecao.fecha!.slice(0, 5)}${excecao.motivo ? ` · ${excecao.motivo}` : ""}`,
    };
  }

  const aberto = estaAbertoAgora(v.horarios, now);
  return { aberto, rotulo: aberto ? "Aberto agora" : "Fechado agora" };
}
