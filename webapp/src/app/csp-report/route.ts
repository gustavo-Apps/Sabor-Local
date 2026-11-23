import { resumirRelatorioCsp } from "@/lib/csp";

export const dynamic = "force-dynamic";

const LIMITE_BYTES = 8 * 1024;
const MAX_POR_MINUTO = 30; // por instância do servidor: nem uma página com erro enche o registro

let janela = { inicio: 0, total: 0 };

// Recebe os relatórios do navegador (Content-Security-Policy-Report-Only) e registra um resumo no log do servidor.
export async function POST(request: Request) {
  const declarado = Number(request.headers.get("content-length") ?? "0");
  if (declarado > LIMITE_BYTES) return new Response(null, { status: 413 });

  const texto = (await request.text()).slice(0, LIMITE_BYTES + 1);
  if (texto.length > LIMITE_BYTES) return new Response(null, { status: 413 });

  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return new Response(null, { status: 400 });
  }

  const resumo = resumirRelatorioCsp(corpo);
  if (!resumo) return new Response(null, { status: 400 });

  const agora = Date.now();
  if (agora - janela.inicio > 60_000) janela = { inicio: agora, total: 0 };
  if (janela.total < MAX_POR_MINUTO) {
    janela.total += 1;
    console.warn("[csp]", JSON.stringify(resumo));
  }
  return new Response(null, { status: 204 });
}
