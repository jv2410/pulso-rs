"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const navItems = [
  { href: "/", label: "Capa" },
  { href: "/noticias", label: "Notícias" },
  { href: "/estatisticas", label: "Indicadores" },
  { href: "/evolucao", label: "Bastidores" },
  { href: "/municipios", label: "Cobertura" },
  { href: "/sincronizacao", label: "Sincronização" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Capitalize first letter
  const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <html lang="pt-BR">
      <head>
        <title>497 RS — Monitor de Notícias Municipal</title>
        <meta
          name="description"
          content="Monitoramento jornalístico dos municípios do Rio Grande do Sul"
        />
      </head>
      <body className="antialiased">
        {/* Newspaper Masthead */}
        <header style={{ background: "var(--paper-white)" }}>
          {/* Masthead title */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 text-center">
            <h1
              className="font-editorial text-3xl font-black tracking-[0.2em] uppercase"
              style={{ color: "var(--ink)" }}
            >
              497 RS
            </h1>
            <p
              className="text-xs uppercase tracking-[0.3em] mt-1"
              style={{ color: "var(--ink-secondary)" }}
            >
              Monitoramento Municipal &bull; Edição 8
            </p>
          </div>

          {/* Fio tipográfico */}
          <div
            className="h-px"
            style={{ background: "var(--fio)" }}
          />

          {/* Navigation */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center justify-center gap-8 py-3">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-sm transition-colors pb-2"
                    style={{
                      color: isActive
                        ? "var(--editorial-red)"
                        : "var(--ink-secondary)",
                      fontWeight: isActive ? 600 : 400,
                      borderBottom: isActive
                        ? "2px solid var(--editorial-red)"
                        : "2px solid transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive)
                        e.currentTarget.style.color = "var(--ink)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive)
                        e.currentTarget.style.color = "var(--ink-secondary)";
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile hamburger */}
            <div className="md:hidden flex items-center justify-between py-3">
              <span
                className="text-xs capitalize"
                style={{ color: "var(--ink-tertiary)" }}
              >
                {todayCapitalized}
              </span>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{ color: "var(--ink-secondary)" }}
                className="p-1"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {menuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Nav Dropdown */}
          {menuOpen && (
            <div
              className="md:hidden py-2 px-4"
              style={{
                borderTop: "1px solid var(--fio)",
                background: "var(--paper-white)",
              }}
            >
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 text-sm transition-colors"
                    style={{
                      color: isActive
                        ? "var(--editorial-red)"
                        : "var(--ink-secondary)",
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Fio tipográfico */}
          <div
            className="h-px"
            style={{ background: "var(--fio)" }}
          />

          {/* Date bar */}
          <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <p
              className="text-xs capitalize"
              style={{ color: "var(--ink-tertiary)" }}
            >
              {todayCapitalized}
            </p>
          </div>

          {/* Bottom fio */}
          <div
            className="h-px"
            style={{ background: "var(--fio)" }}
          />
        </header>

        {/* Main content */}
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer
          className="mt-12 py-6"
          style={{ borderTop: "1px solid var(--fio)" }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p
              className="text-sm"
              style={{ color: "var(--ink-tertiary)" }}
            >
              497 RS &mdash; Monitoramento jornalístico dos municípios gaúchos
            </p>
            <p
              className="text-[10px] mt-1 select-all"
              style={{ color: "var(--ink-tertiary)", opacity: 0.4 }}
              title="Versão em produção (commit + horário do build)"
            >
              v {process.env.NEXT_PUBLIC_COMMIT_SHA}
              {process.env.NEXT_PUBLIC_BUILD_TIME
                ? " · " + new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                : ""}
            </p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
