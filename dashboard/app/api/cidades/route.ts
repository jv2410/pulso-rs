import { NextResponse } from "next/server";
import { admin } from "../../../lib/admin";

// Monitoramento por cidade (pedido do cliente Jairo, 2026-08-31): total de
// notícias captadas desde o início + última data de captação, por município.
// Agrega ao vivo do banco (não do JSON estático). Exclui relevance_score=0
// (inválidas marcadas pelo time). Ver aba "Cobertura".
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY = 86400000;

export async function GET() {
  try {
    // municípios (id → nome)
    const munis: { id: number; name: string }[] = [];
    for (let p = 0; ; p++) {
      const { data } = await admin
        .from("municipalities").select("id,name")
        .range(p * 1000, p * 1000 + 999);
      if (!data || !data.length) break;
      munis.push(...data);
      if (data.length < 1000) break;
    }

    const agg: Record<number, { total: number; last: string | null; last30: number }> = {};
    munis.forEach((m) => (agg[m.id] = { total: 0, last: null, last30: 0 }));

    const now = Date.now();
    const cut30 = new Date(now - 30 * DAY).toISOString().slice(0, 10);

    // artigos (colunas leves) — conta total, última data e últimos 30d por cidade
    for (let p = 0; ; p++) {
      const { data } = await admin
        .from("articles").select("municipality_id, published_at, relevance_score")
        .range(p * 1000, p * 1000 + 999);
      if (!data || !data.length) break;
      for (const a of data) {
        const m = agg[a.municipality_id as number];
        if (!m) continue;
        if (a.relevance_score === 0) continue; // inválida marcada pelo time
        m.total++;
        const d = a.published_at ? String(a.published_at).slice(0, 10) : null;
        if (d) {
          if (!m.last || d > m.last) m.last = d;
          if (d >= cut30) m.last30++;
        }
      }
      if (data.length < 1000) break;
    }

    const cidades = munis
      .map((m) => ({ name: m.name, total: agg[m.id].total, lastDate: agg[m.id].last, last30: agg[m.id].last30 }))
      .sort((a, b) => b.total - a.total);

    const comNoticia = cidades.filter((c) => c.total > 0).length;
    const totalArtigos = cidades.reduce((s, c) => s + c.total, 0);

    return NextResponse.json({
      cidades,
      resumo: { totalCidades: munis.length, comNoticia, totalArtigos },
      geradoEm: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "erro" }, { status: 500 });
  }
}
