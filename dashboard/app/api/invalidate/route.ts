import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Rota SERVER-SIDE (Atlas 2026-06-30): a feature de invalidar notícia escrevia
// com a chave ANÔNIMA, mas o RLS do Supabase BLOQUEIA UPDATE anônimo — retornava
// 'error: null' com 0 linhas afetadas, então o front achava que gravou mas NADA
// persistia. Aqui usamos a service key (só no servidor, nunca vai pro browser)
// para escrever de verdade. Preferência por env var; fallback embutido para
// funcionar sem configuração extra (mesmo padrão do publish-wp). RECOMENDADO:
// mover para env var SUPABASE_SERVICE_KEY no Vercel e rotacionar a chave.
const SUPABASE_URL = process.env.SUPABASE_URL || "https://kkuxgyjecjlfgahhoipv.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdXhneWplY2psZmdhaGhvaXB2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTE1MDU1OCwiZXhwIjoyMDU2NzI2NTU4fQ.L5Oim4rS-ERTNrS8svfKRrQwnEpwhDiECF4IQjYssqk";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

export async function POST(req: NextRequest) {
  try {
    const { id, relevance_score, category } = await req.json();
    if (typeof id === "undefined" || typeof relevance_score === "undefined") {
      return NextResponse.json({ error: "id e relevance_score são obrigatórios" }, { status: 400 });
    }
    const patch: { relevance_score: number; category?: string } = { relevance_score };
    if (typeof category !== "undefined") patch.category = category;

    const { data, error } = await admin
      .from("articles")
      .update(patch)
      .eq("id", id)
      .select("id");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Nenhuma linha atualizada (id inexistente?)" }, { status: 404 });
    }
    return NextResponse.json({ success: true, updated: data.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro interno" }, { status: 500 });
  }
}
