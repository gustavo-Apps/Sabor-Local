import type { NextConfig } from "next";
import { montarCspReportOnly } from "./src/lib/csp";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    // endereço antigo do catálogo: a página inicial agora é a visão de cliente
    return [{ source: "/catalogo", destination: "/", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Só relata (não bloqueia): veja docs/seguranca.md, item 8
          {
            key: "Content-Security-Policy-Report-Only",
            value: montarCspReportOnly(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NODE_ENV !== "production"),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
