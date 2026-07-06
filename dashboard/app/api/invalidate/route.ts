import { NextRequest, NextResponse } from "next/server";
import { admin } from "../../../lib/admin";

// Rota SERVER-SIDE (Atlas 2026-06-30): a feature de invalidar notícia escrevia
// com a chave ANÔNIMA, mas o RLS do Supabase BLOQUEIA UPDATE anônimo — retornava
// 'error: null' com 0 linhas afetadas, então o front achava que gravou mas NADA
// persistia. Aqui usamos a service key (só no servidor, nunca vai pro browser)
// para escrever de verdade. Preferência por env var; fallback embutido para
// funcionar sem configuração extra (mesmo padrão do publish-wp). RECOMENDADO:
// mover para env var SUPABASE_SERVICE_KEY no Vercel e rotacionar a chave.


// Forma canônica (sem protocolo/www/barra final/query) — a MESMA notícia é
// servida como http e https, com/sem www. Marcar uma precisa marcar todas, senão
// o sync re-insere a variante e a notícia "volta" ao feed.
const norm = (u: string) => (u || "").trim().toLowerCase()
  .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[?#].*$/, "").replace(/\/+$/, "");

function urlVariants(u: string): string[] {
  const n = norm(u);
  const out: string[] = [];
  for (const proto of ["http://", "https://"])
    for (const w of ["", "www."])
      for (const trail of ["", "/"])
        out.push(proto + w + n + trail);
  return Array.from(new Set(out));
}

export async function POST(req: NextRequest) {
  try {
    const { id, relevance_score, category } = await req.json();
    if (typeof id === "undefined" || typeof relevance_score === "undefined") {
      return NextResponse.json({ error: "id e relevance_score são obrigatórios" }, { status: 400 });
    }
    const patch: { relevance_score: number; category?: string } = { relevance_score };
    if (typeof category !== "undefined") patch.category = category;

    // 1) aplica no artigo clicado
    const { data, error } = await admin
      .from("articles").update(patch).eq("id", id).select("id, url");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Nenhuma linha atualizada (id inexistente?)" }, { status: 404 });
    }

    // 2) propaga para TODAS as variantes http/https/www da mesma URL, para a
    //    notícia não voltar por uma variante não-marcada.
    let variantsUpdated = 0;
    const clickedUrl = data[0]?.url as string | undefined;
    if (clickedUrl) {
      const { data: vars } = await admin
        .from("articles").update(patch).in("url", urlVariants(clickedUrl)).select("id");
      variantsUpdated = vars?.length || 0;
    }
    return NextResponse.json({ success: true, updated: Math.max(data.length, variantsUpdated) });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro interno" }, { status: 500 });
  }
}
