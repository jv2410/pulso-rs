"use client";

import { useEffect, useState, useMemo } from "react";

interface Municipality {
  name: string;
  association: string;
  siteUrl: string;
  category: string;
  status: string;
  articleCount: number;
}

type SortField = "name" | "articleCount" | "association";
type SortDir = "asc" | "desc";

export default function MunicipiosPage() {
  const [data, setData] = useState<Municipality[] | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("articleCount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    fetch("/data/municipalities.json")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const result = data.filter(
      (m) =>
        !search ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.association.toLowerCase().includes(search.toLowerCase()) ||
        m.siteUrl.toLowerCase().includes(search.toLowerCase())
    );
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "association")
        cmp = a.association.localeCompare(b.association);
      else cmp = a.articleCount - b.articleCount;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [data, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

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

  const okCount = data.filter((m) => m.status === "ok").length;
  const failedCount = data.filter((m) => m.status === "failed").length;

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1
          className="font-editorial text-3xl font-bold mb-1"
          style={{ color: "var(--ink)" }}
        >
          Mapa de Cobertura
        </h1>
        <p style={{ color: "var(--ink-secondary)" }}>
          Status de monitoramento dos 497 municípios do RS
        </p>
      </div>
      <div
        className="h-px mb-6"
        style={{ background: "var(--fio)" }}
      />

      {/* Summary */}
      <p
        className="text-sm mb-6"
        style={{ color: "var(--ink-secondary)" }}
      >
        {data.length} municípios &middot;{" "}
        <span style={{ color: "var(--serra-green)" }} className="font-medium">
          {okCount} monitorados
        </span>{" "}
        &middot;{" "}
        <span style={{ color: "var(--ink-tertiary)" }} className="font-medium">
          {failedCount} pendentes
        </span>
      </p>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
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
            placeholder="Buscar município, associação ou site..."
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
      </div>

      <p
        className="text-sm mb-4"
        style={{ color: "var(--ink-secondary)" }}
      >
        <span className="font-semibold" style={{ color: "var(--ink)" }}>
          {filtered.length}
        </span>{" "}
        resultado(s)
      </p>

      {/* Table */}
      <div
        className="overflow-hidden"
        style={{
          border: "1px solid var(--fio)",
          borderRadius: "0",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--paper-dark)" }}>
                <th
                  className="text-left py-3 px-5 text-xs uppercase tracking-[0.1em] font-medium cursor-pointer select-none transition-colors"
                  style={{
                    color: "var(--ink-secondary)",
                    borderBottom: "1px solid var(--fio)",
                  }}
                  onClick={() => toggleSort("name")}
                >
                  Município{sortIcon("name")}
                </th>
                <th
                  className="text-left py-3 px-5 text-xs uppercase tracking-[0.1em] font-medium cursor-pointer select-none transition-colors"
                  style={{
                    color: "var(--ink-secondary)",
                    borderBottom: "1px solid var(--fio)",
                  }}
                  onClick={() => toggleSort("association")}
                >
                  Associação{sortIcon("association")}
                </th>
                <th
                  className="text-left py-3 px-5 text-xs uppercase tracking-[0.1em] font-medium"
                  style={{
                    color: "var(--ink-secondary)",
                    borderBottom: "1px solid var(--fio)",
                  }}
                >
                  Site
                </th>
                <th
                  className="text-left py-3 px-5 text-xs uppercase tracking-[0.1em] font-medium"
                  style={{
                    color: "var(--ink-secondary)",
                    borderBottom: "1px solid var(--fio)",
                  }}
                >
                  Categoria
                </th>
                <th
                  className="text-center py-3 px-5 text-xs uppercase tracking-[0.1em] font-medium"
                  style={{
                    color: "var(--ink-secondary)",
                    borderBottom: "1px solid var(--fio)",
                  }}
                >
                  Status
                </th>
                <th
                  className="text-right py-3 px-5 text-xs uppercase tracking-[0.1em] font-medium cursor-pointer select-none transition-colors"
                  style={{
                    color: "var(--ink-secondary)",
                    borderBottom: "1px solid var(--fio)",
                  }}
                  onClick={() => toggleSort("articleCount")}
                >
                  Artigos{sortIcon("articleCount")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr
                  key={m.name}
                  className="transition-colors"
                  style={{
                    background:
                      i % 2 === 0
                        ? "var(--paper-white)"
                        : "transparent",
                    borderBottom: "1px solid var(--fio)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--paper-dark)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      i % 2 === 0 ? "var(--paper-white)" : "transparent")
                  }
                >
                  <td
                    className="py-3 px-5 font-semibold"
                    style={{ color: "var(--ink)" }}
                  >
                    {m.name}
                  </td>
                  <td
                    className="py-3 px-5"
                    style={{ color: "var(--ink-secondary)" }}
                  >
                    {m.association}
                  </td>
                  <td className="py-3 px-5">
                    <a
                      href={`https://${m.siteUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs transition-colors hover:underline"
                      style={{ color: "var(--blue-pen)" }}
                    >
                      {m.siteUrl}
                    </a>
                  </td>
                  <td className="py-3 px-5">
                    <span
                      className="text-xs"
                      style={{ color: "var(--ink-secondary)" }}
                    >
                      {m.category}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-center">
                    {m.status === "ok" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span
                          className="w-1.5 h-1.5 rounded-full inline-block"
                          style={{ background: "var(--serra-green)" }}
                        />
                        <span style={{ color: "var(--serra-green)" }}>
                          Monitorado
                        </span>
                      </span>
                    ) : (
                      <span
                        className="text-xs"
                        style={{ color: "var(--ink-tertiary)" }}
                      >
                        Pendente
                      </span>
                    )}
                  </td>
                  <td
                    className="py-3 px-5 text-right font-semibold"
                    style={{ color: "var(--ink)" }}
                  >
                    {m.articleCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
