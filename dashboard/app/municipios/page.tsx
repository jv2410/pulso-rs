"use client";

import { useEffect, useState, useMemo } from "react";

interface StaticMuni {
  name: string;
  association: string;
  siteUrl: string;
  category: string;
  status: string;
}
interface LiveMuni {
  name: string;
  total: number; // notícias captadas desde o início (exclui inválidas)
  lastDate: string | null; // última captação (YYYY-MM-DD)
  last30: number; // captadas nos últimos 30 dias
}
interface Row extends LiveMuni {
  association: string;
  siteUrl: string;
  category: string;
}

type SortField = "name" | "total" | "association" | "lastDate";
type SortDir = "asc" | "desc";

const norm = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T12:00:00Z").getTime();
  return Math.floor((Date.now() - d) / 86400000);
}

export default function MunicipiosPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [resumo, setResumo] = useState<{ totalCidades: number; comNoticia: number; totalArtigos: number } | null>(null);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    Promise.all([
      fetch("/data/municipalities.json").then((r) => r.json()).catch(() => []),
      fetch("/api/cidades", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([estaticos, live]) => {
        if (live.error) { setErr(live.error); return; }
        const meta: Record<string, StaticMuni> = {};
        (estaticos as StaticMuni[]).forEach((m) => (meta[norm(m.name)] = m));
        const merged: Row[] = (live.cidades as LiveMuni[]).map((c) => {
          const m = meta[norm(c.name)] || ({} as StaticMuni);
          return {
            ...c,
            association: m.association || "—",
            siteUrl: m.siteUrl || "",
            category: m.category || "—",
          };
        });
        setRows(merged);
        setResumo(live.resumo);
      })
      .catch((e) => setErr(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const result = rows.filter(
      (m) =>
        !search ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.association.toLowerCase().includes(search.toLowerCase()) ||
        m.siteUrl.toLowerCase().includes(search.toLowerCase())
    );
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "association") cmp = a.association.localeCompare(b.association);
      else if (sortField === "lastDate") cmp = (a.lastDate || "").localeCompare(b.lastDate || "");
      else cmp = a.total - b.total;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [rows, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir(field === "name" || field === "association" ? "asc" : "desc"); }
  };
  const sortIcon = (field: SortField) => (sortField !== field ? "" : sortDir === "asc" ? " ↑" : " ↓");

  if (err) return <div className="py-20 text-center" style={{ color: "var(--editorial-red)" }}>Erro: {err}</div>;
  if (!rows) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg font-editorial" style={{ color: "var(--ink-tertiary)" }}>Carregando dados ao vivo…</div>
      </div>
    );
  }

  const ativos30 = rows.filter((m) => m.last30 > 0).length;

  // cor/rótulo da recência
  const recencia = (lastDate: string | null) => {
    const ds = daysSince(lastDate);
    if (ds === null) return { cor: "var(--ink-tertiary)", txt: "nunca" };
    if (ds <= 3) return { cor: "var(--serra-green)", txt: `há ${ds}d` };
    if (ds <= 14) return { cor: "var(--blue-pen)", txt: `há ${ds}d` };
    return { cor: "var(--editorial-red)", txt: `há ${ds}d` };
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-editorial text-3xl font-bold mb-1" style={{ color: "var(--ink)" }}>Cobertura por município</h1>
        <p style={{ color: "var(--ink-secondary)" }}>Notícias captadas desde o início e última captação — 497 municípios do RS</p>
      </div>
      <div className="h-px mb-6" style={{ background: "var(--fio)" }} />

      {resumo && (
        <p className="text-sm mb-6" style={{ color: "var(--ink-secondary)" }}>
          <span className="font-semibold" style={{ color: "var(--ink)" }}>{resumo.totalArtigos.toLocaleString("pt-BR")}</span> notícias no total &middot;{" "}
          <span className="font-medium" style={{ color: "var(--serra-green)" }}>{resumo.comNoticia}</span> cidades com histórico &middot;{" "}
          <span className="font-medium" style={{ color: "var(--blue-pen)" }}>{ativos30}</span> ativas nos últimos 30 dias
        </p>
      )}

      {/* Busca */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar município, associação ou site…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 text-sm focus:outline-none"
          style={{ background: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "2px", color: "var(--ink)" }}
        />
      </div>

      <p className="text-sm mb-4" style={{ color: "var(--ink-secondary)" }}>
        <span className="font-semibold" style={{ color: "var(--ink)" }}>{filtered.length}</span> resultado(s)
      </p>

      <div className="overflow-hidden" style={{ border: "1px solid var(--fio)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--paper-dark)" }}>
                <th className="text-left py-3 px-5 text-xs uppercase tracking-[0.1em] font-medium cursor-pointer select-none" style={{ color: "var(--ink-secondary)", borderBottom: "1px solid var(--fio)" }} onClick={() => toggleSort("name")}>Município{sortIcon("name")}</th>
                <th className="text-left py-3 px-5 text-xs uppercase tracking-[0.1em] font-medium cursor-pointer select-none" style={{ color: "var(--ink-secondary)", borderBottom: "1px solid var(--fio)" }} onClick={() => toggleSort("association")}>Associação{sortIcon("association")}</th>
                <th className="text-right py-3 px-5 text-xs uppercase tracking-[0.1em] font-medium cursor-pointer select-none" style={{ color: "var(--ink-secondary)", borderBottom: "1px solid var(--fio)" }} onClick={() => toggleSort("total")}>Notícias (total){sortIcon("total")}</th>
                <th className="text-right py-3 px-5 text-xs uppercase tracking-[0.1em] font-medium" style={{ color: "var(--ink-secondary)", borderBottom: "1px solid var(--fio)" }}>Últimos 30d</th>
                <th className="text-right py-3 px-5 text-xs uppercase tracking-[0.1em] font-medium cursor-pointer select-none" style={{ color: "var(--ink-secondary)", borderBottom: "1px solid var(--fio)" }} onClick={() => toggleSort("lastDate")}>Última captação{sortIcon("lastDate")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => {
                const rec = recencia(m.lastDate);
                return (
                  <tr key={m.name} style={{ background: i % 2 === 0 ? "var(--paper-white)" : "transparent", borderBottom: "1px solid var(--fio)" }}>
                    <td className="py-3 px-5 font-semibold" style={{ color: "var(--ink)" }}>
                      {m.name}
                      {m.siteUrl && (
                        <a href={`https://${m.siteUrl}`} target="_blank" rel="noopener noreferrer" className="block text-xs font-normal hover:underline" style={{ color: "var(--blue-pen)" }}>{m.siteUrl}</a>
                      )}
                    </td>
                    <td className="py-3 px-5" style={{ color: "var(--ink-secondary)" }}>{m.association}</td>
                    <td className="py-3 px-5 text-right font-semibold" style={{ color: "var(--ink)" }}>{m.total.toLocaleString("pt-BR")}</td>
                    <td className="py-3 px-5 text-right" style={{ color: m.last30 > 0 ? "var(--ink)" : "var(--ink-tertiary)" }}>{m.last30}</td>
                    <td className="py-3 px-5 text-right">
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: rec.cor }} />
                        <span style={{ color: "var(--ink)" }}>{m.lastDate || "—"}</span>
                        <span className="text-xs" style={{ color: rec.cor }}>{rec.txt}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
