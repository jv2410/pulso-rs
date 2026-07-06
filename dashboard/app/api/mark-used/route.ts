import { NextRequest, NextResponse } from "next/server";
import { admin } from "../../../lib/admin";

// Marcar/consultar "matéria usada no portal 497" (Atlas 2026-07-06).
// Persiste na coluna articles.used_in_portal (boolean). TOLERANTE: se a coluna
// ainda não existir (não temos DDL neste projeto Supabase), degrada sem quebrar
// o feed — GET devolve lista vazia, POST devolve columnMissing + o SQL a rodar.
export const dynamic = "force-dynamic";

const ADD_COLUMN_SQL =
  "ALTER TABLE articles ADD COLUMN IF NOT EXISTS used_in_portal boolean NOT NULL DEFAULT false;";

const isMissingColumn = (msg?: string) =>
  !!msg && /used_in_portal|column .* does not exist|42703/i.test(msg);

// GET ?date=YYYY-MM-DD → { usedIds: number[] }
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date obrigatório" }, { status: 400 });
  const { data, error } = await admin
    .from("articles").select("id")
    .eq("used_in_portal", true)
    .gte("published_at", date + "T00:00:00").lte("published_at", date + "T23:59:59");
  if (error) {
    if (isMissingColumn(error.message)) return NextResponse.json({ usedIds: [], columnMissing: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ usedIds: (data || []).map((a) => a.id) });
}

// POST { id, used } → marca/desmarca
export async function POST(req: NextRequest) {
  try {
    const { id, used } = await req.json();
    if (typeof id === "undefined" || typeof used === "undefined") {
      return NextResponse.json({ error: "id e used são obrigatórios" }, { status: 400 });
    }
    const { data, error } = await admin
      .from("articles").update({ used_in_portal: !!used }).eq("id", id).select("id");
    if (error) {
      if (isMissingColumn(error.message)) {
        return NextResponse.json(
          { error: "Coluna used_in_portal ainda não existe.", columnMissing: true, sql: ADD_COLUMN_SQL },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) return NextResponse.json({ error: "id inexistente" }, { status: 404 });
    return NextResponse.json({ success: true, used: !!used });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "erro" }, { status: 500 });
  }
}
