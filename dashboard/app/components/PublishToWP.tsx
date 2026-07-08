"use client";

import { useEffect, useState, useCallback } from "react";

interface PublishToWPProps {
  article: {
    id: number;
    title: string;
    content: string | null;
    summary: string | null;
    municipality: string;
    category: string | null;
    url: string;
    imageUrl?: string;
  };
  onClose: () => void;
  onPublished: (link: string) => void;
}

interface WPOption {
  id: number;
  name: string;
}

// Map Supabase categories to WP category IDs
const CATEGORY_MAP: Record<string, number> = {
  "Cidadania": 530,
  "Cultura": 727,
  "Desenvolvimento": 535,
  "Educação": 534,
  "Esporte e Lazer": 730,
  "Gestão": 533,
  "Habitação": 728,
  "Meio Ambiente": 726,
  "Mobilidade": 531,
  "Resiliência": 536,
  "Saúde": 532,
  "Segurança": 529,
  "Turismo": 729,
};

const ALL_CATEGORIES: WPOption[] = [
  { id: 530, name: "CIDADANIA" },
  { id: 727, name: "CULTURA" },
  { id: 535, name: "DESENVOLVIMENTO" },
  { id: 534, name: "EDUCAÇÃO" },
  { id: 730, name: "ESPORTE E LAZER" },
  { id: 533, name: "GESTÃO" },
  { id: 728, name: "HABITAÇÃO" },
  { id: 726, name: "MEIO AMBIENTE" },
  { id: 531, name: "MOBILIDADE" },
  { id: 536, name: "RESILIÊNCIA" },
  { id: 532, name: "SAÚDE" },
  { id: 529, name: "SEGURANÇA" },
  { id: 729, name: "TURISMO" },
];

const EDITORIAIS_GERAL: WPOption[] = [
  { id: 537, name: "CIDADES" },
  { id: 538, name: "EVENTOS" },
  { id: 539, name: "INICIATIVAS TRANSFORMADORAS" },
  { id: 541, name: "OPINIÃO" },
  { id: 540, name: "VOZ DAS CIDADES" },
];

const AUTHORS: WPOption[] = [
  { id: 3, name: "Carina" },
  { id: 8, name: "Joao" },
  { id: 7, name: "Ismael" },
  { id: 6, name: "Jairo Jorge" },
  { id: 2, name: "Mario" },
  { id: 5, name: "Vivi" },
];

