import fs from 'fs/promises';
import path from 'path';
import { advancedConfig } from './advancedConfig.js';
import { CaptchaSolver } from './captchaSolver.js';
import { PDFValidator } from './pdfValidator.js';

/**
 * Ultra-Advanced PDF Downloader with full validation and CAPTCHA handling
 */
export class UltraAdvancedPDFDownloader {
  constructor(browserManager) {
    this.browserManager = browserManager;
    this.config = advancedConfig;
    this.pdfValidator = new PDFValidator(this.config.pdfValidation);
    this.captchaSolver = new CaptchaSolver();
    this.downloadedFiles = [];
    this.visitedUrls = new Set();
    this.downloadAttempts = new Map();
  }

  async ensureDownloadDir() {
    try {
      await fs.access(this.config.pdfOutputDir);
    } catch {
      await fs.mkdir(this.config.pdfOutputDir, { recursive: true });
    }
  }

  /**
   * Enhanced PDF link discovery with JavaScript rendering
   */
  async findPDFLinks(page, url) {
    console.log(`  🔍 Navigating to ${url}...`);

    try {
      // Navigate with longer timeout
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.navigationTimeout
      });

      // Check for CAPTCHA
      await this.captchaSolver.handleCaptcha(page);

      // Wait for page to fully load
      await page.waitForTimeout(this.config.jsExecutionDelays.afterNavigation);

      // Human-like scrolling
      await this.humanLikeScroll(page);

      // Dismiss modals
      await this.dismissModals(page);

      // Click load more buttons
      await this.clickLoadMoreButtons(page);

      // Additional wait for dynamic content
      await page.waitForTimeout(this.config.jsExecutionDelays.afterScroll);

      // Extract PDF links
      const pdfLinks = await this.comprehensivePDFSearch(page, url);

