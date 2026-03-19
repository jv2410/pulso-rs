"use client";

import { useEffect, useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Article {
  municipality: string;
  title: string;
  url: string;
  publishedAt: string;
  scrapedAt: string;
  summary?: string;
}

interface DateEntry {
  totalArticles: number;
  totalMunicipalities: number;
  articles: Article[];
}

interface ArticlesByDateData {
  dates: string[];
  byDate: Record<string, DateEntry>;
}

function formatDateBR(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export default function NoticiasPage() {
  const [data, setData] = useState<ArticlesByDateData | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");
  const [filterMunicipality, setFilterMunicipality] = useState("");

  useEffect(() => {
    fetch("/data/articles-by-date.json")
      .then((r) => r.json())
      .then((d: ArticlesByDateData) => {
        setData(d);
        if (d.dates.length > 0) {
          setSelectedDate(d.dates[0]);
        }
      });
  }, []);

  const currentDateData = useMemo(() => {
    if (!data || !selectedDate || !data.byDate[selectedDate]) return null;
    return data.byDate[selectedDate];
  }, [data, selectedDate]);

  const municipalities = useMemo(() => {
    if (!currentDateData) return [];
    const set = new Set(currentDateData.articles.map((a) => a.municipality));
    return Array.from(set).sort();
  }, [currentDateData]);

  const filtered = useMemo(() => {
    if (!currentDateData) return [];
    return currentDateData.articles.filter((a) => {
      const matchSearch =
        !search ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.municipality.toLowerCase().includes(search.toLowerCase());
      const matchMunicipality =
        !filterMunicipality || a.municipality === filterMunicipality;
      return matchSearch && matchMunicipality;
    });
  }, [currentDateData, search, filterMunicipality]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div
          className="text-lg font-editorial"
          style={{ color: "var(--ink-tertiary)" }}
        >
          Carregando dados...
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1
          className="font-editorial text-3xl font-bold mb-1"
          style={{ color: "var(--ink)" }}
        >
          Arquivo de Notícias
        </h1>
        <p style={{ color: "var(--ink-secondary)" }}>
          Consulte as publicações municipais por data
        </p>
      </div>
      <div
        className="h-px mb-6"
        style={{ background: "var(--fio)" }}
      />

      {/* Controls bar */}
      <div
        className="p-4 mb-6"
        style={{
          border: "1px solid var(--fio)",
          borderRadius: "2px",
        }}
      >
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
          {/* Date picker */}
          <select
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setFilterMunicipality("");
            }}
            className="px-3 py-2 text-sm focus:outline-none"
            style={{
              background: "var(--paper-white)",
              border: "1px solid var(--fio)",
              borderRadius: "2px",
              color: "var(--ink)",
            }}
          >
            {data.dates.map((d) => (
              <option key={d} value={d}>
                {formatDateBR(d)}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1 w-full lg:w-auto">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--ink-tertiary)" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Buscar por título ou município..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm focus:outline-none"
              style={{
                background: "var(--paper-white)",
                border: "1px solid var(--fio)",
                borderRadius: "2px",
                color: "var(--ink)",
              }}
            />
          </div>

          {/* Municipality filter */}
          <select
            value={filterMunicipality}
            onChange={(e) => setFilterMunicipality(e.target.value)}
            className="px-3 py-2 text-sm focus:outline-none"
            style={{
              background: "var(--paper-white)",
              border: "1px solid var(--fio)",
              borderRadius: "2px",
              color: "var(--ink)",
            }}
          >
            <option value="">Todos os municípios</option>
            {municipalities.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results summary */}
      <p
        className="text-sm mb-4"
        style={{ color: "var(--ink-secondary)" }}
      >
        {filtered.length} notícias em {formatDateBR(selectedDate)}
      </p>

      {/* Article list - single column, newspaper style */}
      <div>
        {filtered.map((article, i) => (
          <a
            key={i}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-4 group"
            style={{ borderBottom: "1px solid var(--fio)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs uppercase tracking-[0.15em] mb-1"
                  style={{ color: "var(--ink-secondary)" }}
                >
                  {article.municipality}
                </p>
                <h3
                  className="font-editorial font-semibold text-base transition-colors leading-snug"
                  style={{ color: "var(--ink)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "var(--editorial-red)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "var(--ink)")
                  }
                >
                  {article.title}
                </h3>
                {article.summary && (
                  <p
                    className="text-sm mt-1 leading-relaxed"
                    style={{ color: "var(--ink-secondary)" }}
                  >
                    {article.summary}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 mt-1">
                <span
                  className="text-xs"
                  style={{ color: "var(--ink-tertiary)" }}
                >
                  {article.publishedAt
                    ? format(parseISO(article.publishedAt), "dd/MM/yyyy", {
                        locale: ptBR,
                      })
                    : article.scrapedAt
                    ? format(parseISO(article.scrapedAt), "dd/MM HH:mm", {
                        locale: ptBR,
                      })
                    : ""}
                </span>
                <svg
                  className="w-4 h-4"
                  style={{ color: "var(--ink-tertiary)" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </div>
            </div>
          </a>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p
            className="font-editorial"
            style={{ color: "var(--ink-tertiary)" }}
          >
            Nenhuma notícia encontrada para os filtros selecionados.
          </p>
        </div>
      )}
    </div>
  );
}
