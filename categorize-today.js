#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { classifyAndSummarize } = require('./src/utils/llmDateExtractor');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const HARD = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout '+ms+'ms')), ms))]);

async function main() {
  const target = process.argv[2] || '2026-04-30';
  const dt = new Date(target + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + 1);
  const next = dt.toISOString().slice(0, 10);
  // Fetch articles published on target date without category.
  // relevance_score = 0 é "marcada como inválida" pelo usuário no dashboard —
  // NÃO recategorizar (sobrescreveria o score 0 e a notícia voltaria a aparecer).
  const { data: arts } = await sb.from('articles')
    .select('id,title,content')
    .is('category', null)
    .or('relevance_score.is.null,relevance_score.neq.0')
    .gte('published_at', target)
    .lt('published_at', next);

  console.log(`Categorizando ${arts.length} artigos de hoje (29/04)...`);
  console.log(`Concurrency=2 + delay 800ms entre calls (rate limit Gemini)\n`);

  const pLimit = (await import('p-limit')).default;
  const limit = pLimit(2);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const stats = { ok: 0, failed: 0, processed: 0, deleted_score1: 0 };
  const start = Date.now();

  await Promise.all(arts.map(a => limit(async () => {
    try {
      const r = await HARD(classifyAndSummarize(a.title, a.content || a.title), 45000);
      await sleep(800);
      // Auto-delete score 1 articles (lixo: títulos genéricos, listas administrativas)
      if (r.relevanceScore === 1) {
        const { error: delErr } = await sb.from('articles').delete().eq('id', a.id);
        if (delErr) throw delErr;
        stats.deleted_score1++;
      } else {
        const { error } = await sb.from('articles').update({
          summary: r.summary || null,
          category: r.category || null,
          relevance_score: r.relevanceScore || null,
        }).eq('id', a.id);
        if (error) throw error;
        stats.ok++;
      }
    } catch (e) {
      stats.failed++;
    }
    stats.processed++;
    if (stats.processed % 10 === 0 || stats.processed === arts.length) {
      const el = ((Date.now() - start) / 1000).toFixed(0);
      process.stdout.write(`\r[${stats.processed}/${arts.length}] (${el}s) ok:${stats.ok} del1:${stats.deleted_score1} fail:${stats.failed}    `);
    }
  })));

  console.log(`\n\nDone! ${stats.ok} categorizados, ${stats.deleted_score1} deletados (score 1), ${stats.failed} falhas em ${((Date.now() - start) / 1000).toFixed(0)}s`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
