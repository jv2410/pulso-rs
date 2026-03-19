/**
 * Cleans text extracted from HTML:
 *  - Strips remaining HTML tags
 *  - Decodes common HTML entities
 *  - Collapses whitespace
 *  - Trims leading/trailing whitespace
 */

const ENTITY_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&ndash;': '\u2013',
  '&mdash;': '\u2014',
  '&copy;': '\u00A9',
  '&reg;': '\u00AE',
  '&trade;': '\u2122',
  '&hellip;': '\u2026',
  '&laquo;': '\u00AB',
  '&raquo;': '\u00BB',
  '&ccedil;': '\u00E7',
  '&Ccedil;': '\u00C7',
  '&atilde;': '\u00E3',
  '&Atilde;': '\u00C3',
  '&otilde;': '\u00F5',
  '&Otilde;': '\u00D5',
  '&aacute;': '\u00E1',
  '&eacute;': '\u00E9',
  '&iacute;': '\u00ED',
  '&oacute;': '\u00F3',
  '&uacute;': '\u00FA',
  '&agrave;': '\u00E0'
};

function cleanText(html) {
  if (!html || typeof html !== 'string') return '';

  let text = html;

  // Strip HTML tags
  text = text.replace(/<[^>]*>/g, ' ');

  // Decode named HTML entities
  text = text.replace(/&[a-zA-Z]+;/g, (match) => ENTITY_MAP[match] || match);

  // Decode numeric HTML entities (decimal and hex)
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ');

  // Trim
  text = text.trim();

  return text;
}

module.exports = { cleanText };
