import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LinkMeusPedidos } from "@/components/LinkMeusPedidos";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  openGraph: { siteName: "Sabor Local", locale: "pt_BR", type: "website" },
  title: "Sabor Local — Descubra o que sua cidade tem de bom",
  description:
    "Catálogo gastronômico da cidade: cardápios, horários e contato direto por WhatsApp com vendedores locais.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b border-black/10 bg-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4">
            <Link href="/" className="whitespace-nowrap font-serif text-xl font-bold">
              Sabor <span className="text-orange-600">Local</span>
              <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 align-middle font-sans text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                beta
              </span>
            </Link>
            <nav className="ml-auto flex gap-3 whitespace-nowrap text-sm text-zinc-600 sm:gap-4">
              <Link href="/" className="hover:text-zinc-900">
                Sou cliente
              </Link>
              <Link href="/painel" className="hover:text-zinc-900">
                Sou vendedor
              </Link>
              <LinkMeusPedidos />
            </nav>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="border-t border-black/10 bg-white py-6 text-xs text-zinc-500">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 sm:flex-row">
            <p>Sabor Local — plataforma de descoberta gastronômica local.</p>
            <nav aria-label="Rodapé" className="flex gap-4">
              <Link href="/sobre" className="hover:text-zinc-900 hover:underline">
                Sobre
              </Link>
              <Link href="/contribuicao" className="hover:text-zinc-900 hover:underline">
                Contribuição
              </Link>
              <Link href="/feedback" className="hover:text-zinc-900 hover:underline">
                Fale conosco
              </Link>
              <Link href="/termos" className="hover:text-zinc-900 hover:underline">
                Termos
              </Link>
              <Link href="/privacidade" className="hover:text-zinc-900 hover:underline">
                Privacidade
              </Link>
              <a
                href="https://github.com/gustavo-Apps"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-900 hover:underline"
              >
                GitHub
              </a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
