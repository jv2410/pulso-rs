"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "../../lib/supabase";
import PublishToWP from "../components/PublishToWP";

interface Article {
  id: number;
  municipality: string;
  title: string;
  url: string;
  published_at: string;
  summary: string | null;
  category: string | null;
  relevance_score: number | null;
  content: string | null;
}

const CATEGORIES = [
  "Agricultura", "Assistência Social", "Cidadania", "Cultura",
  "Desenvolvimento", "Educação", "Esporte e Lazer", "Eventos",
  "Gestão", "Habitação", "Infraestrutura", "Meio Ambiente",
  "Mobilidade", "Resiliência", "Saúde", "Segurança", "Turismo",
];

export default function NoticiasPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");
  const [filterMunicipality, setFilterMunicipality] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterScore, setFilterScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPublish, setShowPublish] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("articles")
        .select("published_at")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(2000);

      if (data) {
        const uniqueDates = [...new Set(data.map((a) => a.published_at!.split("T")[0]))];
        setDates(uniqueDates);
        if (uniqueDates.length > 0) setSelectedDate(uniqueDates[0]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("articles")
        .select("id, title, url, published_at, summary, category, relevance_score, municipalities(name)")
        .gte("published_at", selectedDate + "T00:00:00Z")
        .lte("published_at", selectedDate + "T23:59:59Z")
        .neq("category", "Crise")
        .order("published_at", { ascending: false });

      if (data) {
        setArticles(data.map((a: any) => ({
          ...a, municipality: a.municipalities?.name || "", content: null,
        })));
      }
      setLoading(false);
    })();
  }, [selectedDate]);

  const openArticle = useCallback(async (article: Article) => {
    setSelectedArticle(article);
    setCopied(false);

    if (!article.content) {
      setLoadingContent(true);
      const { data } = await supabase
        .from("articles")
        .select("content")
        .eq("id", article.id)
        .single();

      if (data) {
        const updated = { ...article, content: data.content };
        setSelectedArticle(updated);
        setArticles((prev) => prev.map((a) => (a.id === article.id ? updated : a)));
      }
      setLoadingContent(false);
    }
  }, []);

  const copyAll = useCallback(() => {
    if (!selectedArticle) return;
    const text = [
      selectedArticle.title,
      `Município: ${selectedArticle.municipality}`,
      selectedArticle.category ? `Editoria: ${selectedArticle.category}` : "",
      selectedArticle.published_at ? `Data: ${format(new Date(selectedArticle.published_at), "dd/MM/yyyy", { locale: ptBR })}` : "",
      "",
      selectedArticle.summary ? `Resumo: ${selectedArticle.summary}` : "",
      "",
      selectedArticle.content || "(Conteúdo não disponível)",
      "",
      `Fonte: ${selectedArticle.url}`,
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [selectedArticle]);

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
      const matchSearch = !search ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.municipality.toLowerCase().includes(search.toLowerCase()) ||
        (a.summary || "").toLowerCase().includes(search.toLowerCase());
      const matchMunicipality = !filterMunicipality || a.municipality === filterMunicipality;
      const matchCategory = !filterCategory || a.category === filterCategory;
      const matchScore = !filterScore || (a.relevance_score !== null && a.relevance_score >= filterScore);
      return matchSearch && matchMunicipality && matchCategory && matchScore;
    });
  }, [articles, search, filterMunicipality, filterCategory, filterScore]);

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
          <select value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setFilterMunicipality(""); setFilterCategory(""); }}
            className="px-3 py-2 text-sm focus:outline-none"
            style={{ background: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "2px", color: "var(--ink)" }}>
            {dates.map((d) => <option key={d} value={d}>{formatDateBR(d)}</option>)}
          </select>

          <div className="relative flex-1 w-full lg:w-auto">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--ink-tertiary)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Buscar por título, município ou resumo..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm focus:outline-none"
              style={{ background: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "2px", color: "var(--ink)" }} />
          </div>

          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 text-sm focus:outline-none"
            style={{ background: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "2px", color: "var(--ink)" }}>
            <option value="">Todas as editorias</option>
            {activeCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={filterMunicipality} onChange={(e) => setFilterMunicipality(e.target.value)}
            className="px-3 py-2 text-sm focus:outline-none"
            style={{ background: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "2px", color: "var(--ink)" }}>
            <option value="">Todos os municípios</option>
            {municipalities.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>

          {/* Score filter */}
          <select value={filterScore} onChange={(e) => setFilterScore(Number(e.target.value))}
            className="px-3 py-2 text-sm focus:outline-none"
            style={{ background: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "2px", color: "var(--ink)" }}>
            <option value={0}>Todas as notas</option>
            <option value={5}>★★★★★ (5)</option>
            <option value={4}>★★★★ (4+)</option>
            <option value={3}>★★★ (3+)</option>
          </select>
        </div>
      </div>

      {/* Results summary */}
      <p className="text-sm mb-4" style={{ color: "var(--ink-secondary)" }}>
        {filtered.length} notícias em {formatDateBR(selectedDate)}
        {filterCategory && ` · ${filterCategory}`}
        {filterScore > 0 && ` · ${"★".repeat(filterScore)}+`}
      </p>

      {/* Article list */}
      <div>
        {filtered.map((article) => (
          <div
            key={article.id}
            onClick={() => openArticle(article)}
            className="block py-4 cursor-pointer group"
            style={{ borderBottom: "1px solid var(--fio)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs uppercase tracking-[0.15em]" style={{ color: "var(--ink-secondary)" }}>
                    {article.municipality}
                  </p>
                  {article.relevance_score && (
                    <span className="text-xs" style={{ color: "#d4a017", letterSpacing: "1px" }}>
                      {"★".repeat(article.relevance_score)}{"☆".repeat(5 - article.relevance_score)}
                    </span>
                  )}
                  {article.category && (
                    <span className="text-xs px-1.5 py-0.5"
                      style={{ background: "var(--paper-dark)", color: "var(--ink-secondary)", borderRadius: "2px" }}>
                      {article.category}
                    </span>
                  )}
                </div>
                <h3 className="font-editorial font-semibold text-base transition-colors leading-snug"
                  style={{ color: "var(--ink)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--editorial-red)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink)")}>
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
                  {article.published_at ? format(new Date(article.published_at), "dd/MM/yyyy", { locale: ptBR }) : ""}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-16">
          <p className="font-editorial" style={{ color: "var(--ink-tertiary)" }}>
            Nenhuma notícia encontrada para os filtros selecionados.
          </p>
        </div>
      )}

      {/* Article Detail Panel (Modal) */}
      {selectedArticle && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedArticle(null); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.3)" }} />

          {/* Panel */}
          <div
            className="relative w-full max-w-2xl h-full overflow-y-auto"
            style={{ background: "var(--paper-white)", borderLeft: "1px solid var(--fio)" }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4"
              style={{ background: "var(--paper-white)", borderBottom: "1px solid var(--fio)" }}>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
                  style={{
                    border: "1px solid var(--fio)", borderRadius: "2px",
                    background: copied ? "var(--serra-green)" : "var(--paper-white)",
                    color: copied ? "white" : "var(--ink-secondary)",
                  }}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copiado!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copiar tudo
                    </>
                  )}
                </button>

                <a
                  href={selectedArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm"
                  style={{ border: "1px solid var(--fio)", borderRadius: "2px", color: "var(--blue-pen)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Visitar noticia
                </a>

                <button
                  onClick={() => setShowPublish(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
                  style={{ borderRadius: "2px", background: "var(--editorial-red)", color: "white", border: "none" }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Portal 497
                </button>
              </div>

              <button
                onClick={() => setSelectedArticle(null)}
                className="p-1"
                style={{ color: "var(--ink-tertiary)" }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs uppercase tracking-[0.15em]" style={{ color: "var(--ink-secondary)" }}>
                  {selectedArticle.municipality}
                </p>
                {selectedArticle.relevance_score && (
                  <span className="text-sm" style={{ color: "#d4a017", letterSpacing: "1px" }}>
                    {"★".repeat(selectedArticle.relevance_score)}{"☆".repeat(5 - selectedArticle.relevance_score)}
                  </span>
                )}
                {selectedArticle.category && (
                  <span className="text-xs px-1.5 py-0.5"
                    style={{ background: "var(--paper-dark)", color: "var(--ink-secondary)", borderRadius: "2px" }}>
                    {selectedArticle.category}
                  </span>
                )}
                <span className="text-xs" style={{ color: "var(--ink-tertiary)" }}>
                  {selectedArticle.published_at
                    ? format(new Date(selectedArticle.published_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : ""}
                </span>
              </div>

              <h2 className="font-editorial text-2xl font-bold mb-4 leading-snug" style={{ color: "var(--ink)" }}>
                {selectedArticle.title}
              </h2>

              {selectedArticle.summary && (
                <p className="text-base mb-6 leading-relaxed font-medium" style={{ color: "var(--ink-secondary)" }}>
                  {selectedArticle.summary}
                </p>
              )}

              <div className="h-px mb-6" style={{ background: "var(--fio)" }} />

              {loadingContent ? (
                <p style={{ color: "var(--ink-tertiary)" }}>Carregando conteudo...</p>
              ) : selectedArticle.content ? (
                <div className="text-sm leading-7" style={{ color: "var(--ink)" }}>
                  {selectedArticle.content.split(/\n{2,}/).map((paragraph, i) => {
                    const trimmed = paragraph.trim();
                    if (!trimmed) return null;
                    return (
                      <p key={i} className="mb-4">
                        {trimmed}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: "var(--ink-tertiary)" }}>
                  Conteudo completo nao disponivel. Visite a noticia original.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Publish to WP Modal */}
      {showPublish && selectedArticle && (
        <PublishToWP
          article={{
            title: selectedArticle.title,
            content: selectedArticle.content,
            summary: selectedArticle.summary,
            municipality: selectedArticle.municipality,
            category: selectedArticle.category,
            url: selectedArticle.url,
          }}
          onClose={() => setShowPublish(false)}
          onPublished={(link) => {
            setShowPublish(false);
          }}
        />
      )}
    </div>
  );
}
