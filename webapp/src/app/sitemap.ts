import type { MetadataRoute } from "next";
import { listarVendedores } from "@/lib/vendedores";
import { listarCidades } from "@/lib/cidades";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [vendedores, cidades] = await Promise.all([listarVendedores(), listarCidades()]);

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/sobre`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/contribuicao`, changeFrequency: "monthly", priority: 0.3 },
    // com mais de uma cidade, cada uma ganha a própria página inicial
    ...(cidades.length > 1
      ? cidades.map((c) => ({ url: `${base}/?cidade=${c.slug}`, changeFrequency: "daily" as const, priority: 0.9 }))
      : []),
    { url: `${base}/feedback`, changeFrequency: "yearly" as const, priority: 0.2 },
    { url: `${base}/privacidade`, changeFrequency: "yearly" as const, priority: 0.1 },
    { url: `${base}/termos`, changeFrequency: "yearly" as const, priority: 0.1 },
    ...vendedores.map((v) => ({
      url: `${base}/vendedores/${v.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
