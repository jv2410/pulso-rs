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

export default function EstatisticasPage() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch("/data/stats.json")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  if (!stats) {
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

  const chartData = stats.daily.map((d) => ({
    ...d,
    label: format(parseISO(d.date), "dd/MM", { locale: ptBR }),
  }));

  const firstDay = stats.daily[0];
  const lastDay = stats.daily[stats.daily.length - 1];
  const articleGrowth =
    firstDay && firstDay.articles > 0
      ? Math.round(
          ((lastDay.articles - firstDay.articles) / firstDay.articles) * 100
        )
      : 0;

  const daysOfOperation = stats.daily.length;
  const firstDate = firstDay
    ? format(parseISO(firstDay.date), "d 'de' MMMM", { locale: ptBR })
    : "";

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1
          className="font-editorial text-3xl font-bold mb-1"
          style={{ color: "var(--ink)" }}
        >
          Indicadores de Cobertura
        </h1>
        <p style={{ color: "var(--ink-secondary)" }}>
          Acompanhe a evolução do monitoramento desde {firstDate}
        </p>
      </div>
      <div
        className="h-px mb-8"
        style={{ background: "var(--fio)" }}
      />

      {/* Editorial insight */}
      <div
        className="mb-8 p-5"
        style={{
          borderLeft: "3px solid var(--editorial-red)",
          background: "var(--editorial-red-soft)",
        }}
      >
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--ink)" }}
        >
          <span className="font-semibold">
            Em {daysOfOperation} dias de operação
          </span>
          , o Pulso RS coletou{" "}
          <span
            className="font-semibold"
            style={{ color: "var(--editorial-red)" }}
          >
            {stats.totals.totalArticles.toLocaleString("pt-BR")} notícias
          </span>{" "}
          de {stats.totals.totalMunicipalities} municípios gaúchos,
          monitorando {stats.totals.totalSites} sites de prefeituras.
          {articleGrowth > 0 && (
            <span>
              {" "}
              Nossa cobertura diária cresceu{" "}
              <span
                className="font-semibold"
                style={{ color: "var(--serra-green)" }}
              >
                +{articleGrowth}%
              </span>{" "}
              desde o início.
            </span>
          )}
        </p>
      </div>

      {/* Key numbers */}
      <div
        className="mb-10"
        style={{ border: "1px solid var(--fio)" }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4">
          {[
            {
              value: stats.totals.totalArticles.toLocaleString("pt-BR"),
              label: "total de artigos",
            },
            {
              value: stats.totals.totalMunicipalities.toString(),
              label: "municípios monitorados",
            },
            {
              value: stats.totals.totalSites.toString(),
              label: "sites monitorados",
            },
            {
              value: `${stats.totals.coveragePercent}%`,
              label: "cobertura",
            },
          ].map((item, i) => (
            <div
              key={item.label}
              className="py-5 px-4 text-center"
              style={{
                borderRight:
                  i < 3 ? "1px solid var(--fio)" : "none",
              }}
            >
              <p
                className="font-editorial text-3xl font-black"
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

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">
        <div
          className="p-6"
          style={{
            background: "var(--paper-white)",
            border: "1px solid var(--fio)",
            borderRadius: "4px",
          }}
        >
          <h3
            className="font-editorial text-lg font-semibold mb-1"
            style={{ color: "var(--ink)" }}
          >
            Artigos por Dia
          </h3>
          {articleGrowth !== 0 && (
            <p
              className="text-sm mb-4"
              style={{ color: "var(--ink-secondary)" }}
            >
              {articleGrowth > 0 ? (
                <span style={{ color: "var(--serra-green)" }} className="font-medium">
                  +{articleGrowth}%
                </span>
              ) : (
                <span style={{ color: "var(--editorial-red)" }} className="font-medium">
                  {articleGrowth}%
                </span>
              )}{" "}
              de variação desde o início
            </p>
          )}
          <ResponsiveContainer width="100%" height={300}>
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
            className="font-editorial text-lg font-semibold mb-1"
            style={{ color: "var(--ink)" }}
          >
            Municípios Cobertos por Dia
          </h3>
          <p
            className="text-sm mb-4"
            style={{ color: "var(--ink-secondary)" }}
          >
            <span style={{ color: "var(--serra-green)" }} className="font-medium">
              {stats.totals.totalMunicipalities}
            </span>{" "}
            municípios alcançados de 497 no total
          </p>
          <ResponsiveContainer width="100%" height={300}>
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

      {/* Data table */}
      <div
        className="overflow-hidden"
        style={{
          border: "1px solid var(--fio)",
          borderRadius: "0",
        }}
      >
        <div
          className="px-6 py-4"
          style={{ borderBottom: "1px solid var(--fio)" }}
        >
          <h3
            className="font-editorial text-lg font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Dados Diários
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--paper-dark)" }}>
                <th
                  className="text-left py-3 px-6 text-xs uppercase tracking-[0.1em] font-medium"
                  style={{ color: "var(--ink-secondary)", borderBottom: "1px solid var(--fio)" }}
                >
                  Data
                </th>
                <th
                  className="text-right py-3 px-6 text-xs uppercase tracking-[0.1em] font-medium"
                  style={{ color: "var(--ink-secondary)", borderBottom: "1px solid var(--fio)" }}
                >
                  Artigos
                </th>
                <th
                  className="text-right py-3 px-6 text-xs uppercase tracking-[0.1em] font-medium"
                  style={{ color: "var(--ink-secondary)", borderBottom: "1px solid var(--fio)" }}
                >
                  Municípios
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.daily
                .slice()
                .reverse()
                .map((row, i) => (
                  <tr
                    key={row.date}
                    className="transition-colors"
                    style={{
                      background:
                        i % 2 === 0
                          ? "var(--paper-white)"
                          : "var(--paper)",
                      borderBottom: "1px solid var(--fio)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--paper-dark)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        i % 2 === 0 ? "var(--paper-white)" : "var(--paper)")
                    }
                  >
                    <td
                      className="py-3 px-6"
                      style={{ color: "var(--ink)" }}
                    >
                      {format(parseISO(row.date), "dd/MM/yyyy (EEEE)", {
                        locale: ptBR,
                      })}
                    </td>
                    <td
                      className="py-3 px-6 text-right font-semibold"
                      style={{ color: "var(--blue-pen)" }}
                    >
                      {row.articles}
                    </td>
                    <td
                      className="py-3 px-6 text-right font-semibold"
                      style={{ color: "var(--serra-green)" }}
                    >
                      {row.municipalities}
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
