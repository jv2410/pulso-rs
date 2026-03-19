const axios = require('axios');

function getGeminiUrl() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
}

const PROMPT = `Analise este conteúdo de uma página web de uma prefeitura municipal brasileira.
Responda EXATAMENTE em JSON com este formato, sem markdown, sem explicação:
{"date":"YYYY-MM-DD","is_news":true}

Regras:
- "date": a data de PUBLICAÇÃO da notícia (não datas mencionadas no texto, não data de atualização do portal). Se não encontrar, use null.
- "is_news": true se é uma notícia/artigo individual, false se é página institucional, categoria, listagem, secretaria, ou página estática.

Conteúdo:
`;

/**
 * Use Gemini Flash to extract publication date and validate if page is news.
 * @param {string} title - Article title
 * @param {string} textContent - First ~800 chars of page text (no HTML)
 * @param {string} url - Page URL
 * @returns {Promise<{date: string|null, isNews: boolean}>}
 */
async function extractWithLLM(title, textContent, url) {
  const geminiUrl = getGeminiUrl();
  if (!geminiUrl) {
    return { date: null, isNews: true };
  }

  // Remove common nav/menu noise from beginning and send more content
  const cleaned = textContent
    .replace(/^[\s\S]{0,500}?(?=\b[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÚÇ]{2})/m, '') // skip to first uppercase word block
    .substring(0, 1500);
  const input = `URL: ${url}\nTítulo: ${title}\n\n${cleaned || textContent.substring(0, 1500)}`;

  try {
    const response = await axios.post(geminiUrl, {
      contents: [{ parts: [{ text: PROMPT + input }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 60,
      }
    }, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    });

    const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Extract JSON from response (may have markdown backticks)
    const jsonMatch = raw.match(/\{[^}]+\}/);
    if (!jsonMatch) return { date: null, isNews: true };

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate date format
    let date = null;
    if (parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
      const d = new Date(parsed.date + 'T12:00:00Z');
      if (!isNaN(d.getTime())) {
        date = d.toISOString();
      }
    }

    return {
      date,
      isNews: parsed.is_news !== false, // default true if missing
    };
  } catch {
    return { date: null, isNews: true };
  }
}

const SUMMARY_PROMPT = `Resuma esta notícia de uma prefeitura municipal brasileira em 1-2 frases curtas (máximo 200 caracteres).
Seja direto e objetivo. Não comece com "A prefeitura" ou "O município". Foque no FATO principal.

Título: `;

/**
 * Generate a short summary of a news article using Gemini Flash.
 * @param {string} title
 * @param {string} content - Article text content
 * @returns {Promise<string|null>}
 */
async function summarizeWithLLM(title, content) {
  const geminiUrl = getGeminiUrl();
  if (!geminiUrl || !content) return null;

  const input = `${title}\n\nConteúdo: ${content.substring(0, 1000)}`;

  try {
    const response = await axios.post(geminiUrl, {
      contents: [{ parts: [{ text: SUMMARY_PROMPT + input }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 100,
      }
    }, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    });

    const raw = (response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    if (!raw || raw.length < 10) return null;
    // Limit to 250 chars
    return raw.substring(0, 250);
  } catch {
    return null;
  }
}

module.exports = { extractWithLLM, summarizeWithLLM };
