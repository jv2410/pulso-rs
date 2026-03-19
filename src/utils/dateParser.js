/**
 * Parses Brazilian date formats and returns an ISO 8601 string or null.
 * Supported formats:
 *   - DD/MM/YYYY
 *   - DD de mês de YYYY
 *   - ISO 8601 (passthrough)
 */

const MONTH_MAP = {
  'janeiro': '01',
  'fevereiro': '02',
  'março': '03',
  'marco': '03',
  'abril': '04',
  'maio': '05',
  'junho': '06',
  'julho': '07',
  'agosto': '08',
  'setembro': '09',
  'outubro': '10',
  'novembro': '11',
  'dezembro': '12'
};

function parseBrazilianDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();

  // ISO 8601: already valid
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // DD/MM/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // DD de mês de YYYY
  const textMatch = trimmed.toLowerCase().match(/^(\d{1,2})\s+de\s+([a-záàâãéêíóôõúç]+)\s+de\s+(\d{4})$/);
  if (textMatch) {
    const [, day, monthName, year] = textMatch;
    const month = MONTH_MAP[monthName];
    if (!month) return null;
    const d = new Date(`${year}-${month}-${day.padStart(2, '0')}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  return null;
}

module.exports = { parseBrazilianDate };
