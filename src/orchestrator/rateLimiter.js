'use strict';

/**
 * Per-domain rate limiter.
 * Ensures a minimum delay between requests to the same domain
 * to avoid overwhelming target servers.
 */
class RateLimiter {
  /**
   * @param {number} [minDelayMs=1500] - Minimum delay in ms between requests to the same domain
   */
  constructor(minDelayMs = 1500) {
    this.minDelayMs = minDelayMs;
    /** @type {Map<string, number>} domain -> last request timestamp */
    this.lastRequestTime = new Map();
  }

  /**
   * Acquires permission to make a request to the given domain.
   * Waits if the minimum delay since the last request has not elapsed.
   *
   * @param {string} domain - The domain to rate-limit against
   * @returns {Promise<void>}
   */
  async acquire(domain) {
    const now = Date.now();
    const lastTime = this.lastRequestTime.get(domain);

    if (lastTime !== undefined) {
      const elapsed = now - lastTime;
      const waitMs = this.minDelayMs - elapsed;

      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }

    this.lastRequestTime.set(domain, Date.now());
  }
}

module.exports = { RateLimiter };
