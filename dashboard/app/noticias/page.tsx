"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "../../lib/supabase";
import PublishToWP from "../components/PublishToWP";
import WhatsNewPopup from "../components/WhatsNewPopup";

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
  image_url: string | null;
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
  const [lastHidden, setLastHidden] = useState<Article | null>(null);

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
        .select("id, title, url, published_at, summary, category, relevance_score, image_url, municipalities(name)")
        .gte("published_at", selectedDate + "T00:00:00Z")
        .lte("published_at", selectedDate + "T23:59:59Z")
        .or("category.is.null,category.neq.Crise")
        .or("relevance_score.is.null,relevance_score.gt.0") // oculta as marcadas como inválidas (score 0)
        .order("published_at", { ascending: false });

      if (data) {
        setArticles(data.map((a: any) => ({
          ...a, municipality: a.municipalities?.name || "", content: null, image_url: a.image_url || null,
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
        .select("content, image_url")
        .eq("id", article.id)
        .single();

      if (data) {
        const updated = { ...article, content: data.content, image_url: data.image_url || article.image_url };
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

  // Marca a notícia como inválida (não deveria aparecer). Soft-hide: grava
  // relevance_score = 0 — a notícia some do feed mas não é apagada (reversível).
  // reason="antiga" também grava category="Notícia Antiga" (motivo da invalidação).
  const markInvalid = useCallback(async (article: Article, reason?: "antiga") => {
    // remove da lista imediatamente (otimista) e fecha o painel se aberto
    setArticles((prev) => prev.filter((a) => a.id !== article.id));
    setLastHidden(article);
    if (selectedArticle?.id === article.id) setSelectedArticle(null);
    // Escreve via rota server-side (service key). A escrita anônima direta era
    // bloqueada pelo RLS silenciosamente (error null, 0 linhas) — nunca persistia.
    const body: { id: number | string; relevance_score: number; category?: string } = {
      id: article.id, relevance_score: 0,
    };
    if (reason === "antiga") body.category = "Notícia Antiga";
    let ok = false;
    try {
      const res = await fetch("/api/invalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      ok = res.ok && (await res.json())?.success === true;
    } catch {
      ok = false;
    }
    if (!ok) {
      // falhou no banco — desfaz a remoção e avisa
      setArticles((prev) => [article, ...prev]);
      setLastHidden(null);
      alert("Não foi possível marcar como inválida. Tente novamente.");
    }
  }, [selectedArticle]);

  // Desfaz a última marcação, restaurando score E categoria originais.
  const undoInvalid = useCallback(async () => {
    if (!lastHidden) return;
    const art = lastHidden;
    setLastHidden(null);
    const restore = art.relevance_score && art.relevance_score > 0 ? art.relevance_score : 3;
    await fetch("/api/invalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: art.id, relevance_score: restore, category: art.category }),
    }).catch(() => {});
    setArticles((prev) => [art, ...prev]
      .sort((a, b) => (b.published_at || "").localeCompare(a.published_at || "")));
  }, [lastHidden]);

  // Auto-fecha o snackbar de "desfazer" após 7s
  useEffect(() => {
    if (!lastHidden) return;
    const t = setTimeout(() => setLastHidden(null), 7000);
    return () => clearTimeout(t);
  }, [lastHidden]);

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
      <WhatsNewPopup />
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
              {article.image_url && (
                <img
                  src={article.image_url}
                  alt=""
                  className="w-12 h-12 rounded object-cover shrink-0 mt-0.5"
                  style={{ border: "1px solid var(--fio)" }}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
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
              <div className="flex flex-col items-end gap-2 shrink-0 mt-1">
                <span className="text-xs" style={{ color: "var(--ink-tertiary)" }}>
                  {article.published_at ? format(new Date(article.published_at), "dd/MM/yyyy", { locale: ptBR }) : ""}
                </span>
                {/* Ações de invalidação — aparecem no hover do card */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Notícia antiga */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Marcar como NOTÍCIA ANTIGA e ocultar?\n\n"${article.title}"`)) markInvalid(article, "antiga");
                    }}
                    title="Marcar como notícia antiga (oculta do feed)"
                    className="flex items-center gap-1 text-xs px-2 py-1"
                    style={{ border: "1px solid var(--fio)", borderRadius: "2px", color: "var(--ink-tertiary)", background: "var(--paper-white)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#b8860b"; e.currentTarget.style.borderColor = "#b8860b"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-tertiary)"; e.currentTarget.style.borderColor = "var(--fio)"; }}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Antiga
                  </button>
                  {/* Inválida (genérica) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Marcar como inválida e ocultar?\n\n"${article.title}"`)) markInvalid(article);
                    }}
                    title="Marcar como inválida (oculta do feed)"
                    className="flex items-center gap-1 text-xs px-2 py-1"
                    style={{ border: "1px solid var(--fio)", borderRadius: "2px", color: "var(--ink-tertiary)", background: "var(--paper-white)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--editorial-red)"; e.currentTarget.style.borderColor = "var(--editorial-red)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-tertiary)"; e.currentTarget.style.borderColor = "var(--fio)"; }}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Inválida
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Snackbar de desfazer (undo) */}
      {lastHidden && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-4 px-4 py-3 shadow-lg"
          style={{ background: "var(--ink)", color: "var(--paper-white)", borderRadius: "4px" }}
        >
          <span className="text-sm">Notícia marcada como inválida e ocultada.</span>
          <button
            onClick={undoInvalid}
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: "#f5b942" }}
          >
            Desfazer
          </button>
          <button onClick={() => setLastHidden(null)} className="text-sm opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

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

                <button
                  onClick={() => {
                    if (selectedArticle && confirm(`Marcar como NOTÍCIA ANTIGA e ocultar?\n\n"${selectedArticle.title}"`)) markInvalid(selectedArticle, "antiga");
                  }}
                  title="Marcar como notícia antiga (oculta do feed)"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm"
                  style={{ border: "1px solid var(--fio)", borderRadius: "2px", color: "var(--ink-tertiary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#b8860b"; e.currentTarget.style.borderColor = "#b8860b"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-tertiary)"; e.currentTarget.style.borderColor = "var(--fio)"; }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Antiga
                </button>

                <button
                  onClick={() => {
                    if (selectedArticle && confirm(`Marcar como inválida e ocultar?\n\n"${selectedArticle.title}"`)) markInvalid(selectedArticle);
                  }}
                  title="Marcar como inválida (oculta do feed)"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm"
                  style={{ border: "1px solid var(--fio)", borderRadius: "2px", color: "var(--ink-tertiary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--editorial-red)"; e.currentTarget.style.borderColor = "var(--editorial-red)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-tertiary)"; e.currentTarget.style.borderColor = "var(--fio)"; }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  Inválida
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
              {selectedArticle.image_url && (
                <img
                  src={selectedArticle.image_url}
                  alt=""
                  className="w-full rounded mb-4 object-cover"
                  style={{ maxHeight: "300px", border: "1px solid var(--fio)" }}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
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
            imageUrl: selectedArticle.image_url || undefined,
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
