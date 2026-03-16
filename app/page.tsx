"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StatsData {
  daily: { date: string; articles: number; municipalities: number }[];
  totals: {
    totalArticles: number;
    totalMunicipalities: number;
    totalSites: number;
    coveragePercent: number;
  };
}

interface TodayData {
  date: string;
  totalArticles: number;
  totalMunicipalities: number;
  articles: {
    municipality: string;
    title: string;
    url: string;
    publishedAt: string;
    scrapedAt: string;
  }[];
}

function getEditionNumber(): number {
  return 8;
}

function getEditionDate(): string {
  const now = new Date();
  const day = now.getDate();
  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  return `Edição nº ${getEditionNumber()} • ${day} de ${month} de ${year}`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [today, setToday] = useState<TodayData | null>(null);

  useEffect(() => {
    fetch("/data/stats.json")
      .then((r) => r.json())
      .then(setStats);
    fetch("/data/today.json")
      .then((r) => r.json())
      .then(setToday);
  }, []);

  if (!stats || !today) {
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

  const last7 = stats.daily.slice(-7);
  const daysOfOperation = stats.daily.length;

  const keyNumbers = [
    { value: today.totalArticles, label: "notícias do dia" },
    { value: today.totalMunicipalities, label: "municípios ativos" },
    { value: `${stats.totals.coveragePercent}%`, label: "cobertura do RS" },
    { value: daysOfOperation, label: "edições" },
  ];

  const chartData = last7.map((d) => ({
    ...d,
    label: format(parseISO(d.date), "dd/MM", { locale: ptBR }),
  }));

  return (
    <div>
      {/* Edition header */}
      <div className="mb-8">
        <p
          className="font-editorial text-sm uppercase tracking-[0.15em]"
          style={{ color: "var(--ink-secondary)" }}
        >
          {getEditionDate()}
        </p>
      </div>

      {/* Key numbers infographic */}
      <div
        className="mb-12"
        style={{ border: "1px solid var(--fio)" }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4">
          {keyNumbers.map((item, i) => (
            <div
              key={item.label}
              className="py-6 px-4 text-center"
              style={{
                borderRight:
                  i < keyNumbers.length - 1
                    ? "1px solid var(--fio)"
                    : "none",
              }}
            >
              <p
                className="font-editorial text-4xl font-black"
                style={{ color: "var(--ink)" }}
              >
                {item.value}
              </p>
              <p
                className="text-xs uppercase tracking-[0.15em] mt-1"
                style={{ color: "var(--ink-secondary)" }}
              >
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Manchetes do Dia */}
      <div className="mb-12">
        <h2
          className="font-editorial text-2xl font-bold mb-2"
          style={{ color: "var(--ink)" }}
        >
          Manchetes do Dia
        </h2>
        <div
          className="h-px mb-6"
          style={{ background: "var(--fio)" }}
        />

        {/* First article - featured, full width */}
        {today.articles.length > 0 && (
          <a
            href={today.articles[0].url}
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-0 group"
          >
            <p
              className="text-xs uppercase tracking-[0.15em] mb-1"
              style={{ color: "var(--ink-secondary)" }}
            >
              {today.articles[0].municipality}
            </p>
            <h3
              className="font-editorial text-xl font-bold transition-colors leading-snug"
              style={{ color: "var(--ink)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--editorial-red)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--ink)")
              }
            >
              {today.articles[0].title}
            </h3>
          </a>
        )}

        <div
          className="h-px my-4"
          style={{ background: "var(--fio)" }}
        />

        {/* Remaining articles - 2 column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {today.articles.slice(1, 7).map((article, i) => (
            <div
              key={i}
              className="py-4"
              style={{
                borderBottom: "1px solid var(--fio)",
                paddingRight: i % 2 === 0 ? "16px" : "0",
                paddingLeft: i % 2 === 1 ? "16px" : "0",
                borderRight:
                  i % 2 === 0 ? "1px solid var(--fio)" : "none",
              }}
            >
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <p
                  className="text-xs uppercase tracking-[0.15em] mb-1"
                  style={{ color: "var(--ink-secondary)" }}
                >
                  {article.municipality}
                </p>
                <h3
                  className="font-editorial text-lg font-bold transition-colors leading-snug"
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
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-12">
        <div
          className="p-6"
          style={{
            background: "var(--paper-white)",
            border: "1px solid var(--fio)",
            borderRadius: "4px",
          }}
        >
          <h3
            className="font-editorial text-lg font-semibold mb-4"
            style={{ color: "var(--ink)" }}
          >
            Artigos por Dia
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--fio)" />
              <XAxis dataKey="label" stroke="var(--ink-tertiary)" fontSize={12} />
              <YAxis stroke="var(--ink-tertiary)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--paper-white)",
                  border: "1px solid var(--fio)",
                  borderRadius: "2px",
                  boxShadow: "none",
                }}
                labelStyle={{ color: "var(--ink)" }}
                itemStyle={{ color: "var(--blue-pen)" }}
              />
              <Bar
                dataKey="articles"
                fill="var(--blue-pen)"
                radius={[2, 2, 0, 0]}
                name="Artigos"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div
          className="p-6"
          style={{
            background: "var(--paper-white)",
            border: "1px solid var(--fio)",
            borderRadius: "4px",
          }}
        >
          <h3
            className="font-editorial text-lg font-semibold mb-4"
            style={{ color: "var(--ink)" }}
          >
            Municípios Cobertos por Dia
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--fio)" />
              <XAxis dataKey="label" stroke="var(--ink-tertiary)" fontSize={12} />
              <YAxis stroke="var(--ink-tertiary)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--paper-white)",
                  border: "1px solid var(--fio)",
                  borderRadius: "2px",
                  boxShadow: "none",
                }}
                labelStyle={{ color: "var(--ink)" }}
                itemStyle={{ color: "var(--serra-green)" }}
              />
              <Line
                type="monotone"
                dataKey="municipalities"
                stroke="var(--serra-green)"
                strokeWidth={2.5}
                dot={{ fill: "#3d6b4f", r: 4, strokeWidth: 0 }}
                name="Municípios"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Últimas Notícias */}
      <div className="mb-8">
        <h3
          className="font-editorial text-lg font-semibold mb-2"
          style={{ color: "var(--ink)" }}
        >
          Últimas Notícias
        </h3>
        <div
          className="h-px mb-4"
          style={{ background: "var(--fio)" }}
        />

        <div>
          {today.articles.slice(0, 10).map((article, i) => (
            <div
              key={i}
              className="flex items-start gap-3 py-3"
              style={{ borderBottom: "1px solid var(--fio)" }}
            >
              <span
                className="inline-block px-2 py-0.5 text-xs whitespace-nowrap mt-0.5"
                style={{
                  background: "var(--paper-dark)",
                  color: "var(--ink-secondary)",
                  borderRadius: "2px",
                }}
              >
                {article.municipality}
              </span>
              <div className="min-w-0 flex-1">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm transition-colors line-clamp-1"
                  style={{ color: "var(--ink)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "var(--blue-pen)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "var(--ink)")
                  }
                >
                  {article.title}
                </a>
              </div>
              <span
                className="text-xs whitespace-nowrap mt-0.5"
                style={{ color: "var(--ink-tertiary)" }}
              >
                {article.scrapedAt
                  ? format(parseISO(article.scrapedAt), "HH:mm")
                  : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
