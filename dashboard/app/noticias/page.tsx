"use client";

import { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "../../lib/supabase";

interface Article {
  id: number;
  municipality: string;
  title: string;
  url: string;
  published_at: string;
  summary: string | null;
  category: string | null;
}

const CATEGORIES = [
  "Agricultura",
  "Assistência Social",
  "Cidadania",
  "Cultura",
  "Desenvolvimento",
  "Educação",
  "Esporte e Lazer",
  "Eventos",
  "Gestão",
  "Habitação",
  "Infraestrutura",
  "Meio Ambiente",
  "Mobilidade",
  "Resiliência",
  "Saúde",
  "Segurança",
  "Turismo",
];

export default function NoticiasPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");
  const [filterMunicipality, setFilterMunicipality] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [loading, setLoading] = useState(true);

  // Load available dates
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("articles")
        .select("published_at")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false });

      if (data) {
        const uniqueDates = [
          ...new Set(data.map((a) => a.published_at!.split("T")[0])),
        ];
        setDates(uniqueDates);
        if (uniqueDates.length > 0) setSelectedDate(uniqueDates[0]);
      }
    })();
  }, []);

  // Load articles for selected date
  useEffect(() => {
    if (!selectedDate) return;
    setLoading(true);

    (async () => {
      const dayStart = selectedDate + "T00:00:00Z";
      const dayEnd = selectedDate + "T23:59:59Z";

      let query = supabase
        .from("articles")
        .select("id, title, url, published_at, summary, category, municipalities(name)")
        .gte("published_at", dayStart)
        .lte("published_at", dayEnd)
        .neq("category", "Crise")
        .order("published_at", { ascending: false });

      const { data } = await query;

      if (data) {
        setArticles(
          data.map((a: any) => ({
            ...a,
            municipality: a.municipalities?.name || "",
          }))
        );
      }
      setLoading(false);
    })();
  }, [selectedDate]);

  const municipalities = useMemo(() => {
    const set = new Set(articles.map((a) => a.municipality));
    return Array.from(set).sort();
  }, [articles]);

  const activeCategories = useMemo(() => {
    const set = new Set(articles.map((a) => a.category).filter(Boolean));
    return CATEGORIES.filter((c) => set.has(c));
  }, [articles]);

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      const matchSearch =
        !search ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.municipality.toLowerCase().includes(search.toLowerCase()) ||
        (a.summary || "").toLowerCase().includes(search.toLowerCase());
      const matchMunicipality =
        !filterMunicipality || a.municipality === filterMunicipality;
      const matchCategory =
        !filterCategory || a.category === filterCategory;
      return matchSearch && matchMunicipality && matchCategory;
    });
  }, [articles, search, filterMunicipality, filterCategory]);

  function formatDateBR(isoDate: string): string {
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
  }

  if (loading && dates.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg font-editorial" style={{ color: "var(--ink-tertiary)" }}>
          Carregando dados...
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="font-editorial text-3xl font-bold mb-1" style={{ color: "var(--ink)" }}>
          Arquivo de Notícias
        </h1>
        <p style={{ color: "var(--ink-secondary)" }}>
          Consulte as publicações municipais por data e editoria
        </p>
      </div>
      <div className="h-px mb-6" style={{ background: "var(--fio)" }} />

      {/* Controls bar */}
      <div className="p-4 mb-6" style={{ border: "1px solid var(--fio)", borderRadius: "2px" }}>
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
          {/* Date picker */}
          <select
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setFilterMunicipality("");
              setFilterCategory("");
            }}
            className="px-3 py-2 text-sm focus:outline-none"
            style={{ background: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "2px", color: "var(--ink)" }}
          >
            {dates.map((d) => (
              <option key={d} value={d}>{formatDateBR(d)}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1 w-full lg:w-auto">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--ink-tertiary)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por título, município ou resumo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm focus:outline-none"
              style={{ background: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "2px", color: "var(--ink)" }}
            />
          </div>

          {/* Category filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 text-sm focus:outline-none"
            style={{ background: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "2px", color: "var(--ink)" }}
          >
            <option value="">Todas as editorias</option>
            {activeCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Municipality filter */}
          <select
            value={filterMunicipality}
            onChange={(e) => setFilterMunicipality(e.target.value)}
            className="px-3 py-2 text-sm focus:outline-none"
            style={{ background: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "2px", color: "var(--ink)" }}
          >
            <option value="">Todos os municípios</option>
            {municipalities.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results summary */}
      <p className="text-sm mb-4" style={{ color: "var(--ink-secondary)" }}>
        {filtered.length} notícias em {formatDateBR(selectedDate)}
        {filterCategory && ` • ${filterCategory}`}
      </p>

      {/* Article list */}
      <div>
        {filtered.map((article) => (
          <a
            key={article.id}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-4 group"
            style={{ borderBottom: "1px solid var(--fio)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs uppercase tracking-[0.15em]" style={{ color: "var(--ink-secondary)" }}>
                    {article.municipality}
                  </p>
                  {article.category && (
                    <span
                      className="text-xs px-1.5 py-0.5"
                      style={{ background: "var(--paper-dark)", color: "var(--ink-secondary)", borderRadius: "2px" }}
                    >
                      {article.category}
                    </span>
                  )}
                </div>
                <h3
                  className="font-editorial font-semibold text-base transition-colors leading-snug"
                  style={{ color: "var(--ink)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--editorial-red)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink)")}
                >
                  {article.title}
                </h3>
                {article.summary && (
                  <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--ink-secondary)" }}>
                    {article.summary}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 mt-1">
                <span className="text-xs" style={{ color: "var(--ink-tertiary)" }}>
                  {article.published_at
                    ? format(new Date(article.published_at), "dd/MM/yyyy", { locale: ptBR })
                    : ""}
                </span>
                <svg className="w-4 h-4" style={{ color: "var(--ink-tertiary)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
            </div>
          </a>
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-16">
          <p className="font-editorial" style={{ color: "var(--ink-tertiary)" }}>
            Nenhuma notícia encontrada para os filtros selecionados.
          </p>
        </div>
      )}
    </div>
  );
}
