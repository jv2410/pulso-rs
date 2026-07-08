#!/usr/bin/env node
// Categorização com LOOP-ATÉ-COMPLETAR (Atlas 2026-07-08).
// Problema antigo: o Gemini, sob rate-limit, retorna category=null SEM lançar
// erro; o script gravava esse null e "queimava" o artigo (contava como ok). No
// pico de volume sobravam dezenas sem categoria. Agora: re-processa os nulos em
// rounds com backoff crescente até esgotar (ou até parar de progredir), e NUNCA
// grava categoria vazia — deixa o artigo null pro próximo round re-tentar.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { classifyAndSummarize } = require('./src/utils/llmDateExtractor');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const HARD = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout ' + ms + 'ms')), ms))]);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const MAX_ROUNDS = parseInt(process.env.CATEGORIZE_MAX_ROUNDS || '8', 10);

async function fetchPending(target, next) {
  // Artigos do dia SEM categoria. relevance_score = 0 é "marcada inválida" pelo
  // usuário — NÃO recategorizar (sobrescreveria o score 0 e a notícia voltaria).
  const { data } = await sb.from('articles')
    .select('id,title,content')
    .is('category', null)
    .or('relevance_score.is.null,relevance_score.neq.0')
    .gte('published_at', target).lt('published_at', next);
  return data || [];
}

async function processRound(arts) {
  const pLimit = (await import('p-limit')).default;
  const limit = pLimit(2);
  const stats = { ok: 0, empty: 0, failed: 0, deleted_score1: 0 };

  await Promise.all(arts.map(a => limit(async () => {
    try {
      const r = await HARD(classifyAndSummarize(a.title, a.content || a.title), 45000);
      await sleep(800);
      if (r.relevanceScore === 1) {
        const { error: delErr } = await sb.from('articles').delete().eq('id', a.id);
        if (delErr) throw delErr;
        stats.deleted_score1++;
        return;
      }
      // Gemini estrangulado: retorno sem categoria → NÃO grava (deixa pro próximo
      // round). Só grava quando veio categoria de verdade.
      if (!r.category) { stats.empty++; return; }
      const { error } = await sb.from('articles').update({
        summary: r.summary || null,
        category: r.category,
        relevance_score: r.relevanceScore || null,
      }).eq('id', a.id);
      if (error) throw error;
      stats.ok++;
    } catch (e) {
      stats.failed++;
    }
  })));
  return stats;
}

async function main() {
  const target = process.argv[2] || new Date().toISOString().slice(0, 10);
  const dt = new Date(target + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + 1);
  const next = dt.toISOString().slice(0, 10);

  const startAll = Date.now();
  let totalOk = 0, totalDel = 0, round = 0, stagnant = 0;

  while (round < MAX_ROUNDS) {
    round++;
    const pending = await fetchPending(target, next);
    if (pending.length === 0) { console.log(`\nTudo categorizado (0 pendentes).`); break; }

    process.stdout.write(`Round ${round}: ${pending.length} pendentes… `);
    const s = await processRound(pending);
    totalOk += s.ok; totalDel += s.deleted_score1;
    console.log(`ok:${s.ok} del1:${s.deleted_score1} vazio(Gemini):${s.empty} fail:${s.failed}`);

    // progresso do round = categorizados + deletados. Se 0, o Gemini está
    // estrangulado — espera (backoff) e tenta de novo; para após 2 rounds parados.
    const progress = s.ok + s.deleted_score1;
    if (progress === 0) {
      stagnant++;
      if (stagnant >= 2) { console.log(`\n2 rounds sem progresso — Gemini indisponível, parando. Rode de novo mais tarde.`); break; }
    } else {
      stagnant = 0;
    }
    // backoff crescente entre rounds pra dar tempo do rate-limit resetar
    const remaining = await fetchPending(target, next);
    if (remaining.length === 0) { console.log(`Tudo categorizado.`); break; }
    const wait = Math.min(5000 + round * 4000, 25000);
    if (round < MAX_ROUNDS) { process.stdout.write(`  aguardando ${wait / 1000}s antes do próximo round…\n`); await sleep(wait); }
  }

  const restantes = (await fetchPending(target, next)).length;
  console.log(`\nDone! ${totalOk} categorizados, ${totalDel} deletados (score 1), ${restantes} ainda sem categoria em ${((Date.now() - startAll) / 1000).toFixed(0)}s (${round} rounds)`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
