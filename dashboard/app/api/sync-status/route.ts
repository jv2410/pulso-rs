import { NextResponse } from "next/server";
import { admin } from "../../../lib/admin";

// Status de sincronização (Atlas 2026-07-06): a aba de Sincronização mostra
// quando rodou o último sync, quando roda o próximo (cron 07h/18h30 no Mac local)
// e o volume recente. O sync roda localmente (LaunchAgent), não no Vercel — por
// isso inferimos o "último sync" pelo created_at mais recente dos artigos.
export const dynamic = "force-dynamic";

const DAY = 86400000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

// horários do cron (America/Sao_Paulo = UTC-3): 07:00 e 18:30 local
const SYNC_HOURS_UTC = [10 * 60, 21 * 60 + 30]; // minutos UTC (07:00→10:00Z, 18:30→21:30Z)

export async function GET() {
  try {
    const now = new Date();

    // último sync ≈ created_at mais recente
    const { data: last } = await admin
      .from("articles").select("created_at")
      .order("created_at", { ascending: false }).limit(1).single();
    const lastInsertAt = last?.created_at || null;

    // próximo horário de sync (07:00 ou 18:30 local)
    const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
    let nextMin = SYNC_HOURS_UTC.find((h) => h > nowMin);
    const next = new Date(now);
    if (nextMin === undefined) { next.setUTCDate(next.getUTCDate() + 1); nextMin = SYNC_HOURS_UTC[0]; }
    next.setUTCHours(Math.floor(nextMin / 60), nextMin % 60, 0, 0);

    // volume dos últimos 7 dias (por published_at) — anexa contagem de "hoje real"
    const hojeReal = ymd(now);
    const { data: latestPub } = await admin
      .from("articles").select("published_at").not("published_at", "is", null)
      .lte("published_at", hojeReal + "T23:59:59")
      .order("published_at", { ascending: false }).limit(1).single();
    const latestDate = latestPub?.published_at?.slice(0, 10) || hojeReal;

    const start = ymd(new Date(Date.parse(latestDate + "T12:00:00Z") - 6 * DAY));
    const byDate: Record<string, number> = {};
    const munisByDate: Record<string, Set<number>> = {};
    const munis7d = new Set<number>();
    for (let page = 0; ; page++) {
      const { data } = await admin.from("articles").select("published_at, municipality_id")
        .gte("published_at", start + "T00:00:00").lte("published_at", latestDate + "T23:59:59")
        .range(page * 1000, page * 1000 + 999);
      if (!data || !data.length) break;
      for (const a of data) {
        const d = a.published_at.slice(0, 10);
        byDate[d] = (byDate[d] || 0) + 1;
        (munisByDate[d] = munisByDate[d] || new Set()).add(a.municipality_id);
        munis7d.add(a.municipality_id);
      }
      if (data.length < 1000) break;
    }
    const daily = [];
    for (let i = 6; i >= 0; i--) {
      const d = ymd(new Date(Date.parse(latestDate + "T12:00:00Z") - i * DAY));
      daily.push({ date: d, articles: byDate[d] || 0, municipalities: munisByDate[d]?.size || 0 });
    }
    const { count: totalMuni } = await admin.from("municipalities").select("id", { count: "exact", head: true });

    return NextResponse.json({
      lastInsertAt,
      nextSyncAt: next.toISOString(),
      serverNow: now.toISOString(),
      latestDate,
      today: byDate[latestDate] || 0,
      daily,
      municipios7d: munis7d.size,
      totalMunicipios: totalMuni || 497,
      schedule: ["07:00", "18:30"],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "erro" }, { status: 500 });
  }
}
