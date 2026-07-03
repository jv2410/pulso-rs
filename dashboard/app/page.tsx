"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "../lib/supabase";

interface DailyStats {
  date: string;
  articles: number;
  municipalities: number;
  label: string;
}

interface TodayArticle {
  title: string;
  url: string;
  municipality: string;
  summary: string | null;
  category: string | null;
}

export default function DashboardPage() {
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [todayArticles, setTodayArticles] = useState<TodayArticle[]>([]);
  const [todayDate, setTodayDate] = useState("");
  const [todayCount, setTodayCount] = useState(0);
  const [todayMunis, setTodayMunis] = useState(0);
  const [totalMunicipalities, setTotalMunicipalities] = useState(497);
  const [coveragePercent, setCoveragePercent] = useState(0);
  const [daysOfOperation, setDaysOfOperation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // Indicadores + evolução: API server-side (/api/stats) computa tudo direto
        // do banco, sempre atualizado. Substitui as queries anteriores que usavam
        // .order(ascending).limit(2000) e pegavam os artigos MAIS ANTIGOS (desde
        // 1969), mostrando evolução velha e cobertura enviesada.
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (!res.ok) throw new Error("Falha ao carregar estatísticas");
        const s = await res.json();
        if (s.error) throw new Error(s.error);

        const latestDate = s.latestDate;
        setTodayDate(latestDate);
        setTodayCount(s.today.articles);
        setTodayMunis(s.today.municipalities);
        setTotalMunicipalities(s.coverage.total);
        setCoveragePercent(s.coverage.percent);
        setDaysOfOperation(s.edicoes);
        setDailyStats(
          (s.daily as { date: string; articles: number; municipalities: number }[]).map((d) => ({
            ...d,
            label: format(new Date(d.date + "T12:00:00Z"), "dd/MM", { locale: ptBR }),
          }))
        );

        // Manchetes do dia (leitura anônima; RLS permite SELECT)
        const { data: todayData } = await supabase
          .from("articles")
          .select("title, url, summary, category, municipalities(name)")
          .gte("published_at", latestDate + "T00:00:00")
          .lte("published_at", latestDate + "T23:59:59")
          .order("published_at", { ascending: false })
          .limit(10);
        if (todayData) {
          setTodayArticles(todayData.map((a: any) => ({
            ...a, municipality: a.municipalities?.name || "",
          })));
        }
      } catch (err: any) {
        setError(err.message || "Erro ao carregar");
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg font-editorial" style={{ color: "var(--ink-tertiary)" }}>
          Carregando dados...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg" style={{ color: "var(--editorial-red)" }}>
          Erro: {error}
        </div>
      </div>
    );
  }

  const keyNumbers = [
    { value: todayCount, label: "notícias do dia" },
    { value: todayMunis, label: "municípios ativos" },
    { value: `${coveragePercent}%`, label: "cobertura do RS" },
    { value: daysOfOperation, label: "edições" },
  ];

  function getEditionDate(): string {
    if (!todayDate) return "";
    const d = new Date(todayDate + "T12:00:00Z");
    const months = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    return `Edição nº ${daysOfOperation} • ${d.getUTCDate()} de ${months[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
  }

  return (
    <div>
      <div className="mb-8">
        <p className="font-editorial text-sm uppercase tracking-[0.15em]" style={{ color: "var(--ink-secondary)" }}>
          {getEditionDate()}
        </p>
      </div>

      <div className="mb-12" style={{ border: "1px solid var(--fio)" }}>
        <div className="grid grid-cols-2 md:grid-cols-4">
          {keyNumbers.map((item, i) => (
            <div key={item.label} className="py-6 px-4 text-center"
              style={{ borderRight: i < keyNumbers.length - 1 ? "1px solid var(--fio)" : "none" }}>
              <p className="font-editorial text-4xl font-black" style={{ color: "var(--ink)" }}>{item.value}</p>
              <p className="text-xs uppercase tracking-[0.15em] mt-1" style={{ color: "var(--ink-secondary)" }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-12">
        <h2 className="font-editorial text-2xl font-bold mb-2" style={{ color: "var(--ink)" }}>Manchetes do Dia</h2>
        <div className="h-px mb-6" style={{ background: "var(--fio)" }} />

        {todayArticles.length > 0 && (
          <a href={todayArticles[0].url} target="_blank" rel="noopener noreferrer" className="block mb-0 group">
            <p className="text-xs uppercase tracking-[0.15em] mb-1" style={{ color: "var(--ink-secondary)" }}>
              {todayArticles[0].municipality}
              {todayArticles[0].category && (
                <span className="ml-2 px-1.5 py-0.5 normal-case" style={{ background: "var(--paper-dark)", borderRadius: "2px" }}>
                  {todayArticles[0].category}
                </span>
              )}
            </p>
            <h3 className="font-editorial text-xl font-bold transition-colors leading-snug" style={{ color: "var(--ink)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--editorial-red)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink)")}>
              {todayArticles[0].title}
            </h3>
            {todayArticles[0].summary && (
              <p className="text-sm mt-1" style={{ color: "var(--ink-secondary)" }}>{todayArticles[0].summary}</p>
            )}
          </a>
        )}

        <div className="h-px my-4" style={{ background: "var(--fio)" }} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {todayArticles.slice(1, 7).map((article, i) => (
            <div key={i} className="py-4" style={{
              borderBottom: "1px solid var(--fio)",
              paddingRight: i % 2 === 0 ? "16px" : "0",
              paddingLeft: i % 2 === 1 ? "16px" : "0",
              borderRight: i % 2 === 0 ? "1px solid var(--fio)" : "none",
            }}>
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="block group">
                <p className="text-xs uppercase tracking-[0.15em] mb-1" style={{ color: "var(--ink-secondary)" }}>
                  {article.municipality}
                  {article.category && (
                    <span className="ml-2 px-1.5 py-0.5 normal-case" style={{ background: "var(--paper-dark)", borderRadius: "2px" }}>
                      {article.category}
                    </span>
                  )}
                </p>
                <h3 className="font-editorial text-lg font-bold transition-colors leading-snug" style={{ color: "var(--ink)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--editorial-red)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink)")}>
                  {article.title}
                </h3>
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-12">
        <div className="p-6" style={{ background: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "4px" }}>
          <h3 className="font-editorial text-lg font-semibold mb-4" style={{ color: "var(--ink)" }}>Artigos por Dia</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--fio)" />
              <XAxis dataKey="label" stroke="var(--ink-tertiary)" fontSize={12} />
              <YAxis stroke="var(--ink-tertiary)" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "2px", boxShadow: "none" }}
                labelStyle={{ color: "var(--ink)" }} itemStyle={{ color: "var(--blue-pen)" }} />
              <Bar dataKey="articles" fill="var(--blue-pen)" radius={[2, 2, 0, 0]} name="Artigos" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="p-6" style={{ background: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "4px" }}>
          <h3 className="font-editorial text-lg font-semibold mb-4" style={{ color: "var(--ink)" }}>Municípios Cobertos por Dia</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--fio)" />
              <XAxis dataKey="label" stroke="var(--ink-tertiary)" fontSize={12} />
              <YAxis stroke="var(--ink-tertiary)" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "2px", boxShadow: "none" }}
                labelStyle={{ color: "var(--ink)" }} itemStyle={{ color: "var(--serra-green)" }} />
              <Line type="monotone" dataKey="municipalities" stroke="var(--serra-green)" strokeWidth={2.5}
                dot={{ fill: "#3d6b4f", r: 4, strokeWidth: 0 }} name="Municípios" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
