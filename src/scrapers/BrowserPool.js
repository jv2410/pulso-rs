/**
 * BrowserPool — singleton Playwright Chromium manager.
 *
 * Owns the lifecycle of a single Chromium browser process and exposes a
 * `fetchRendered(url)` helper that returns the fully rendered HTML for a
 * given URL.
 *
 * Architecture: Decisions D1, D2, E1, F1 in docs/scraper-v2-architecture.md.
 * - One browser per Node.js process (singleton, lazy startup).
 * - One *new* context per fetch (isolation between municipalities).
 * - Memory-hardened launch flags + request blocking (image/media/font) to
 *   keep Railway RAM under control.
 * - Per-run cap (PLAYWRIGHT_MAX_PER_RUN) to bound worst-case runtime.
 *
 * NOTE: Uses the `playwright` package (installed by parallel Dex working on
 * package.json). This module does NOT require playwright at module-load time
 * — it lazy-requires inside `init()` so unit tests can import the file and
 * inspect `getStats()` / `isEnabled()` without the dependency present.
 */

'use strict';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

const HARDENING_ARGS = [
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-extensions',
  '--no-first-run',
];

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font']);

function parseIntEnv(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

class BrowserPool {
  constructor(options = {}) {
    // Read env once at construction.
    const envEnabled = process.env.PLAYWRIGHT_ENABLED;
    this._enabled = envEnabled !== 'false'; // default true
    this._maxPerRun = parseIntEnv(
      process.env.PLAYWRIGHT_MAX_PER_RUN,
      typeof options.maxPerRun === 'number' ? options.maxPerRun : 60
    );
    this._pageTimeoutMs = parseIntEnv(
      process.env.PLAYWRIGHT_PAGE_TIMEOUT_MS,
      typeof options.pageTimeoutMs === 'number' ? options.pageTimeoutMs : 15000
    );
    this._networkIdleTimeoutMs =
      typeof options.networkIdleTimeoutMs === 'number'
        ? options.networkIdleTimeoutMs
        : 3000;
    this._userAgent = options.userAgent || DEFAULT_USER_AGENT;

    // STABILITY (Atlas 2026-06-17): a single long-lived Chromium serving the
    // whole sync crashed under load (memory buildup + too many concurrent
    // contexts when ~10 cities render at once → "browser context not found").
    // Two guards:
    //  - _maxConcurrent: cap simultaneous renders on the single browser.
    //  - _recycleEvery: close & relaunch the browser every N renders so memory
    //    is flushed before it crashes.
    this._maxConcurrent = parseIntEnv(
      process.env.PLAYWRIGHT_MAX_CONCURRENT,
      typeof options.maxConcurrent === 'number' ? options.maxConcurrent : 3
    );
    this._recycleEvery = parseIntEnv(
      process.env.PLAYWRIGHT_RECYCLE_EVERY,
      typeof options.recycleEvery === 'number' ? options.recycleEvery : 60
    );

    // Mutable state.
    this._browser = null;
    this._initPromise = null;
    this._fetchCount = 0;
    this._successCount = 0;
    this._errorCount = 0;
    this._closing = false;
    // Concurrency semaphore + recycle counter.
    this._activeRenders = 0;
    this._waiters = [];
    this._rendersOnBrowser = 0;
  }

  /**
   * Acquire a concurrency slot (waits if _maxConcurrent renders are in flight).
   * @private
   */
  async _acquireSlot() {
    while (this._activeRenders >= this._maxConcurrent) {
      await new Promise((resolve) => this._waiters.push(resolve));
    }
    this._activeRenders += 1;
  }

  /**
   * Release a concurrency slot and wake the next waiter (if any).
   * @private
   */
  _releaseSlot() {
    this._activeRenders -= 1;
    const next = this._waiters.shift();
    if (next) next();
  }

  /**
   * Recycle the Chromium browser after _recycleEvery renders, but only when no
   * render is in flight. Closing nulls the singleton so the next _init() spins
   * up a fresh process — flushing accumulated memory and preventing crashes.
   * @private
   */
  async _maybeRecycle() {
    if (this._rendersOnBrowser < this._recycleEvery) return;
    if (this._activeRenders > 0) return; // wait until idle to avoid killing in-flight renders
    const browser = this._browser;
    this._browser = null;
    this._initPromise = null;
    this._rendersOnBrowser = 0;
    if (browser) {
      console.log(`[BrowserPool] recycling Chromium after ${this._recycleEvery} renders…`);
      try {
        await browser.close();
      } catch (_) {
        /* ignore */
      }
    }
  }

  /**
   * @returns {boolean} true if Playwright is enabled for this process.
   */
  isEnabled() {
    // Read env each call so kill-switch toggles reflect immediately
    // (the singleton would otherwise cache the boot-time value forever).
    return process.env.PLAYWRIGHT_ENABLED !== 'false';
  }

  /**
   * @returns {{ fetchCount:number, successCount:number, errorCount:number, browserStarted:boolean }}
   */
  getStats() {
    return {
      fetchCount: this._fetchCount,
      successCount: this._successCount,
      errorCount: this._errorCount,
      browserStarted: this._browser !== null,
    };
  }

  /**
   * Idempotently launch the singleton Chromium browser. Multiple concurrent
   * callers all await the same in-flight promise.
   * @private
   */
  async _init() {
    if (this._browser) return this._browser;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      // Lazy require so module loads even without playwright installed.
      // eslint-disable-next-line global-require
      const { chromium } = require('playwright');
      console.log('[BrowserPool] launching Chromium (headless)…');
      const browser = await chromium.launch({
        headless: true,
        args: HARDENING_ARGS,
      });
      this._browser = browser;
      console.log('[BrowserPool] Chromium launched.');

      // Auto-clear singleton if browser dies (process crash, OOM, etc.)
      browser.on('disconnected', () => {
        console.log('[BrowserPool] Chromium disconnected.');
        this._browser = null;
        this._initPromise = null;
      });

      return browser;
    })();

    try {
      return await this._initPromise;
    } catch (err) {
      // Clear the failed promise so a retry can re-attempt launch.
      this._initPromise = null;
      this._browser = null;
      throw err;
    }
  }

  /**
   * Fetch a URL and return its fully rendered HTML.
   * Creates a fresh context per call and disposes it before returning.
   *
   * @param {string} url
   * @returns {Promise<string>} rendered HTML
   * @throws Error on disabled pool, max-per-run cap, navigation failure, or timeout.
   */
  async fetchRendered(url) {
    if (!this.isEnabled()) {
      throw new Error('Playwright disabled via PLAYWRIGHT_ENABLED=false');
    }
    if (this._closing) {
      throw new Error('BrowserPool is closing');
    }
    if (this._successCount >= this._maxPerRun) {
      throw new Error('PLAYWRIGHT_MAX_PER_RUN reached');
    }

    this._fetchCount += 1;

    // Wait for a concurrency slot before touching the browser.
    await this._acquireSlot();

    let browser;
    try {
      browser = await this._init();
    } catch (err) {
      this._errorCount += 1;
      this._releaseSlot();
      console.error('[BrowserPool] failed to launch browser:', err.message);
      throw err;
    }

    let context = null;
    let page = null;
    try {
      context = await browser.newContext({
        userAgent: this._userAgent,
        viewport: { width: 1366, height: 900 },
        javaScriptEnabled: true,
        // Many municipal sites have invalid/self-signed/expired certs.
        // axios already bypasses with rejectUnauthorized:false; mirror here.
        ignoreHTTPSErrors: true,
      });

      // Block heavy resources at the context level so it applies to every
      // request the page (or its iframes) make.
      await context.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (BLOCKED_RESOURCE_TYPES.has(type)) {
          return route.abort();
        }
        return route.continue();
      });

      page = await context.newPage();
      page.setDefaultNavigationTimeout(this._pageTimeoutMs);
      page.setDefaultTimeout(this._pageTimeoutMs);

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this._pageTimeoutMs,
      });

      // Best-effort wait for SPA hydration. Networkidle commonly never fires
      // on gov sites that keep an analytics socket open — swallow timeout.
      try {
        await page.waitForLoadState('networkidle', {
          timeout: Math.min(this._networkIdleTimeoutMs, 3000),
        });
      } catch (_) {
        // expected on chatty pages — ignore
      }

      const html = await page.content();
      this._successCount += 1;
      this._rendersOnBrowser += 1;
      return html;
    } catch (err) {
      this._errorCount += 1;
      console.error(
        `[BrowserPool] fetchRendered(${url}) failed: ${err.message}`
      );
      throw err;
    } finally {
      // Never leak a context. Close page first, then context.
      if (page) {
        try {
          await page.close();
        } catch (_) {
          /* ignore */
        }
      }
      if (context) {
        try {
          await context.close();
        } catch (_) {
          /* ignore */
        }
      }
      // Free the slot, then recycle the browser if it has served enough renders
      // and is now idle. Order matters: release before the idle check.
      this._releaseSlot();
      try {
        await this._maybeRecycle();
      } catch (_) {
        /* ignore */
      }
    }
  }

  /**
   * Close the browser and reset internal state. Idempotent.
   */
  async close() {
    if (this._closing) return;
    this._closing = true;
    try {
      const browser = this._browser;
      this._browser = null;
      this._initPromise = null;
      if (browser) {
        console.log('[BrowserPool] closing Chromium…');
        try {
          await browser.close();
        } catch (err) {
          console.error('[BrowserPool] error closing browser:', err.message);
        }
        console.log('[BrowserPool] Chromium closed.');
      }
    } finally {
      this._closing = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton accessor
// ---------------------------------------------------------------------------

let _singleton = null;

/**
 * Returns the process-wide BrowserPool instance. The first call's options
 * are honoured; subsequent calls return the existing instance and ignore
 * their `options` argument (logged in dev for visibility).
 *
 * @param {object} [options]
 * @returns {BrowserPool}
 */
function getInstance(options = {}) {
  if (!_singleton) {
    _singleton = new BrowserPool(options);
  }
  return _singleton;
}

/**
 * Test-only: drop the cached singleton so a new instance can be constructed.
 * Not part of the public API — exported for integration tests.
 * @private
 */
function _resetSingletonForTests() {
  _singleton = null;
}

module.exports = {
  BrowserPool,
  getInstance,
  _resetSingletonForTests,
};
