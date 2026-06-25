#!/usr/bin/env node
// Audit v2 (Atlas 2026-06-25): detecção corrigida de banner-bug.
// Mudanças vs v1: (1) datas ESTRUTURADAS (meta/JSON-LD/<time>) têm prioridade
// sobre o texto visível "Publicado em" — que costuma ser a PRÓPRIA data fake do
// banner; (2) novo padrão JSON-LD datePublished (Tunas); (3) novo padrão de data
// "crua" no container do artigo (p.text-muted em .noticia — Erechim) quando não
// há rótulo. DRY_RUN=true por padrão: só REPORTA, não escreve.
require('dotenv').config({ path: __dirname + '/.env' });
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const TARGET = process.argv[2] || new Date().toISOString().slice(0, 10);
const DRY_RUN = process.env.DRY_RUN !== 'false'; // default DRY
const HARD = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);

function parseBR(d) {
  const m = d.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T12:00:00.000Z`;
}
const MESES = { janeiro:'01', fevereiro:'02', 'março':'03', marco:'03', abril:'04', maio:'05', junho:'06', julho:'07', agosto:'08', setembro:'09', outubro:'10', novembro:'11', dezembro:'12' };
function parseLong(d, m, y) { const mes = MESES[m.toLowerCase()]; if (!mes) return null; return `${y}-${mes}-${String(d).padStart(2,'0')}T12:00:00.000Z`; }

function extractRealDate(html, $) {
  // === ESTRUTURADAS PRIMEIRO (data-máquina; imune ao banner visível) ===
  // S1: meta article:published_time / pubdate / itemprop datePublished
  if ($) {
    const meta = $('meta[property="article:published_time"]').attr('content')
              || $('meta[name="pubdate"]').attr('content')
              || $('meta[itemprop="datePublished"]').attr('content');
    if (meta) { const m = meta.match(/(\d{4}-\d{2}-\d{2})/); if (m) return { date: m[1] + 'T12:00:00.000Z', source: 'meta_published' }; }
  }
  // S2: JSON-LD datePublished (Tunas/WordPress) — aceita ISO ou "YYYY-MM-DD HH:MM..."
  let mj = html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/i);
  if (mj) return { date: mj[1] + 'T12:00:00.000Z', source: 'jsonld' };
  // S3: <time datetime>
  if ($) {
    const dt = $('time[datetime]').first().attr('datetime');
    if (dt) { const m = dt.match(/(\d{4}-\d{2}-\d{2})/); if (m) return { date: m[1] + 'T12:00:00.000Z', source: 'time_datetime' }; }
  }

  // === RÓTULOS VISÍVEIS (depois das estruturadas) ===
  let m = html.match(/Data de publica(?:[cç]|&ccedil;)(?:[aã]|&atilde;)o:?[^0-9<]*<\/?\w+>?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)
       || html.match(/Data de publica(?:[cç]|&ccedil;)(?:[aã]|&atilde;)o:?[^0-9]{0,30}(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (m) return { date: parseBR(m[1]), source: 'data_publicacao' };
  m = html.match(/(?:Publicad[oa]|Postad[oa])\s+em:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (m) return { date: parseBR(m[1]), source: 'publicado_em' };

  // S5/S6: "DD de Mês de YYYY"
  m = html.match(/<h2[^>]*>\s*<span[^>]*>[\s\S]*?(\d{1,2})\s+de\s+([A-Za-zçÇ]+)\s+de\s+(\d{4})[\s\S]*?<\/span>/i);
  if (m) { const d = parseLong(m[1], m[2], m[3]); if (d) return { date: d, source: 'h2_span_long_date' }; }
  if ($) {
    const cand = $('span.data, span.date, p.data, time, .post-date, .article-date, .meta-date, .entry-date');
    for (const el of cand.toArray()) {
      const mm = $(el).text().trim().match(/(\d{1,2})\s+de\s+([A-Za-zçÇ]+)\s+de\s+(\d{4})/i);
      if (mm) { const d = parseLong(mm[1], mm[2], mm[3]); if (d) return { date: d, source: 'span_data_long' }; }
    }
  }

  // === DATA CRUA NO CONTAINER DO ARTIGO (Erechim: p.text-muted em .noticia) ===
  // Seletores de ALTA precisão dentro da área do artigo (evita sidebar/relacionadas)
  if ($) {
    const artSel = ['.noticia p.text-muted', 'div.noticia .text-muted', '.noticia-data', '.data-publicacao',
                    '.post-data', 'article .text-muted', '.materia .text-muted', '.conteudo-noticia .text-muted'];
    for (const sel of artSel) {
      const el = $(sel).first();
      if (el.length) {
        const mm = el.text().trim().match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (mm) return { date: parseBR(mm[1]), source: 'container_text_muted' };
      }
    }
  }
  return null;
}

(async () => {
  const { data: arts } = await sb.from('articles')
    .select('id, url, title, published_at, municipality_id, municipalities(name)')
    .gte('published_at', TARGET + 'T00:00:00').lte('published_at', TARGET + 'T23:59:59');
  console.log(`[${DRY_RUN ? 'DRY-RUN' : 'APLICANDO'}] Auditando ${arts.length} artigos de ${TARGET}\n`);

  const pLimit = (await import('p-limit')).default;
  const limit = pLimit(8);
  const stats = { kept: 0, fixed: 0, no_real_date: 0, error: 0 };
  const changes = [], bySrc = {};

  await Promise.all(arts.map(a => limit(async () => {
    try {
      const r = await HARD(axios.get(a.url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' }, validateStatus: () => true }), 18000);
      if (r.status !== 200 || !r.data) { stats.error++; return; }
      const $ = cheerio.load(r.data);
      const real = extractRealDate(r.data, $);
      if (!real || !real.date) { stats.no_real_date++; return; }
      const realDay = real.date.slice(0, 10);
      if (realDay === TARGET) { stats.kept++; return; }
      // BACKWARD-ONLY: o banner-bug é sempre antiga→hoje. Só re-datamos para
      // TRÁS (data real anterior ao TARGET). Mover pra frente não é banner-bug
      // e arrisca pegar data de sidebar/relacionadas — fora de escopo.
      if (realDay > TARGET) { stats.kept++; stats.fwdSkipped = (stats.fwdSkipped||0)+1; return; }
      // mudança detectada (antiga como nova)
      stats.fixed++;
      bySrc[real.source] = (bySrc[real.source] || 0) + 1;
      const gap = Math.round((new Date(TARGET) - new Date(realDay)) / 86400000);
      changes.push({ id: a.id, muni: a.municipalities?.name || '?', from: TARGET, to: realDay, gap, src: real.source, url: a.url });
      if (!DRY_RUN) await sb.from('articles').update({ published_at: real.date }).eq('id', a.id);
    } catch (e) { stats.error++; }
  })));

  changes.sort((x, y) => y.gap - x.gap);
  console.log(`=== ${DRY_RUN ? 'MUDARIA' : 'MUDOU'} ${stats.fixed} | manteve ${stats.kept} | sem data ${stats.no_real_date} | erro ${stats.error} ===`);
  console.log(`Por fonte:`, JSON.stringify(bySrc));
  console.log(`\n--- Re-datações (antiga como nova → data real) ---`);
  changes.forEach(c => console.log(`${c.muni.padEnd(20)} ${c.from}→${c.to} (-${c.gap}d) [${c.src}] ${c.url}`));
  require('fs').writeFileSync(__dirname + `/audit-v2-dry-${TARGET}.json`, JSON.stringify({ stats, changes, bySrc }, null, 2));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
