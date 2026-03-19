const { URL } = require('url');

/**
 * Normalizes a URL:
 *  - Resolves relative URLs against a baseUrl
 *  - Adds https:// if protocol is missing
 *  - Removes utm_* tracking parameters
 *  - Lowercases the hostname
 */
function normalizeUrl(url, baseUrl) {
  if (!url || typeof url !== 'string') return null;

  let raw = url.trim();

  // Add protocol if missing
  if (!/^https?:\/\//i.test(raw)) {
    if (raw.startsWith('//')) {
      raw = 'https:' + raw;
    } else if (baseUrl) {
      // Resolve relative URL
      try {
        const base = new URL(baseUrl);
        const resolved = new URL(raw, base);
        raw = resolved.href;
      } catch {
        return null;
      }
    } else {
      raw = 'https://' + raw;
    }
  }

  try {
    const parsed = new URL(raw);

    // Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove utm_* params
    const keysToDelete = [];
    for (const key of parsed.searchParams.keys()) {
      if (key.startsWith('utm_')) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      parsed.searchParams.delete(key);
    }

    return parsed.href;
  } catch {
    return null;
  }
}

module.exports = { normalizeUrl };
