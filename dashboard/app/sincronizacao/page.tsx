"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SyncStatus {
  lastInsertAt: string | null;
  nextSyncAt: string;
  serverNow: string;
  latestDate: string;
  today: number;
  daily: { date: string; articles: number; municipalities: number }[];
  cobertura: { dias: number; municipios: number }[];
  totalMunicipios: number;
  schedule: string[];
}

function humanDelta(fromISO: string, toISO: string): string {
  const ms = new Date(toISO).getTime() - new Date(fromISO).getTime();
  const abs = Math.abs(ms);
  const min = Math.round(abs / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  if (h < 24) return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export default function SincronizacaoPage() {
  const [s, setS] = useState<SyncStatus | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/sync-status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setS(d)))
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="py-20 text-center" style={{ color: "var(--editorial-red)" }}>Erro: {err}</div>;
  if (!s) return <div className="py-20 text-center font-editorial" style={{ color: "var(--ink-tertiary)" }}>Carregando…</div>;

  const maxDaily = Math.max(...s.daily.map((d) => d.articles), 1);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-editorial text-3xl font-bold mb-1" style={{ color: "var(--ink)" }}>
          Sincronização
        </h1>
        <p style={{ color: "var(--ink-secondary)" }}>
          Status da coleta automática de notícias das prefeituras
        </p>
      </div>
      <div className="h-px mb-8" style={{ background: "var(--fio)" }} />

      {/* Cards: última e próxima sync */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div className="p-6" style={{ border: "1px solid var(--fio)" }}>
          <p className="text-xs uppercase tracking-[0.15em] mb-2" style={{ color: "var(--ink-secondary)" }}>
            Última sincronização
          </p>
          {s.lastInsertAt ? (
            <>
              <p className="font-editorial text-3xl font-black" style={{ color: "var(--ink)" }}>
                há {humanDelta(s.lastInsertAt, s.serverNow)}
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--ink-secondary)" }}>
                {format(new Date(s.lastInsertAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </p>
            </>
          ) : (
            <p className="font-editorial text-2xl" style={{ color: "var(--ink-tertiary)" }}>—</p>
          )}
        </div>

        <div className="p-6" style={{ border: "1px solid var(--fio)" }}>
          <p className="text-xs uppercase tracking-[0.15em] mb-2" style={{ color: "var(--ink-secondary)" }}>
            Próxima sincronização
          </p>
          <p className="font-editorial text-3xl font-black" style={{ color: "var(--editorial-red)" }}>
            em {humanDelta(s.serverNow, s.nextSyncAt)}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--ink-secondary)" }}>
            {format(new Date(s.nextSyncAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Agenda + volume de hoje */}
      <div className="mb-10 p-5" style={{ borderLeft: "3px solid var(--editorial-red)", background: "var(--editorial-red-soft)" }}>
        <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
          A coleta roda automaticamente <span className="font-semibold">2x por dia</span>, às{" "}
          <span className="font-semibold">{s.schedule.join(" e ")}</span>. Hoje ({format(new Date(s.latestDate + "T12:00:00Z"), "dd/MM", { locale: ptBR })}) foram coletadas{" "}
          <span className="font-semibold" style={{ color: "var(--editorial-red)" }}>{s.today} notícias</span> até agora.
        </p>
      </div>

      {/* Municípios distintos com notícia — 30 / 60 / 90 dias */}
      <p className="text-xs uppercase tracking-[0.15em] mb-3" style={{ color: "var(--ink-secondary)" }}>
        Municípios com notícia (distintos, sem repetir)
      </p>
      <div className="mb-8 grid grid-cols-3" style={{ border: "1px solid var(--fio)" }}>
        {s.cobertura.map((c, i) => (
          <div key={c.dias} className="py-6 px-4 text-center"
            style={{ borderRight: i < s.cobertura.length - 1 ? "1px solid var(--fio)" : "none" }}>
            <p className="font-editorial text-4xl font-black" style={{ color: "var(--ink)" }}>
              {c.municipios}
              <span className="text-xl font-normal" style={{ color: "var(--ink-tertiary)" }}> / {s.totalMunicipios}</span>
            </p>
            <p className="text-sm font-semibold mt-1" style={{ color: "var(--editorial-red)" }}>
              {Math.round((c.municipios / s.totalMunicipios) * 100)}%
            </p>
            <p className="text-xs uppercase tracking-[0.1em] mt-1" style={{ color: "var(--ink-secondary)" }}>
              últimos {c.dias} dias
            </p>
          </div>
        ))}
      </div>

      {/* Volume últimos 7 dias */}
      <h3 className="font-editorial text-lg font-semibold mb-4" style={{ color: "var(--ink)" }}>
        Volume dos últimos 7 dias
      </h3>
      <div className="space-y-2">
        {s.daily.map((d) => (
          <div key={d.date} className="flex items-center gap-3">
            <span className="text-xs w-16 shrink-0" style={{ color: "var(--ink-secondary)" }}>
              {format(new Date(d.date + "T12:00:00Z"), "dd/MM", { locale: ptBR })}
            </span>
            <div className="flex-1 h-6" style={{ background: "var(--fio)" }}>
              <div className="h-6 flex items-center justify-end px-2"
                style={{ width: `${Math.max((d.articles / maxDaily) * 100, 6)}%`, background: "var(--blue-pen)" }}>
                <span className="text-xs font-semibold" style={{ color: "white" }}>{d.articles}</span>
              </div>
            </div>
            <span className="text-xs w-24 shrink-0 text-right" style={{ color: "var(--ink-tertiary)" }}>
              {d.municipalities} municípios
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
