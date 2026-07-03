import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// API de estatísticas do dashboard (Atlas 2026-07-03). Computa tudo no servidor,
// direto do banco, sempre atualizado. Substitui: (1) as queries da capa que
// usavam .order(ascending).limit(2000) — pegavam os artigos MAIS ANTIGOS (desde
// 1969); (2) o public/data/stats.json estático, congelado em março.
export const dynamic = "force-dynamic";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://kkuxgyjecjlfgahhoipv.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdXhneWplY2psZmdhaGhvaXB2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTE1MDU1OCwiZXhwIjoyMDU2NzI2NTU4fQ.L5Oim4rS-ERTNrS8svfKRrQwnEpwhDiECF4IQjYssqk";
const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const DAY = 86400000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export async function GET() {
  try {
    const hojeReal = ymd(new Date());
    const { data: latest } = await sb.from("articles")
      .select("published_at").not("published_at", "is", null)
      .lte("published_at", hojeReal + "T23:59:59")
      .order("published_at", { ascending: false }).limit(1).single();
    const latestDate = latest?.published_at?.slice(0, 10) || hojeReal;

    // UMA varredura de 2026: agrega por dia (artigos + municípios distintos)
    const byDate: Record<string, { articles: number; munis: Set<number> }> = {};
    for (let page = 0; ; page++) {
      const { data } = await sb.from("articles")
        .select("published_at, municipality_id")
        .gte("published_at", "2026-01-01T00:00:00")
        .lte("published_at", latestDate + "T23:59:59")
        .range(page * 1000, page * 1000 + 999);
      if (!data || !data.length) break;
      for (const a of data) {
        const d = a.published_at.slice(0, 10);
        (byDate[d] = byDate[d] || { articles: 0, munis: new Set() }).articles++;
        byDate[d].munis.add(a.municipality_id);
      }
      if (data.length < 1000) break;
    }

    // série completa (ordenada) + últimos 14 dias preenchidos
    const dailyFull = Object.keys(byDate).sort().map((d) => ({
      date: d, articles: byDate[d].articles, municipalities: byDate[d].munis.size,
    }));
    const daily = [];
    for (let i = 13; i >= 0; i--) {
      const d = ymd(new Date(Date.parse(latestDate + "T12:00:00Z") - i * DAY));
      const v = byDate[d];
      daily.push({ date: d, articles: v ? v.articles : 0, municipalities: v ? v.munis.size : 0 });
    }

    const hoje = byDate[latestDate] || { articles: 0, munis: new Set<number>() };

    // cobertura: municípios distintos nos últimos 90 dias. Janela de 90d (não 30d)
    // porque prefeituras pequenas publicam de forma esporádica (a cada 40-60 dias);
    // 30d as excluía injustamente. 90d reflete a base ativa real (~67%).
    const start30 = ymd(new Date(Date.parse(latestDate + "T12:00:00Z") - 89 * DAY));
    const munis30 = new Set<number>();
    for (const d of Object.keys(byDate)) if (d >= start30) byDate[d].munis.forEach((m) => munis30.add(m));

    const { count: totalMuni } = await sb.from("municipalities").select("id", { count: "exact", head: true });
    const { count: totalArticles } = await sb.from("articles").select("id", { count: "exact", head: true });

    const percent = totalMuni ? Math.round((munis30.size / totalMuni) * 1000) / 10 : 0;
    return NextResponse.json({
      latestDate,
      today: { articles: hoje.articles, municipalities: hoje.munis.size },
      coverage: { active: munis30.size, total: totalMuni || 497, percent },
      edicoes: dailyFull.length,
      daily,
      dailyFull,
      totals: {
        totalArticles: totalArticles || 0,
        totalMunicipalities: totalMuni || 497,
        totalSites: totalMuni || 497,
        coveragePercent: percent,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "erro" }, { status: 500 });
  }
}
