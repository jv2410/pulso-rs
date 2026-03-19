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
  const [totalMunicipalities, setTotalMunicipalities] = useState(0);
  const [coveragePercent, setCoveragePercent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Get total municipalities
      const { count: totalMuni } = await supabase
        .from("municipalities")
        .select("id", { count: "exact", head: true });
      setTotalMunicipalities(totalMuni || 0);

      // Get distinct municipalities with articles
      const { data: activeMunis } = await supabase
        .from("articles")
        .select("municipality_id")
        .not("published_at", "is", null);
      const uniqueActive = new Set(activeMunis?.map((a) => a.municipality_id));
      setCoveragePercent(
        totalMuni ? Math.round((uniqueActive.size / totalMuni) * 1000) / 10 : 0
      );

      // Get daily stats
      const { data: allArticles } = await supabase
        .from("articles")
        .select("published_at, municipality_id")
        .not("published_at", "is", null)
        .order("published_at", { ascending: true });

      if (allArticles) {
        const byDate: Record<string, { articles: number; munis: Set<number> }> = {};
        for (const a of allArticles) {
          const d = a.published_at!.split("T")[0];
          if (!byDate[d]) byDate[d] = { articles: 0, munis: new Set() };
          byDate[d].articles++;
          byDate[d].munis.add(a.municipality_id);
        }
        const stats = Object.entries(byDate).map(([date, v]) => ({
          date,
          articles: v.articles,
          municipalities: v.munis.size,
          label: format(new Date(date + "T12:00:00Z"), "dd/MM", { locale: ptBR }),
        }));
        setDailyStats(stats.slice(-7));

        // Latest date with articles
        const latestDate = stats.length > 0 ? stats[stats.length - 1].date : "";
        setTodayDate(latestDate);

        // Fetch today's articles
        if (latestDate) {
          const { data: todayData } = await supabase
            .from("articles")
            .select("title, url, summary, category, municipalities(name)")
            .gte("published_at", latestDate + "T00:00:00Z")
            .lte("published_at", latestDate + "T23:59:59Z")
            .neq("category", "Crise")
            .order("published_at", { ascending: false })
            .limit(10);

          if (todayData) {
            setTodayArticles(
              todayData.map((a: any) => ({
                ...a,
                municipality: a.municipalities?.name || "",
              }))
            );
          }
        }
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

  const todayStats = dailyStats.length > 0 ? dailyStats[dailyStats.length - 1] : null;
  const daysOfOperation = dailyStats.length;

  const keyNumbers = [
    { value: todayStats?.articles || 0, label: "notícias do dia" },
    { value: todayStats?.municipalities || 0, label: "municípios ativos" },
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

      {/* Key numbers */}
      <div className="mb-12" style={{ border: "1px solid var(--fio)" }}>
        <div className="grid grid-cols-2 md:grid-cols-4">
          {keyNumbers.map((item, i) => (
            <div
              key={item.label}
              className="py-6 px-4 text-center"
              style={{ borderRight: i < keyNumbers.length - 1 ? "1px solid var(--fio)" : "none" }}
            >
              <p className="font-editorial text-4xl font-black" style={{ color: "var(--ink)" }}>
                {item.value}
              </p>
              <p className="text-xs uppercase tracking-[0.15em] mt-1" style={{ color: "var(--ink-secondary)" }}>
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Manchetes do Dia */}
      <div className="mb-12">
        <h2 className="font-editorial text-2xl font-bold mb-2" style={{ color: "var(--ink)" }}>
          Manchetes do Dia
        </h2>
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
            <h3
              className="font-editorial text-xl font-bold transition-colors leading-snug"
              style={{ color: "var(--ink)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--editorial-red)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink)")}
            >
              {todayArticles[0].title}
            </h3>
            {todayArticles[0].summary && (
              <p className="text-sm mt-1" style={{ color: "var(--ink-secondary)" }}>
                {todayArticles[0].summary}
              </p>
            )}
          </a>
        )}

        <div className="h-px my-4" style={{ background: "var(--fio)" }} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {todayArticles.slice(1, 7).map((article, i) => (
            <div
              key={i}
              className="py-4"
              style={{
                borderBottom: "1px solid var(--fio)",
                paddingRight: i % 2 === 0 ? "16px" : "0",
                paddingLeft: i % 2 === 1 ? "16px" : "0",
                borderRight: i % 2 === 0 ? "1px solid var(--fio)" : "none",
              }}
            >
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="block group">
                <p className="text-xs uppercase tracking-[0.15em] mb-1" style={{ color: "var(--ink-secondary)" }}>
                  {article.municipality}
                  {article.category && (
                    <span className="ml-2 px-1.5 py-0.5 normal-case" style={{ background: "var(--paper-dark)", borderRadius: "2px" }}>
                      {article.category}
                    </span>
                  )}
                </p>
                <h3
                  className="font-editorial text-lg font-bold transition-colors leading-snug"
                  style={{ color: "var(--ink)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--editorial-red)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink)")}
                >
                  {article.title}
                </h3>
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-12">
        <div className="p-6" style={{ background: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "4px" }}>
          <h3 className="font-editorial text-lg font-semibold mb-4" style={{ color: "var(--ink)" }}>
            Artigos por Dia
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--fio)" />
              <XAxis dataKey="label" stroke="var(--ink-tertiary)" fontSize={12} />
              <YAxis stroke="var(--ink-tertiary)" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "2px", boxShadow: "none" }}
                labelStyle={{ color: "var(--ink)" }}
                itemStyle={{ color: "var(--blue-pen)" }}
              />
              <Bar dataKey="articles" fill="var(--blue-pen)" radius={[2, 2, 0, 0]} name="Artigos" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="p-6" style={{ background: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "4px" }}>
          <h3 className="font-editorial text-lg font-semibold mb-4" style={{ color: "var(--ink)" }}>
            Municípios Cobertos por Dia
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--fio)" />
              <XAxis dataKey="label" stroke="var(--ink-tertiary)" fontSize={12} />
              <YAxis stroke="var(--ink-tertiary)" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--paper-white)", border: "1px solid var(--fio)", borderRadius: "2px", boxShadow: "none" }}
                labelStyle={{ color: "var(--ink)" }}
                itemStyle={{ color: "var(--serra-green)" }}
              />
              <Line type="monotone" dataKey="municipalities" stroke="var(--serra-green)" strokeWidth={2.5} dot={{ fill: "#3d6b4f", r: 4, strokeWidth: 0 }} name="Municípios" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