export default function PublishToWP({ article, onClose, onPublished }: PublishToWPProps) {
  const [title, setTitle] = useState(article.title);
  const [contentText, setContentText] = useState(article.content || "");
  const [selectedCategories, setSelectedCategories] = useState<number[]>(() => {
    const mapped = article.category ? CATEGORY_MAP[article.category] : null;
    return mapped ? [mapped] : [];
  });
  const [selectedEditoriais, setSelectedEditoriais] = useState<number[]>([537]); // CIDADES default
  const [selectedCidade, setSelectedCidade] = useState<number | null>(null);
  const [cidadeSearch, setCidadeSearch] = useState(article.municipality || "");
  const [cidadeResults, setCidadeResults] = useState<WPOption[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [author, setAuthor] = useState(8); // Joao default
  const [status, setStatus] = useState<"draft" | "publish">("draft");
  const [imageUrl, setImageUrl] = useState(article.imageUrl || "");
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; link?: string; editLink?: string; status?: string; error?: string } | null>(null);

  // Search cities
  useEffect(() => {
    if (cidadeSearch.length < 2) { setCidadeResults([]); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/publish-wp?type=cidades&search=${encodeURIComponent(cidadeSearch)}`);
      const data = await res.json();
      if (Array.isArray(data)) setCidadeResults(data);
    }, 300);
    return () => clearTimeout(timer);
  }, [cidadeSearch]);

  // Auto-search municipality name on mount
  useEffect(() => {
    if (article.municipality) {
      setCidadeSearch(article.municipality);
    }
  }, [article.municipality]);

  const toggleCategory = (id: number) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleEditorial = (id: number) => {
    setSelectedEditoriais((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handlePublish = async () => {
    if (!title || selectedCategories.length === 0) {
      alert("Titulo e pelo menos 1 editorial setorial sao obrigatorios.");
      return;
    }

    setPublishing(true);
    setResult(null);

    // Convert content to HTML paragraphs
    const contentHtml = contentText
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => `<p>${p}</p>`)
      .join("\n");

    try {
      const res = await fetch("/api/publish-wp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article.id,
          title,
          content: contentHtml,
          excerpt: article.summary || "",
          categories: selectedCategories,
          editoriaisGeral: selectedEditoriais,
          estadocidade: selectedCidade ? [selectedCidade] : [],
          tags,
          author,
          status,
          featuredMediaUrl: imageUrl || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult({ success: true, link: data.link, editLink: data.editLink, status: data.status });
        onPublished(data.link);
      } else {
        setResult({ success: false, error: data.error });
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    }

    setPublishing(false);
  };

  const inputStyle = {
    background: "var(--paper-white)",
    border: "1px solid var(--fio)",
    borderRadius: "2px",
    color: "var(--ink)",
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} />

      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded" style={{ background: "var(--paper-white)", border: "1px solid var(--fio)" }}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4" style={{ background: "var(--paper-white)", borderBottom: "1px solid var(--fio)" }}>
          <h3 className="font-editorial font-bold text-lg" style={{ color: "var(--ink)" }}>
            Publicar no Portal 497
          </h3>
          <button onClick={onClose} style={{ color: "var(--ink-tertiary)" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "var(--ink-secondary)" }}>Titulo</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm focus:outline-none" style={inputStyle} />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "var(--ink-secondary)" }}>Texto da materia</label>
            <textarea value={contentText} onChange={(e) => setContentText(e.target.value)}
              rows={8} className="w-full px-3 py-2 text-sm focus:outline-none leading-relaxed"
              style={{ ...inputStyle, resize: "vertical", minHeight: "150px" }}
              placeholder="Texto completo da noticia..." />
            <p className="text-xs mt-1" style={{ color: "var(--ink-tertiary)" }}>
              Separe paragrafos com linha em branco. {contentText.length} caracteres
            </p>
          </div>

          {/* Editoriais Setoriais */}
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "var(--ink-secondary)" }}>Editoriais Setoriais *</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_CATEGORIES.map((cat) => (
                <button key={cat.id} onClick={() => toggleCategory(cat.id)}
                  className="px-2 py-1 text-xs transition-colors"
                  style={{
                    borderRadius: "2px",
                    border: "1px solid var(--fio)",
                    background: selectedCategories.includes(cat.id) ? "var(--blue-pen)" : "var(--paper-white)",
                    color: selectedCategories.includes(cat.id) ? "white" : "var(--ink-secondary)",
                  }}>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Editoriais Geral */}
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "var(--ink-secondary)" }}>Editoriais Geral</label>
            <div className="flex flex-wrap gap-1.5">
              {EDITORIAIS_GERAL.map((ed) => (
                <button key={ed.id} onClick={() => toggleEditorial(ed.id)}
                  className="px-2 py-1 text-xs transition-colors"
                  style={{
                    borderRadius: "2px",
                    border: "1px solid var(--fio)",
                    background: selectedEditoriais.includes(ed.id) ? "var(--serra-green)" : "var(--paper-white)",
                    color: selectedEditoriais.includes(ed.id) ? "white" : "var(--ink-secondary)",
                  }}>
                  {ed.name}
                </button>
              ))}
            </div>
          </div>

          {/* Cidade */}
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "var(--ink-secondary)" }}>Cidade</label>
            <input type="text" value={cidadeSearch} onChange={(e) => { setCidadeSearch(e.target.value); setSelectedCidade(null); }}
              placeholder="Buscar municipio..." className="w-full px-3 py-2 text-sm focus:outline-none" style={inputStyle} />
            {cidadeResults.length > 0 && !selectedCidade && (
              <div className="mt-1 max-h-32 overflow-y-auto" style={{ border: "1px solid var(--fio)", borderRadius: "2px" }}>
                {cidadeResults.map((c) => (
                  <button key={c.id} onClick={() => { setSelectedCidade(c.id); setCidadeSearch(c.name); setCidadeResults([]); }}
                    className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100" style={{ color: "var(--ink)" }}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {selectedCidade && (
              <p className="text-xs mt-1" style={{ color: "var(--serra-green)" }}>Selecionado: {cidadeSearch}</p>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "var(--ink-secondary)" }}>Tags</label>
            <div className="flex gap-2">
              <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Adicionar tag..." className="flex-1 px-3 py-2 text-sm focus:outline-none" style={inputStyle} />
              <button onClick={addTag} className="px-3 py-2 text-sm" style={{ ...inputStyle, color: "var(--blue-pen)" }}>+</button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 px-2 py-0.5 text-xs"
                    style={{ background: "var(--paper-dark)", borderRadius: "2px", color: "var(--ink-secondary)" }}>
                    {tag}
                    <button onClick={() => removeTag(tag)} className="text-xs">x</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "var(--ink-secondary)" }}>Imagem destacada (URL)</label>
            <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://... (cole a URL da imagem)" className="w-full px-3 py-2 text-sm focus:outline-none" style={inputStyle} />
            {imageUrl && (
              <img src={imageUrl} alt="Preview" className="mt-2 w-full h-32 object-cover rounded" style={{ border: "1px solid var(--fio)" }}
                onError={(e) => (e.currentTarget.style.display = "none")} />
            )}
          </div>

          {/* Author */}
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "var(--ink-secondary)" }}>Autor</label>
            <select value={author} onChange={(e) => setAuthor(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm focus:outline-none" style={inputStyle}>
              {AUTHORS.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "var(--ink-secondary)" }}>Status</label>
            <div className="flex gap-3">
              <button onClick={() => setStatus("draft")}
                className="flex-1 px-3 py-2 text-sm font-medium transition-colors"
                style={{
                  borderRadius: "2px", border: "1px solid var(--fio)",
                  background: status === "draft" ? "var(--blue-pen)" : "var(--paper-white)",
                  color: status === "draft" ? "white" : "var(--ink-secondary)",
                }}>
                Rascunho
              </button>
              <button onClick={() => setStatus("publish")}
                className="flex-1 px-3 py-2 text-sm font-medium transition-colors"
                style={{
                  borderRadius: "2px", border: "1px solid var(--fio)",
                  background: status === "publish" ? "var(--serra-green)" : "var(--paper-white)",
                  color: status === "publish" ? "white" : "var(--ink-secondary)",
                }}>
                Publicar
              </button>
            </div>
          </div>

          {/* Result message */}
          {result && (
            <div className="p-3 text-sm rounded" style={{
              background: result.success ? "#e8f5e9" : "#ffebee",
              color: result.success ? "#2e7d32" : "#c62828",
            }}>
              {result.success ? (
                <div>
                  <p className="font-medium mb-1">
                    {result.status === "draft" ? "Rascunho criado!" : "Publicado com sucesso!"}
                  </p>
                  <div className="flex gap-3">
                    <a href={result.editLink || result.link} target="_blank" rel="noopener noreferrer" className="underline">
                      Editar no WP Admin
                    </a>
                    {result.status === "publish" && result.link && (
                      <a href={result.link} target="_blank" rel="noopener noreferrer" className="underline">
                        Ver no portal
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <>Erro: {result.error}</>
              )}
            </div>
          )}

          {/* Submit */}
          <button onClick={handlePublish} disabled={publishing}
            className="w-full py-3 text-sm font-bold uppercase tracking-wider transition-colors"
            style={{
              borderRadius: "2px",
              background: publishing ? "var(--ink-tertiary)" : "var(--editorial-red)",
              color: "white",
              border: "none",
              cursor: publishing ? "wait" : "pointer",
            }}>
            {publishing ? "Publicando..." : `Enviar como ${status === "draft" ? "rascunho" : "publicado"}`}
          </button>

          {/* Source link */}
          <p className="text-xs text-center" style={{ color: "var(--ink-tertiary)" }}>
            Fonte: <a href={article.url} target="_blank" rel="noopener noreferrer" className="underline">{article.url.substring(0, 60)}...</a>
          </p>
        </div>
      </div>
    </div>
  );
}