      return pdfLinks;
    } catch (error) {
      console.error(`  ❌ Error navigating: ${error.message}`);

      // Check if it's a rate limiting issue
      if (error.message.includes('429') || error.message.includes('rate')) {
        console.log('  ⏳ Rate limited - waiting longer...');
        await page.waitForTimeout(30000);
        return await this.findPDFLinks(page, url); // Retry
      }

      return [];
    }
  }

  async humanLikeScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = Math.floor(Math.random() * 150) + 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (Math.random() > 0.8) {
            // Random pause
            clearInterval(timer);
            setTimeout(() => {
              const newTimer = setInterval(() => {
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight) {
                  clearInterval(newTimer);
                  window.scrollTo(0, 0);
                  setTimeout(resolve, 1000);
                }
              }, Math.random() * 200 + 100);
            }, Math.random() * 1000 + 500);
          }

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            setTimeout(resolve, 1000);
          }
        }, Math.random() * 200 + 100);
      });
    });
  }

  async dismissModals(page) {
    const modalSelectors = [
      'button:has-text("Accept")', 'button:has-text("Accept All")',
      'button:has-text("I Accept")', 'button:has-text("Got it")',
      'button:has-text("OK")', 'button:has-text("Close")',
      'button:has-text("Agree")', 'button:has-text("Continue")',
      'button[aria-label*="close"]', 'button[aria-label*="Close"]',
      'button[class*="close"]', 'button[class*="dismiss"]',
      '[class*="cookie"] button', '[class*="modal"] button',
      'div[role="dialog"] button', '.modal-close', '.close-button'
    ];

    for (const selector of modalSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            await element.click({ timeout: 2000 });
            await page.waitForTimeout(this.config.jsExecutionDelays.afterModal);
          }
        }
      } catch (e) {
        // Continue
      }
    }
  }

  async clickLoadMoreButtons(page) {
    const loadMoreSelectors = [
      'button:has-text("Load More")', 'button:has-text("Show More")',
      'button:has-text("View All")', 'button:has-text("See All")',
      'a:has-text("Load More")', 'a:has-text("Show More")',
      '[class*="load-more"]', '[class*="show-more"]',
      '[class*="view-all"]', '[id*="loadmore"]'
    ];

    for (let attempt = 0; attempt < 5; attempt++) {
      let clicked = false;

      for (const selector of loadMoreSelectors) {
        try {
          const elements = await page.$$(selector);
          for (const element of elements) {
            const isVisible = await element.isVisible();
            if (isVisible) {
              await element.click({ timeout: 3000 });
              clicked = true;
              console.log(`  ✓ Clicked load more button`);
              await page.waitForTimeout(this.config.jsExecutionDelays.afterClick);
            }
          }
        } catch (e) {
          // Continue
        }
      }

      if (!clicked) break;
    }
  }

  async comprehensivePDFSearch(page, baseUrl) {
    const pdfLinks = await page.evaluate((base) => {
      const links = new Set();

      const normalizeUrl = (url) => {
        try {
          if (!url) return null;
          if (url.startsWith('//')) url = 'https:' + url;
          if (url.startsWith('/')) url = new URL(url, base).href;
          if (!url.startsWith('http')) url = new URL(url, base).href;
          return url;
        } catch {
          return null;
        }
      };

      // Search anchors
      document.querySelectorAll('a').forEach(anchor => {
        const href = normalizeUrl(anchor.href);
        if (!href) return;

        const text = anchor.textContent.toLowerCase();
        const allText = `${text} ${anchor.getAttribute('aria-label') || ''} ${anchor.getAttribute('title') || ''} ${anchor.className}`.toLowerCase();

        const isPDFUrl = href.toLowerCase().includes('.pdf');
        const hasPDFKeywords = allText.includes('pdf') || allText.includes('download') ||
                              allText.includes('sustainability') || allText.includes('esg') ||
                              allText.includes('report') || allText.includes('annual') ||
                              allText.includes('emissions') || allText.includes('carbon') ||
                              allText.includes('environmental') || allText.includes('climate');

        if (isPDFUrl || hasPDFKeywords) {
          links.add(JSON.stringify({
            url: href,
            text: anchor.textContent.trim() || 'Untitled',
            type: 'anchor'
          }));
        }
      });

      // Search iframes
      document.querySelectorAll('iframe').forEach(iframe => {
        const src = normalizeUrl(iframe.src);
        if (src && src.toLowerCase().includes('.pdf')) {
          links.add(JSON.stringify({
            url: src,
            text: 'Embedded PDF',
            type: 'iframe'
          }));
        }
      });

      // Search objects and embeds
      document.querySelectorAll('object, embed').forEach(obj => {
        const src = normalizeUrl(obj.getAttribute('data') || obj.getAttribute('src'));
        if (src && src.toLowerCase().includes('.pdf')) {
          links.add(JSON.stringify({
            url: src,
            text: 'Embedded PDF',
            type: 'object'
          }));
        }
      });

      // Search data attributes
      document.querySelectorAll('[data-url], [data-href], [data-link], [data-file]').forEach(elem => {
        const dataUrl = normalizeUrl(
          elem.getAttribute('data-url') || elem.getAttribute('data-href') ||
          elem.getAttribute('data-link') || elem.getAttribute('data-file')
        );
        if (dataUrl && dataUrl.toLowerCase().includes('.pdf')) {
          links.add(JSON.stringify({
            url: dataUrl,
            text: elem.textContent.trim() || 'Data PDF',
            type: 'data-attribute'
          }));
        }
      });

      return Array.from(links).map(item => JSON.parse(item));
    }, baseUrl);

    const uniqueLinks = Array.from(
      new Map(pdfLinks.map(link => [link.url, link])).values()
    );

    return uniqueLinks;
  }

  /**
   * Download PDF with validation
   */
  async downloadPDF(page, pdfUrl, sourcePage, linkText = '') {
    if (this.visitedUrls.has(pdfUrl)) {
      return null;
    }

    this.visitedUrls.add(pdfUrl);
    await this.ensureDownloadDir();

    const filename = this.generateFilename(pdfUrl, linkText);
    const filepath = path.join(this.config.pdfOutputDir, filename);

    // Check if valid file exists
    try {
      const validation = await this.pdfValidator.validateFile(filepath);
      if (validation.valid) {
        console.log(`  ⏭️  Skipped (valid PDF exists): ${filename}`);
        this.downloadedFiles.push({ filename, filepath, sourceUrl: pdfUrl, sourcePage });
        return filepath;
      }
    } catch {
      // File doesn't exist
    }

    console.log(`  📥 Downloading: ${linkText || pdfUrl}`);

    // Try multiple methods
    const methods = [
      () => this.downloadMethod1_DirectRequest(page, pdfUrl, filepath, sourcePage),
      () => this.downloadMethod2_BrowserNavigation(page, pdfUrl, filepath),
      () => this.downloadMethod3_ClickLink(page, pdfUrl, filepath)
    ];

    for (let i = 0; i < methods.length; i++) {
      try {
        const buffer = await methods[i]();

        if (buffer) {
          // Validate PDF before saving
          const validation = await this.pdfValidator.validateBuffer(buffer);

          if (validation.valid) {
            await fs.writeFile(filepath, buffer);
            this.downloadedFiles.push({ filename, filepath, sourceUrl: pdfUrl, sourcePage, linkText });
            console.log(`  ✅ Downloaded & Validated: ${filename} (${(buffer.length / 1024).toFixed(2)} KB)`);
            return filepath;
          } else {
            console.log(`  ❌ Invalid PDF (method ${i + 1}): ${validation.reason}`);
          }
        }
      } catch (error) {
        console.log(`  ⚠️  Method ${i + 1} failed: ${error.message}`);
      }
    }

    console.error(`  ✗ Failed: All methods exhausted for ${filename}`);
    return null;
  }

  async downloadMethod1_DirectRequest(page, pdfUrl, filepath, sourcePage) {
    const response = await page.context().request.get(pdfUrl, {
      timeout: this.config.downloadTimeout,
      headers: {
        'Referer': sourcePage,
        'Accept': 'application/pdf,application/octet-stream,*/*'
      }
    });

    if (response.ok()) {
      return await response.body();
    }
    return null;
  }

  async downloadMethod2_BrowserNavigation(page, pdfUrl, filepath) {
    const newPage = await page.context().newPage();

    try {
      const downloadPromise = newPage.waitForEvent('download', {
        timeout: this.config.downloadTimeout
      }).catch(() => null);

      await newPage.goto(pdfUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.downloadTimeout
      });

      const download = await downloadPromise;

      if (download) {
        await download.saveAs(filepath);
        const buffer = await fs.readFile(filepath);
        await newPage.close();
        return buffer;
      }

      await newPage.close();
    } catch (error) {
      if (!newPage.isClosed()) await newPage.close();
      throw error;
    }

    return null;
  }

  async downloadMethod3_ClickLink(page, pdfUrl, filepath) {
    const linkSelector = `a[href="${pdfUrl}"]`;
    const link = await page.$(linkSelector);

    if (link) {
      const downloadPromise = page.waitForEvent('download', {
        timeout: this.config.downloadTimeout
      }).catch(() => null);

      await link.click();
      const download = await downloadPromise;

      if (download) {
        await download.saveAs(filepath);
        return await fs.readFile(filepath);
      }
    }

    return null;
  }

  generateFilename(url, linkText = '') {
    try {
      const urlParts = new URL(url);
      let filename = path.basename(urlParts.pathname);

      filename = decodeURIComponent(filename);
      filename = filename.replace(/[^a-z0-9._-]/gi, '_');

      if (!filename.endsWith('.pdf') || filename.length < 5) {
        const domain = urlParts.hostname.replace('www.', '').split('.')[0];
        const cleanText = linkText.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        filename = `${domain}_${cleanText}_${Date.now()}.pdf`;
      }

      if (filename.length > 200) {
        const ext = path.extname(filename);
        filename = filename.substring(0, 190) + ext;
      }

      return filename;
    } catch {
      return `document_${Date.now()}.pdf`;
    }
  }

  /**
   * Download from URLs with retry logic
   */
  async downloadFromUrls(urls) {
    const page = await this.browserManager.newPage();

    for (const url of urls) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🎯 Targeting: ${url}`);
      console.log(`${'='.repeat(80)}`);

      let success = false;
      let attempts = 0;

      while (!success && attempts < this.config.retries.maxAttempts) {
        attempts++;

        try {
          if (url.toLowerCase().endsWith('.pdf')) {
            await this.downloadPDF(page, url, url, 'Direct PDF');
            success = true;
          } else {
            const pdfLinks = await this.findPDFLinks(page, url);
            console.log(`  Found ${pdfLinks.length} potential PDF links\n`);

            if (pdfLinks.length > 0) {
              const uniqueLinks = Array.from(
                new Map(pdfLinks.map(link => [link.url, link])).values()
              );

              for (let i = 0; i < uniqueLinks.length; i++) {
                const link = uniqueLinks[i];
                console.log(`  [${i + 1}/${uniqueLinks.length}] ${link.text}`);
                await this.downloadPDF(page, link.url, url, link.text);

                await this.browserManager.delayBetweenDownloads();
              }
              success = true;
            } else {
              console.log(`  ⚠️  No PDF links found`);
            }
          }
        } catch (error) {
          console.error(`\n  ❌ Attempt ${attempts} failed: ${error.message}`);

          if (attempts < this.config.retries.maxAttempts) {
            const delay = this.config.retries.initialDelay * Math.pow(this.config.retries.backoffMultiplier, attempts - 1);
            console.log(`  ⏳ Waiting ${delay / 1000}s before retry...`);
            await page.waitForTimeout(delay);

            // Rotate proxy on failure
            if (this.config.proxy.enabled) {
              await this.browserManager.rotateProxy();
            }
          }
        }
      }

      if (!success) {
        console.log(`\n  ❌ Failed after ${attempts} attempts`);
      }

      await this.browserManager.delayBetweenWebsites();
    }

    await page.close();

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 Download Summary`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Valid PDFs downloaded: ${this.downloadedFiles.length}`);
    console.log(`${'='.repeat(80)}\n`);

    return this.downloadedFiles;
  }
}
