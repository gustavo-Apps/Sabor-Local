// Regras de imagem do perfil (logo quadrada e banner largo). Sem dependências do navegador, para rodar nos testes.

export type TipoImagem = "logo" | "banner";

export const IMAGENS: Record<TipoImagem, { largura: number; altura: number; minimo: number; rotulo: string }> = {
  logo: { largura: 512, altura: 512, minimo: 200, rotulo: "Logo" },
  banner: { largura: 1200, altura: 400, minimo: 600, rotulo: "Banner" },
};

/** Foto do celular passa fácil de 5 MB; aceitamos até aqui e reduzimos antes de enviar. */
export const TAMANHO_MAXIMO_ORIGINAL = 15 * 1024 * 1024;

export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];

export interface Recorte {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Maior retângulo com a proporção do destino, centralizado na imagem original ("cover", sem esticar). */
export function calcularRecorte(origemLargura: number, origemAltura: number, tipo: TipoImagem): Recorte {
  const alvo = IMAGENS[tipo];
  const proporcao = alvo.largura / alvo.altura;
  let largura = origemLargura;
  let altura = largura / proporcao;
  if (altura > origemAltura) {
    altura = origemAltura;
    largura = altura * proporcao;
  }
  return {
    x: Math.round((origemLargura - largura) / 2),
    y: Math.round((origemAltura - altura) / 2),
    largura: Math.max(1, Math.round(largura)),
    altura: Math.max(1, Math.round(altura)),
  };
}

/** A parte aproveitada da foto não pode ser pequena demais, senão fica borrada quando esticada. */
export function erroDoRecorte(recorte: Recorte, tipo: TipoImagem): string | null {
  const { minimo, rotulo } = IMAGENS[tipo];
  if (recorte.largura < minimo) {
    return `Essa imagem é pequena demais para o ${rotulo.toLowerCase()}. Escolha uma foto maior (pelo menos ${minimo} pixels de largura na parte aproveitada).`;
  }
  return null;
}

/** Texto de erro para um arquivo recusado antes do envio; null quando serve. */
export function erroDoArquivo(arquivo: { type: string; size: number }): string | null {
  if (!TIPOS_ACEITOS.includes(arquivo.type)) return "Escolha uma foto em JPG, PNG ou WebP.";
  if (arquivo.size > TAMANHO_MAXIMO_ORIGINAL) return "A imagem é grande demais. O limite é 15 MB.";
  return null;
}

const MARCA_DO_BUCKET = "/storage/v1/object/public/cardapios/";

/** Caminho do arquivo dentro do bucket a partir do endereço público; null se não for do nosso Storage. */
export function caminhoNoBucket(url: string | null | undefined): string | null {
  if (!url) return null;
  const i = url.indexOf(MARCA_DO_BUCKET);
  if (i < 0) return null;
  const caminho = decodeURIComponent(url.slice(i + MARCA_DO_BUCKET.length).split("?")[0]);
  return caminho || null;
}
