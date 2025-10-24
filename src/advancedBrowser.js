import fs from 'fs/promises';
import { chromium } from 'playwright';
import { advancedConfig } from './advancedConfig.js';

/**
 * Ultra-Advanced Browser Manager with Stealth, Session Management, and Proxy Support
 */
export class AdvancedBrowserManager {
  constructor(config = advancedConfig) {
    this.config = config;
    this.browser = null;
    this.context = null;
    this.currentProxy = null;
    this.proxyIndex = 0;
  }

  /**
   * Get random user agent
   */
  getRandomUserAgent() {
    const agents = this.config.userAgents;
    return agents[Math.floor(Math.random() * agents.length)];
  }

  /**
   * Get random viewport
   */
  getRandomViewport() {
    const viewports = this.config.viewports;
    return viewports[Math.floor(Math.random() * viewports.length)];
  }

  /**
   * Get next proxy from rotation
   */
  getNextProxy() {
    if (!this.config.proxy.enabled || this.config.proxy.list.length === 0) {
      return null;
    }

    if (this.config.proxy.rotating) {
      const proxy = this.config.proxy.list[this.proxyIndex];
      this.proxyIndex = (this.proxyIndex + 1) % this.config.proxy.list.length;
      return proxy;
    }

    return this.config.proxy.list[0];
  }

  /**
   * Load saved session
   */
  async loadSession() {
    if (!this.config.session.enabled || !this.config.session.persistSession) {
      return { cookies: [], storage: {} };
    }

    try {
      const cookies = await fs.readFile(this.config.session.cookiesFile, 'utf-8')
        .then(data => JSON.parse(data))
        .catch(() => []);

      const storage = await fs.readFile(this.config.session.storageFile, 'utf-8')
        .then(data => JSON.parse(data))
        .catch(() => ({}));

      return { cookies, storage };
    } catch (error) {
      return { cookies: [], storage: {} };
    }
  }

  /**
   * Save session
   */
  async saveSession() {
    if (!this.config.session.enabled || !this.config.session.persistSession || !this.context) {
      return;
    }

    try {
      // Ensure cache directory exists
      const cacheDir = this.config.session.cookiesFile.split('/').slice(0, -1).join('/');
      await fs.mkdir(cacheDir, { recursive: true });

      // Save cookies
      const cookies = await this.context.cookies();
      await fs.writeFile(this.config.session.cookiesFile, JSON.stringify(cookies, null, 2));

      console.log('  💾 Session saved');
    } catch (error) {
      console.error(`  ⚠️  Failed to save session: ${error.message}`);
    }
  }

  /**
   * Initialize browser with advanced anti-detection
   */
  async initialize() {
    const userAgent = this.getRandomUserAgent();
    const viewport = this.getRandomViewport();
    const proxy = this.getNextProxy();

    console.log('🚀 Initializing Ultra-Advanced Browser...');
    console.log(`  User Agent: ${userAgent.substring(0, 50)}...`);
    console.log(`  Viewport: ${viewport.width}x${viewport.height}`);
    if (proxy) console.log(`  Proxy: ${proxy.split('@')[1] || proxy}`);

    const launchOptions = {
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    };

    this.browser = await chromium.launch(launchOptions);

    const contextOptions = {
      userAgent,
      viewport,
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      bypassCSP: true,
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      }
    };

    // Add proxy if available
    if (proxy) {
      contextOptions.proxy = {
        server: proxy
      };
    }

    this.context = await this.browser.newContext(contextOptions);

    // Load saved session
    const session = await this.loadSession();
    if (session.cookies.length > 0) {
      await this.context.addCookies(session.cookies);
      console.log(`  🍪 Loaded ${session.cookies.length} cookies from session`);
    }

    // Advanced stealth injections
    await this.context.addInitScript(() => {
      // Override webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });

      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // Mock Chrome runtime
      window.chrome = {
        runtime: {}
      };

      // Override hardwareConcurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8
      });

      // Override deviceMemory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8
      });
    });

    console.log('✅ Browser initialized with stealth mode');
    return this.context;
  }

  /**
   * Create new page with anti-detection
   */
  async newPage() {
    if (!this.context) {
      await this.initialize();
    }
    return await this.context.newPage();
  }

  /**
   * Close browser and save session
   */
  async close() {
    await this.saveSession();

    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();

    console.log('🔒 Browser closed');
  }

  /**
   * Rotate proxy and reinitialize
   */
  async rotateProxy() {
    console.log('🔄 Rotating proxy...');
    await this.close();
    await this.initialize();
  }

  /**
   * Human-like random delay
   */
  async randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Random delays based on configuration
   */
  async delayBetweenPages() {
    const [min, max] = this.config.rateLimiting.delayBetweenPages;
    await this.randomDelay(min, max);
  }

  async delayBetweenDownloads() {
    const [min, max] = this.config.rateLimiting.delayBetweenDownloads;
    await this.randomDelay(min, max);
  }

  async delayBetweenWebsites() {
    const [min, max] = this.config.rateLimiting.delayBetweenWebsites;
    await this.randomDelay(min, max);
  }
}
